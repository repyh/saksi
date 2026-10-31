#!/usr/bin/env python3
"""Bangun web/public/data/desa-batas.geojson dari GADM 4.1 level 4 (desa).

Sumber mentah: https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_IDN_4.json (53 MB, seluruh Indonesia).
Jalankan: python3 tools/buat_batas_desa.py /path/gadm41_IDN_4.json

Output: 274 poligon desa Kab. Tangerang (NAME_2 == "Tangerang", NAME_1 == "Banten"),
koordinat dibulatkan 5 desimal, properti join ke gazetteer BPS (id_desa).
"""
from __future__ import annotations

import collections
import difflib
import json
import pathlib
import re
import sys

AKAR = pathlib.Path(__file__).resolve().parent.parent
GAZETTEER = AKAR / "data" / "tangerang_desa_coords.json"
KELUARAN = AKAR / "web" / "public" / "data" / "desa-batas.geojson"

# GADM menulis sebagian nama berbeda dari BPS. Override eksplisit, bukan fuzzy.
OVERRIDE = {
    "Kelebet": "Klebet",                      # Kemiri
    "KampungMelayuTimur": "Kmp Melayu Tim",   # Teluknaga
    "KampungMelayuBarat": "Kmp Melayu Brt",   # Teluknaga
    "Bunisari": "Bonisari",                   # Pakuhaji
    "Salembaran": "Salembaran Jaya",          # Kosambi — GADM memotong namanya
}


def norm(s: str) -> str:
    return re.sub(r"[^a-z]", "", str(s).lower())


def sederhana(ring: list[list[float]]) -> list[list[float]]:
    out: list[list[float]] = []
    for c in ring:
        b = [round(c[0], 5), round(c[1], 5)]
        if not out or out[-1] != b:
            out.append(b)
    if len(out) >= 4 and out[0] != out[-1]:
        out.append(out[0])
    return out


def kecilkan(geom: dict) -> dict:
    t, c = geom["type"], geom["coordinates"]
    if t == "Polygon":
        return {"type": "Polygon", "coordinates": [sederhana(r) for r in c if len(r) >= 4]}
    if t == "MultiPolygon":
        return {
            "type": "MultiPolygon",
            "coordinates": [[sederhana(r) for r in poly if len(r) >= 4] for poly in c],
        }
    return geom


def main(path_gadm: str) -> None:
    data = json.loads(pathlib.Path(path_gadm).read_text())
    kab = [
        f
        for f in data["features"]
        if f["properties"].get("NAME_1") == "Banten"
        and f["properties"].get("NAME_2") == "Tangerang"
    ]
    print(f"fitur desa Kab. Tangerang di GADM: {len(kab)}")

    gaz = json.loads(GAZETTEER.read_text())
    per_kec: dict[str, list[dict]] = collections.defaultdict(list)
    for f in kab:
        nama = OVERRIDE.get(f["properties"]["NAME_4"], f["properties"]["NAME_4"])
        per_kec[norm(f["properties"]["NAME_3"])].append({"fitur": f, "nama": nama})

    pakai: dict[str, dict] = {}
    for d in gaz:
        kandidat = per_kec.get(norm(d["kecamatan"]), [])
        tepat = [k for k in kandidat if norm(k["nama"]) == norm(d["desa"])]
        if tepat:
            pakai[tepat[0]["fitur"]["properties"]["GID_4"]] = {**d, "nama_gadm": tepat[0]["nama"]}
            continue
        mirip = difflib.get_close_matches(
            norm(d["desa"]), [norm(k["nama"]) for k in kandidat], n=1, cutoff=0.8
        )
        if mirip:
            k = [x for x in kandidat if norm(x["nama"]) == mirip[0]][0]
            pakai[k["fitur"]["properties"]["GID_4"]] = {**d, "nama_gadm": k["nama"]}
        else:
            print(f"  TIDAK TERPASANG: {d['desa']} ({d['kecamatan']})")

    print(f"gazetteer terpasang: {len(pakai)}/{len(gaz)}")

    fitur = []
    for f in kab:
        pr = f["properties"]
        d = pakai.get(pr["GID_4"])
        nama = OVERRIDE.get(pr["NAME_4"], pr["NAME_4"])
        fitur.append(
            {
                "type": "Feature",
                "properties": {
                    "desa": d["desa"] if d else nama,
                    "kecamatan": d["kecamatan"] if d else pr["NAME_3"],
                    "desa_gadm": pr["NAME_4"],
                    "kecamatan_gadm": pr["NAME_3"],
                    "id_desa": d["id_desa"] if d else None,
                },
                "geometry": kecilkan(f["geometry"]),
            }
        )

    KELUARAN.parent.mkdir(parents=True, exist_ok=True)
    KELUARAN.write_text(
        json.dumps({"type": "FeatureCollection", "features": fitur}, ensure_ascii=False, separators=(",", ":"))
    )
    tanpa_kode = sum(1 for f in fitur if not f["properties"]["id_desa"])
    print(f"tulis {KELUARAN} — {KELUARAN.stat().st_size / 1024:.0f} KB, {len(fitur)} desa, {tanpa_kode} tanpa id_desa")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1])
