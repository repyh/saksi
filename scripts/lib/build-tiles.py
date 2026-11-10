#!/usr/bin/env python3
"""Bangun tile vektor MVT dari snapshot GeoJSON jaringan jalan.

Dijalankan oleh scripts/jalan-tiles.mjs lewat:
  uv run --with shapely --with mapbox-vector-tile --with mercantile python3 ...

Keluaran: <output>/<z>/<x>/<y>.pbf dan <output>/metadata.json.
"""
import argparse
import gzip
import json
import math
import os
from datetime import datetime, timezone

import mercantile
from mapbox_vector_tile import encode
from shapely.geometry import box, mapping, shape
from shapely.geometry.multilinestring import MultiLineString
from shapely.strtree import STRtree


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


def properti_mvt(properties):
    hasil = {}
    for kunci, nilai in (properties or {}).items():
        if nilai is None:
            continue
        if isinstance(nilai, list):
            teks = ", ".join(str(x).strip() for x in nilai if str(x).strip())
            if teks:
                hasil[kunci] = teks
            continue
        if isinstance(nilai, (dict, tuple)):
            continue
        if isinstance(nilai, bool):
            hasil[kunci] = nilai
        elif isinstance(nilai, (int, float)) and math.isfinite(float(nilai)):
            hasil[kunci] = float(nilai) if isinstance(nilai, float) else nilai
        else:
            hasil[kunci] = str(nilai)
    return hasil


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--layer", default="jalan")
    parser.add_argument("--minzoom", type=int, default=10)
    parser.add_argument("--maxzoom", type=int, default=16)
    parser.add_argument("--tolerance", type=float, default=0.00001)
    parser.add_argument("--attribution", default="")
    parser.add_argument("--license", default="ODbL-1.0")
    parser.add_argument("--release", default="")
    args = parser.parse_args()

    with open(args.input, encoding="utf-8") as berkas:
        data = json.load(berkas)

    fitur = []
    for item in data.get("features", []):
        geometri = shape(item["geometry"])
        if geometri.is_empty:
            continue
        fitur.append(
            {
                "geometry": geometri,
                "properties": properti_mvt(item.get("properties")),
            }
        )
    if not fitur:
        raise SystemExit("snapshot tidak memuat geometri")

    tree = STRtree([item["geometry"] for item in fitur])
    west = min(item["geometry"].bounds[0] for item in fitur)
    south = min(item["geometry"].bounds[1] for item in fitur)
    east = max(item["geometry"].bounds[2] for item in fitur)
    north = max(item["geometry"].bounds[3] for item in fitur)

    jumlah_tile = 0
    total_byte = 0
    for zoom in range(args.minzoom, args.maxzoom + 1):
        jumlah_zoom = 0
        for tile in mercantile.tiles(west, south, east, north, [zoom]):
            batas = mercantile.bounds(tile)
            kotak = box(batas.west, batas.south, batas.east, batas.north)
            kandidat = tree.query(kotak)
            layer = []
            toleransi = args.tolerance * (2 ** (args.maxzoom - zoom))
            for indeks in kandidat:
                item = fitur[int(indeks)]
                terpotong = item["geometry"].intersection(kotak)
                bagian = [garis for garis in garis(terpotong) if not garis.is_empty]
                if not bagian:
                    continue
                if len(bagian) == 1:
                    geometri = bagian[0]
                else:
                    geometri = MultiLineString([list(baris.coords) for baris in bagian])
                if toleransi > 0:
                    geometri = geometri.simplify(toleransi, preserve_topology=False)
                if geometri.is_empty:
                    continue
                layer.append(
                    {
                        "type": "Feature",
                        "geometry": mapping(geometri),
                        "properties": item["properties"],
                    }
                )
            if not layer:
                continue
            encoded = encode(
                [{"name": args.layer, "features": layer}],
                default_options={
                    "quantize_bounds": (batas.west, batas.south, batas.east, batas.north),
                    "extents": 4096,
                },
            )
            tujuan = os.path.join(args.output, str(zoom), str(tile.x), f"{tile.y}.pbf.gz")
            os.makedirs(os.path.dirname(tujuan), exist_ok=True)
            terkompresi = gzip.compress(encoded, compresslevel=9)
            with open(tujuan, "wb") as berkas:
                berkas.write(terkompresi)
            jumlah_tile += 1
            jumlah_zoom += 1
            total_byte += len(terkompresi)
        print(f"zoom {zoom}: {jumlah_zoom} tile", flush=True)

    metadata = {
        "layer": args.layer,
        "minzoom": args.minzoom,
        "maxzoom": args.maxzoom,
        "bounds": [west, south, east, north],
        "features": len(fitur),
        "tiles": jumlah_tile,
        "bytes": total_byte,
        "tolerance": args.tolerance,
        "attribution": args.attribution,
        "license": args.license,
        "release": args.release,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }
    os.makedirs(args.output, exist_ok=True)
    with open(os.path.join(args.output, "metadata.json"), "w", encoding="utf-8") as berkas:
        json.dump(metadata, berkas, ensure_ascii=False, indent=2)
        berkas.write("\n")
    print(json.dumps(metadata, ensure_ascii=False))


if __name__ == "__main__":
    main()
