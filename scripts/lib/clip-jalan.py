#!/usr/bin/env python3
"""Potong FeatureCollection garis ke batas wilayah memakai Shapely.

Dijalankan oleh scripts/jalan.mjs lewat:
  uv run --with shapely python3 scripts/lib/clip-jalan.py ...

Hanya geometri garis yang dipertahankan. Satu fitur masukan tetap menjadi satu
fitur keluaran; bila terpotong menjadi beberapa bagian, geometrinya menjadi
MultiLineString dengan id yang sama.
"""
import argparse
import json
import sys

from shapely.geometry import mapping, shape
from shapely.ops import unary_union
from shapely.prepared import prep


def garis(geometry):
    if geometry.is_empty:
        return []
    if geometry.geom_type == "LineString":
        return [geometry]
    if geometry.geom_type in ("MultiLineString", "GeometryCollection"):
        hasil = []
        for bagian in geometry.geoms:
            hasil.extend(garis(bagian))
        return hasil
    return []


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--boundary", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--simplify", type=float, default=0.0)
    args = parser.parse_args()

    with open(args.input, encoding="utf-8") as berkas:
        data = json.load(berkas)
    with open(args.boundary, encoding="utf-8") as berkas:
        batas = json.load(berkas)

    poligon = [
        shape(fitur["geometry"])
        for fitur in batas.get("features", [])
        if fitur.get("geometry")
    ]
    if not poligon:
        raise SystemExit("batas wilayah tidak memuat poligon")
    gabungan = unary_union(poligon)
    siap = prep(gabungan)

    features = []
    dibuang = 0
    for fitur in data.get("features", []):
        geometri = shape(fitur["geometry"])
        if not siap.intersects(geometri):
            dibuang += 1
            continue
        terpotong = geometri.intersection(gabungan)
        if args.simplify > 0 and not terpotong.is_empty:
            terpotong = terpotong.simplify(args.simplify, preserve_topology=True)
        bagian = [x for x in garis(terpotong) if x.length > 0]
        if not bagian:
            dibuang += 1
            continue
        if len(bagian) == 1:
            geometry = mapping(bagian[0])
        else:
            geometry = {
                "type": "MultiLineString",
                "coordinates": [list(baris.coords) for baris in bagian],
            }
        features.append(
            {
                "type": "Feature",
                "id": fitur.get("id"),
                "properties": fitur.get("properties", {}),
                "geometry": geometry,
            }
        )

    with open(args.output, "w", encoding="utf-8") as berkas:
        json.dump(
            {"type": "FeatureCollection", "features": features},
            berkas,
            ensure_ascii=False,
            separators=(",", ":"),
        )
    print(
        json.dumps(
            {"masuk": len(data.get("features", [])), "keluar": len(features), "dibuang": dibuang}
        ),
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
