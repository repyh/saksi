"""Unduh / agregasi layer ArcGIS Bina Marga (paging, bisa dilanjutkan).

Kenapa skrip ini ada: server Bina Marga TIDAK menyediakan ekspor massal
(capabilities = "Query" saja), maxRecordCount = 2000 per permintaan, dan tidak ada
tombol unduh. Dataset lengkap tetap bisa diambil utuh lewat paging.

Pemakaian:
  python3 ingest/arcgis_dump.py stats  --layer iri
  python3 ingest/arcgis_dump.py dump   --layer iri --where "provinsi='BANTEN'" --out dump/banten.json
  python3 ingest/arcgis_dump.py dump   --layer iri --out dump/iri_penuh.ndjson --ndjson

Catatan teknis:
  - SELALU kirim orderByFields agar urutan halaman stabil (hindari baris terlewat/ganda).
  - Atribut saja (returnGeometry=false) untuk analisis; geometri hanya untuk peta.
  - Geometri asli memakai proyeksi Indonesia Lambert Conformal Conic → kirim outSR=4326.
  - ends: simpan nomor halaman terakhir di .state supaya bisa dilanjutkan kalau putus.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import subprocess
import sys
import time
import urllib.parse

BASE = "https://gisportal.binamarga.pu.go.id/arcgis/rest/services/Hosted"
UA = "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0"
PAGE = 2000
SLEEP = 0.25
OUT = pathlib.Path(__file__).resolve().parent.parent / "data"

LAYERS = {
    "iri": ("IRI_1_2026", "objectid"),
    "pci": ("Centerline_PCI_2025", "fid"),
    "ruas": ("Jalan_Nasional_PPK_Satker", "fid"),
}

FIELDS = {
    "iri": "objectid,linkid,from_sta_km,to_sta_km,mean_iri,min_iri,max_iri,year,semester,link_name,kdprov,provinsi",
    "pci": "fid,linkid,link_name,from_sta_k,to_sta_km,mean_pci,min_pci,max_pci,first_surv",
    "ruas": "fid,routeid,link_name,start_poin,end_point_,sk_length,bm_prov_id,road_funct,road_statu,road_class,city_regen,provinsi,satker",
}


def call(layer: str, params: dict) -> dict:
    name, _ = LAYERS[layer]
    url = f"{BASE}/{name}/FeatureServer/0/query?" + urllib.parse.urlencode(params)
    raw = subprocess.run(["curl", "-s", "-A", UA, "-m", "120", url],
                         capture_output=True, text=True).stdout
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        raise RuntimeError(f"respons bukan JSON ({len(raw)} byte): {raw[:120]}")
    if "error" in data:
        raise RuntimeError(f"{layer}: {data['error']}")
    return data


def count(layer: str, where: str = "1=1") -> int:
    return call(layer, {"where": where, "returnCountOnly": "true", "f": "json"})["count"]


def stats(layer: str, where: str, agg: list[dict], group: str | None) -> list[dict]:
    p = {"where": where, "outStatistics": json.dumps(agg), "returnGeometry": "false", "f": "json"}
    if group:
        p["groupByFieldsForStatistics"] = group
    return [f["attributes"] for f in call(layer, p).get("features", [])]


def dump(layer: str, where: str, out: pathlib.Path, ndjson: bool = False) -> dict:
    _, oid = LAYERS[layer]
    total = count(layer, where)
    state = out.with_suffix(out.suffix + ".state")
    start_page = int(state.read_text()) if state.exists() else 0
    fields = FIELDS[layer]
    rows: list[dict] = []
    if out.exists() and start_page:
        rows = json.loads(out.read_text()) if not ndjson else []
    page = start_page
    t0 = time.time()
    while True:
        p = {
            "where": where, "outFields": fields, "returnGeometry": "false",
            "orderByFields": oid, "resultOffset": str(page * PAGE),
            "resultRecordCount": str(PAGE), "f": "json",
        }
        feats = call(layer, p).get("features", [])
        if not feats:
            break
        rows.extend(f["attributes"] for f in feats)
        page += 1
        state.write_text(str(page))
        if page % 20 == 0 or len(feats) < PAGE:
            print(f"  halaman {page}: {len(rows):,}/{total:,} "
                  f"({time.time() - t0:.0f}s)", flush=True)
        if len(feats) < PAGE:
            break
        time.sleep(SLEEP)
    out.parent.mkdir(parents=True, exist_ok=True)
    if ndjson:
        out.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows))
    else:
        out.write_text(json.dumps(rows, ensure_ascii=False))
    state.unlink(missing_ok=True)
    return {"layer": layer, "where": where, "baris": len(rows), "total_di_server": total,
            "lengkap": len(rows) == total, "berkas": str(out), "detik": round(time.time() - t0, 1)}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["stats", "dump", "count"])
    ap.add_argument("--layer", default="iri", choices=list(LAYERS))
    ap.add_argument("--where", default="1=1")
    ap.add_argument("--group", default="provinsi")
    ap.add_argument("--out", default="")
    ap.add_argument("--ndjson", action="store_true")
    a = ap.parse_args()

    if a.mode == "count":
        print(f"{a.layer} [{a.where}] -> {count(a.layer, a.where):,} baris")
        return
    if a.mode == "stats":
        agg = [{"statisticType": "count", "onStatisticField": LAYERS[a.layer][1],
                "outStatisticFieldName": "n"}]
        for row in stats(a.layer, a.where, agg, a.group):
            print(row)
        return
    out = pathlib.Path(a.out) if a.out else OUT / f"{a.layer}_dump.json"
    res = dump(a.layer, a.where, out, a.ndjson)
    print(json.dumps(res, ensure_ascii=False, indent=1))
    if not res["lengkap"]:
        sys.exit(2)


if __name__ == "__main__":
    main()
