#!/usr/bin/env python3
"""Geocode desa/kelurahan Kab. Tangerang lewat Nominatim (OSM), dengan checkpoint.

Input : data/scratch/tangerang_desa_wilayah.json  (274 desa/29 kecamatan dari kode BPS 3603)
Output: data/scratch/tangerang_desa_coords.json   (id_desa, desa, id_kec, kecamatan, lat, lon, presisi)

Urutan upaya per desa:
  1) "{desa}, {kecamatan}, Kabupaten Tangerang"  → titik desa
  2) "{desa}, Kabupaten Tangerang"              → titik desa
  3) "{kecamatan}, Kabupaten Tangerang"          → sentroid kecamatan (presisi: Kecamatan)

Kebijakan Nominatim: 1 permintaan/detik, User-Agent yang menyebut identitas.
"""
from __future__ import annotations

import json
import pathlib
import sys
import time
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCR = ROOT / "data/scratch"
UA = "saksi-lomba-wia/1.0 (riset mahasiswa; kontak: topher)"
URL = "https://nominatim.openstreetmap.org/search"
VIEWBOX = "106.30,-6.45,106.85,-5.85"   # Kab. Tangerang + sekitarnya (lon,lat)


def q(params: dict) -> list[dict]:
    p = {"format": "jsonv2", "addressdetails": 1, "limit": 3, "countrycodes": "id",
         "viewbox": VIEWBOX, "bounded": 1, **params}
    req = urllib.request.Request(URL + "?" + urllib.parse.urlencode(p),
                                 headers={"User-Agent": UA, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=45) as r:
            return json.loads(r.read().decode())
    except Exception:  # noqa: BLE001
        return []


def lancar(hits: list[dict], nama: str) -> dict | None:
    """Pilih hasil yang kotanya/kabupatennya Tangerang."""
    for h in hits:
        a = h.get("address") or {}
        kota = " ".join(str(v).lower() for v in a.values())
        if "tangerang" not in kota:
            continue
        return {"lat": float(h["lat"]), "lon": float(h["lon"]),
                "label": h.get("display_name", "")[:120]}
    return None


def main() -> None:
    desa = json.loads((SCR / "tangerang_desa_wilayah.json").read_text())
    kecs: dict[str, dict] = {}
    out_path = SCR / "tangerang_desa_coords.json"
    hasil = json.loads(out_path.read_text()) if out_path.exists() else {}
    t0 = time.time()
    for i, d in enumerate(desa, 1):
        key = d["id_desa"]
        if key in hasil:
            continue
        rec = {"id_desa": key, "desa": d["desa"], "kecamatan": d["kecamatan"],
               "id_kec": key[:6], "lat": None, "lon": None, "presisi": None, "label": None}
        for form, presisi in ((f'{d["desa"]}, {d["kecamatan"]}, Kabupaten Tangerang', "Desa/Kelurahan"),
                              (f'{d["desa"]}, Kabupaten Tangerang', "Desa/Kelurahan")):
            hit = lancar(q({"q": form}), d["desa"])
            time.sleep(1.1)
            if hit:
                rec.update(hit, presisi=presisi)
                break
        if rec["lat"] is None:
            k = d["kecamatan"]
            if k not in kecs:
                hit = lancar(q({"q": f"{k}, Kabupaten Tangerang"}), k)
                time.sleep(1.1)
                kecs[k] = hit or {}
            if kecs[k]:
                rec.update({"lat": kecs[k]["lat"], "lon": kecs[k]["lon"],
                            "label": kecs[k]["label"], "presisi": "Kecamatan"})
        hasil[key] = rec
        if i % 20 == 0:
            out_path.write_text(json.dumps(list(hasil.values()), ensure_ascii=False, indent=1))
            ok = sum(1 for v in hasil.values() if v["lat"] is not None)
            print(f"  {i}/{len(desa)} · tergeocode {ok} · {time.time()-t0:.0f}s", flush=True)
    out_path.write_text(json.dumps(list(hasil.values()), ensure_ascii=False, indent=1))
    ok = sum(1 for v in hasil.values() if v["lat"] is not None)
    desa_ok = sum(1 for v in hasil.values() if v["presisi"] == "Desa/Kelurahan")
    print(f"selesai: {ok}/{len(hasil)} punya koordinat · {desa_ok} presisi desa · -> {out_path}")


if __name__ == "__main__":
    sys.exit(main())
