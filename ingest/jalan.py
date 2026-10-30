"""Kondisi jalan nasional — Bina Marga GIS (ArcGIS FeatureServer publik).

Sumber: gisportal.binamarga.pu.go.id
  - IRI_1_2026              : IRI rata-rata per titik ukur (~477.000 titik), semester 1 2026
  - Centerline_PCI_2025     : PCI per segmen (~926.000 segmen), survei 2025
  - Jalan_Nasional_PPK_Satker: 3.306 ruas + nama kabupaten/kota + panjang SK

Tidak butuh token. Query agregasi memakai outStatistics + groupByFieldsForStatistics.

Kelas IRI yang dipakai (pembagian lazim di Indonesia):
  <=4 baik · >4-8 sedang · >8-12 rusak ringan (RR) · >12 rusak berat (RB)
"""
from __future__ import annotations

import json
import pathlib
import subprocess
import urllib.parse

OUT = pathlib.Path(__file__).resolve().parent.parent / "data"
BASE = "https://gisportal.binamarga.pu.go.id/arcgis/rest/services/Hosted"
UA = "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0"

LAYER = {
    "iri": "IRI_1_2026",
    "pci": "Centerline_PCI_2025",
    "ruas": "Jalan_Nasional_PPK_Satker",
}

KELAS = [
    ("baik", "mean_iri<=4"),
    ("sedang", "mean_iri>4 AND mean_iri<=8"),
    ("rusak_ringan", "mean_iri>8 AND mean_iri<=12"),
    ("rusak_berat", "mean_iri>12"),
]

# rata-rata 100 m per titik ukur (477.032 titik ≈ 47.700 km jalan nasional)
KM_PER_TITIK = 0.1


def query(layer_key: str, params: dict) -> dict:
    url = f"{BASE}/{LAYER[layer_key]}/FeatureServer/0/query?" + urllib.parse.urlencode(params)
    raw = subprocess.run(["curl", "-s", "-A", UA, "-m", "120", url],
                         capture_output=True, text=True).stdout
    data = json.loads(raw)
    if "error" in data:
        raise RuntimeError(f"{layer_key}: {data['error']}")
    return data


def agregat(layer_key: str, where: str, stat: str, field: str, name: str, group: str | None) -> dict:
    params = {
        "where": where,
        "outStatistics": json.dumps([{
            "statisticType": stat, "onStatisticField": field, "outStatisticFieldName": name}]),
        "returnGeometry": "false",
        "f": "json",
    }
    if group:
        params["groupByFieldsForStatistics"] = group
    feats = query(layer_key, params).get("features", [])
    if group:
        return {f["attributes"][group]: f["attributes"][name] for f in feats}
    return {name: feats[0]["attributes"][name]} if feats else {}


def main() -> None:
    OUT.mkdir(exist_ok=True)

    total = agregat("iri", "1=1", "count", "objectid", "n", "provinsi")
    rata = agregat("iri", "1=1", "avg", "mean_iri", "v", "provinsi")
    kelas = {k: agregat("iri", w, "count", "objectid", "n", "provinsi") for k, w in KELAS}

    prov = []
    for p, n in total.items():
        if not n:
            continue
        prov.append({
            "provinsi": p,
            "titik": n,
            "km": round(n * KM_PER_TITIK, 1),
            "rata_iri": round(rata.get(p, 0), 2),
            "kelas": {k: kelas[k].get(p, 0) for k, _ in KELAS},
            "persen": {k: round(kelas[k].get(p, 0) / n * 100, 2) for k, _ in KELAS},
        })
    prov.sort(key=lambda r: -r["rata_iri"])

    n_all = sum(p["titik"] for p in prov)
    nasional = {
        "titik": n_all,
        "km": round(n_all * KM_PER_TITIK, 1),
        "rata_iri": round(sum(p["rata_iri"] * p["titik"] for p in prov) / n_all, 2),
        "kelas": {k: sum(p["kelas"][k] for p in prov) for k, _ in KELAS},
        "persen": {k: round(sum(p["kelas"][k] for p in prov) / n_all * 100, 2) for k, _ in KELAS},
    }

    payload = {
        "sumber": {
            "nama": "Bina Marga GIS — Kementerian PU",
            "layer": f"{BASE}/{LAYER['iri']}/FeatureServer/0",
            "endpoint_contoh": f"{BASE}/{LAYER['iri']}/FeatureServer/0/query?where=1=1&returnCountOnly=true&f=json",
            "keterangan": "IRI rata-rata per titik ukur 100 m, semester 1 2026. Kelas: baik<=4, sedang 4-8, rusak ringan 8-12, rusak berat >12.",
        },
        "semester": "1/2026",
        "nasional": nasional,
        "provinsi": prov,
    }
    (OUT / "jalan.json").write_text(json.dumps(payload, ensure_ascii=False, indent=1))

    print(f"titik: {n_all:,} ≈ {nasional['km']:,} km | rata IRI {nasional['rata_iri']}")
    print("nasional: " + " · ".join(f"{k} {nasional['persen'][k]}%" for k, _ in KELAS))
    print(f"\n{'PROVINSI':<24}{'KM':>9}{'IRI':>7}{'RUSAK%':>9}{'RB%':>7}")
    for p in prov[:8]:
        print(f"{p['provinsi'][:23]:<24}{p['km']:>9,.0f}{p['rata_iri']:>7.2f}"
              f"{p['persen']['rusak_ringan'] + p['persen']['rusak_berat']:>9.1f}{p['persen']['rusak_berat']:>7.1f}")
    print("...")


if __name__ == "__main__":
    main()
