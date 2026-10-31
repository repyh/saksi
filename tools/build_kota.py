#!/usr/bin/env python3
"""Bangun dataset SAKSI untuk Kota Tangerang (idKldi=D44).

Masukan (jalankan dulu, simpan di data/scratch/kota_tng/):
  rup_kota_2025.json, rup_kota_2026.json   <- tarikan sirup.inaproc.id
  rw.geojson, kel.geojson                  <- Batas_Adminsitratif (ArcGIS Kota Tangerang)

Keluaran:
  web/public/data/paket.json   paket jalan + anchor RW/kelurahan/kecamatan
  web/public/data/desa.json    unit wilayah (RW) untuk dropdown & pencarian terdekat
  web/public/data/rw.geojson   poligon RW (sudah ada, disalin kalau perlu)

Aturan: paket TIDAK diberi titik pekerjaan. Lokasi = poligon RW/kelurahan tempat paket
disebut, dan `presisi_peta` menyatakan dari mana anchor itu berasal.
"""
from __future__ import annotations

import json
import pathlib
import re
import statistics
import unicodedata

AKAR = pathlib.Path(__file__).resolve().parent.parent
SCRATCH = AKAR / "data" / "scratch" / "kota_tng"
KELUAR = AKAR / "web" / "public" / "data"

SEKTOR = "Jalan, Jembatan & Drainase"

VERB = r"(pekerjaan|peningkatan|rekonstruksi|pembangunan|pemeliharaan|rehabilitasi|penataan|pengaspalan|pengerasan|pembetonan|pemasangan|lanjutan|normalisasi|perbaikan|pelebaran)"
OBJ = r"(jalan|jembatan|trotoar|drainase|saluran|turap|talud|paving|hotmix|rabat|gorong)"
BUKAN = r"(puskesmas|sekolah|gedung|kantor|ruang|aula|klinik|posyandu|pasar|terminal|instalasi)"
RE_FISIK = re.compile(rf"{VERB}[^|]{{0,40}}{OBJ}|{OBJ}[^|]{{0,25}}{VERB}", re.I)
RE_BUKAN = re.compile(BUKAN, re.I)
RE_RW = re.compile(r"\bRW\.?\s*0*(\d{1,3})\b", re.I)
RE_KEL_MARK = re.compile(r"\b(kel\.?|kelurahan)\s*([A-Za-z][\w'\- ]{2,28})", re.I)


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s or "")).lower()
    s = re.sub(r"\b(jl|jalan|gang|gg|komp|komplek|kp|kampung)\.?\b", " ", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def ring_centroid(geom: dict) -> tuple[float, float] | None:
    """Titik tengah dari ring terbesar — cukup untuk pusat label/pencarian terdekat."""
    terbaik: list | None = None
    for poly in geom.get("coordinates", []):
        for ring in poly:
            if terbaik is None or len(ring) > len(terbaik):
                terbaik = ring
    if not terbaik:
        return None
    xs = [p[0] for p in terbaik]
    ys = [p[1] for p in terbaik]
    return statistics.fmean(ys), statistics.fmean(xs)


def baca(f: pathlib.Path):
    return json.loads(f.read_text())


def main() -> None:
    rows = []
    for tahun in (2025, 2026):
        for r in baca(SCRATCH / f"rup_kota_{tahun}.json"):
            rows.append((tahun, r))
    rw = baca(SCRATCH / "rw.geojson")
    kel = baca(SCRATCH / "kel.geojson")

    # indeks wilayah
    daftar_kel = sorted({str(f["properties"]["wadmkd"]).strip() for f in kel["features"]})
    kel_norm = {norm(n): n for n in daftar_kel}

    unit: dict[str, dict] = {}
    for f in rw["features"]:
        pr = f["properties"]
        kelurahan = str(pr["wadmkd"] or "").strip()
        rw_no = str(pr["rw"] or "").strip()
        if not kelurahan or not rw_no:
            continue
        pusat = ring_centroid(f["geometry"])
        if not pusat:
            continue
        kunci = f"{norm(kelurahan)}|{rw_no}"
        unit[kunci] = {
            "id": kunci,
            "desa": f"{kelurahan.title()} RW {rw_no}",
            "kelurahan": kelurahan.title(),
            "rw": rw_no,
            "kecamatan": str(pr["wadmkc"] or "").strip().title(),
            "lat": round(pusat[0], 6),
            "lon": round(pusat[1], 6),
        }
    print(f"unit RW: {len(unit)}")

    kel_pusat: dict[str, dict] = {}
    for f in kel["features"]:
        nama = str(f["properties"]["wadmkd"] or "").strip()
        pusat = ring_centroid(f["geometry"])
        if nama and pusat:
            kel_pusat[norm(nama)] = {
                "kecamatan": str(f["properties"]["wadmkc"] or "").strip().title(),
                "lat": round(pusat[0], 6),
                "lon": round(pusat[1], 6),
            }

    paket = []
    for tahun_rup, r in rows:
        kode, satker, nama, pagu, metode, sumber, _kode2, bulan = (list(r) + [None] * 8)[:8]
        nama = re.sub(r"&#x27;", "'", str(nama))
        if not RE_FISIK.search(nama) or RE_BUKAN.search(nama):
            continue

        teks = " " + norm(nama) + " "
        kelurahan = next((asli for n, asli in kel_norm.items() if f" {n} " in teks), None)
        if not kelurahan:
            m = RE_KEL_MARK.search(nama)
            if m and norm(m.group(2)) in kel_norm:
                kelurahan = kel_norm[norm(m.group(2))]
        m_rw = RE_RW.search(nama)
        rw_no = str(int(m_rw.group(1))) if m_rw else None

        presisi, lat, lon, unit_id = "Kabupaten", None, None, None
        if kelurahan and rw_no and f"{norm(kelurahan)}|{rw_no}" in unit:
            u = unit[f"{norm(kelurahan)}|{rw_no}"]
            presisi, lat, lon, unit_id = "RW", u["lat"], u["lon"], u["id"]
        elif kelurahan and norm(kelurahan) in kel_pusat:
            p = kel_pusat[norm(kelurahan)]
            presisi, lat, lon = "Kelurahan", p["lat"], p["lon"]
            unit_id = f"{norm(kelurahan)}|*"
        elif kelurahan:
            presisi = "Kelurahan"

        paket.append(
            {
                "kode_rup": str(kode),
                "tahun": int(tahun_rup),
                "satker": str(satker).title(),
                "nama": nama,
                "pagu": int(pagu),
                "metode": metode,
                "sumber": sumber,
                "bulan": bulan,
                "sektor": SEKTOR,
                "desa_resmi": kelurahan.title() if kelurahan else None,
                "rw": rw_no,
                "unit_id": unit_id,
                "kecamatan_resmi": (
                    unit[unit_id]["kecamatan"]
                    if unit_id in unit
                    else kel_pusat.get(norm(kelurahan), {}).get("kecamatan")
                ),
                "lat": lat,
                "lon": lon,
                "presisi_peta": presisi,
                "lokasi_mikro": None,
            }
        )

    KELUAR.mkdir(parents=True, exist_ok=True)
    (KELUAR / "paket.json").write_text(
        json.dumps({"paket": paket}, ensure_ascii=False, separators=(",", ":"))
    )
    (KELUAR / "desa.json").write_text(
        json.dumps(sorted(unit.values(), key=lambda u: (u["kecamatan"], u["desa"])), ensure_ascii=False)
    )

    # ringkasan
    total = sum(p["pagu"] for p in paket)
    per = {}
    for p in paket:
        per[p["presisi_peta"]] = per.get(p["presisi_peta"], 0) + 1
    print(f"paket jalan: {len(paket)} · pagu Rp{total / 1e9:.2f} M")
    print("anchor:", per)
    print("kelurahan tersentuh:", len({p['desa_resmi'] for p in paket if p['desa_resmi']}))
    print("unit RW tersentuh:", len({p['unit_id'] for p in paket if p['unit_id'] and p['unit_id'].endswith(tuple('0123456789'))}))


if __name__ == "__main__":
    main()
