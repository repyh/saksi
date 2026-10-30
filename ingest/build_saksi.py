#!/usr/bin/env python3
"""Bangun dataset SAKSI dari RUP mentah + gazetteer desa berkoordinat.

Sama aturannya untuk wilayah mana pun:
  1. bersihkan nama paket (kode rekening, entity HTML, pembungkus "Belanja Modal Jalan Desa -")
  2. saring pekerjaan fisik (awalan kata kerja fisik; buang operasional/ATK/konsultansi)
  3. klasifikasi 5 sektor dengan kata kunci (deterministik, bisa diaudit)
  4. deteksi koridor: penanda koridor (-, menuju, arah, s/d) + dua sisi resolve ke gazetteer
  5. petakan ke desa/kelurahan (nama terpanjang lebih dulu) → titik desa + offset hash ±250 m
  6. bila hanya kecamatan yang resolve → sentroid kecamatan
  7. sisanya jangan dipaksa: presisi "Kabupaten" (tampil di tabel, bukan di peta)

Usage:
  python3 ingest/build_saksi.py tangerang_kab 2025 2026
  python3 ingest/build_saksi.py bandung_kab 2025 2026
"""
from __future__ import annotations

import collections
import hashlib
import html
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCR = ROOT / "data/scratch"

START = re.compile(r'^(pembangunan|peningkatan|rehabilitasi|rehab|perbaikan|pemeliharaan|renovasi|penggantian|penataan|normalisasi|penyediaan|lanjutan|pemasangan|pengadaan|pembuatan|pengerukan|pengaspalan)\b', re.I)
EXC = re.compile(r'\b(alat|kantor|rumah tangga|listrik|telepon|internet|kendaraan|makan|minum|atk|seragam|honor|jasa|konsultan|konsultansi|pengawasan|perencanaan|survei|kajian|ded|andalalin|topografi|aplikasi|komputer|obat|bahan|material|sewa|tagihan|upah|perjalanan|rapat|pakaian|meubel|furniture|kimia|reagensia|hpv|biaya|biaya)\b', re.I)
SEKTOR = [
    ("Penerangan & Perhubungan", r'\b(pju|apj|penerangan jalan|lampu jalan|lampu penerangan|tiang lampu|ornamen|rambu|marka|halte|terminal|traffic light|api lalu lintas|speed trap|pita penggaduh|guardrail|parkir)\b'),
    ("Jalan, Jembatan & Drainase", r'\b(jalan|jembatan|drainase|dranase|saluran|trotoar|aspal|hotmix|paving|rabat|talud|turap|gorong|culvert|u-ditch|uditch|betonisasi|box culvert|jalan lingkungan|siring|plat deker|bronjong)\b'),
    ("Permukiman, Air & Sanitasi", r'\b(mck|septik|septic|sanitasi|air bersih|spam|sumur|pdam|ipal|air limbah|jamban|kamar mandi|perumahan|rutilahu|rumah tidak layak|hidran|booster|reservoir)\b'),
    ("Fasilitas Pendidikan", r'\b(sekolah|ruang kelas|sdn|smpn|sd negeri|smp negeri|paud|tk|perpustakaan|laboratorium|rkb|gedung sekolah|mushola sekolah|toilet murid)\b'),
    ("Fasilitas Publik Lainnya", r'\b(irigasi|pasar|posyandu|puskesmas|gedung|balai|taman|lapangan|gor|embung|pintu air|dermaga|kolam retensi|makam|rumah dinas|pendopo|aula)\b'),
]
SEKTOR_P = [(n, re.compile(p, re.I)) for n, p in SEKTOR]

PREFIX = re.compile(r'^(?:desa|ds\.?|kel\.?|kelurahan|kp\.?|kampung|jalan|jl\.?|gang|gg\.?|kec\.?|kecamatan|ruas|dusun|dsn)\s+', re.I)
MARK = re.compile(r'\b(?:Ds|Desa|Kel|Kelurahan)\.?\s+', re.I)
DASH = re.compile(r'\s[-–]\s')
MENUJU = re.compile(r'\b(?:menuju|arah|s/d|sampai)\b', re.I)


def clean(t: str) -> str:
    t = html.unescape(t or "")
    t = re.sub(r'^\s*[\d\.\-\s\]\)]{4,}', '', t)
    t = re.sub(r'^(?:belanja modal|belanja)\s+jalan desa\s*[-–:]\s*', '', t, flags=re.I)
    return re.sub(r'\s+', ' ', t).strip()


ABBR = [(r'\btj\b', 'tanjung'), (r'\bds\b', 'desa'), (r'\bkp\b', 'kampung'),
        (r'\bgg\b', 'gang'), (r'\bjl\b', 'jalan'), (r'\bkec\b', 'kecamatan')]


def norm(s: str) -> str:
    s = PREFIX.sub('', str(s).strip().lower())
    s = re.sub(r'[^a-z0-9 ]', ' ', s).strip()
    for pat, rep in ABBR:
        s = re.sub(pat, rep, s)
    return re.sub(r'\s+', ' ', s).strip()


def load_raw(slug: str, tahun: int) -> list[list]:
    return json.loads((SCR / f"{slug}_{tahun}.json").read_text())["rows"]


def load_gazetteer(slug: str) -> tuple[dict, dict, dict, dict]:
    """desa -> record (kunci dengan & tanpa spasi), kecamatan -> nama asli, kecamatan -> sentroid."""
    path = ROOT / "data" / ("bandung_desa_coords.json" if slug == "bandung_kab"
                            else "tangerang_desa_coords.json")
    src = path if path.exists() else SCR / path.name
    rows = json.loads(src.read_text())
    desa: dict[str, dict] = {}
    for r in rows:
        if r.get("lat") is None:
            continue
        n = norm(r["desa"])
        desa[n] = r
        desa.setdefault(n.replace(" ", ""), r)
    kec: dict[str, dict] = {}
    for r in rows:
        if r.get("lat") is None:
            continue
        k = r["kecamatan"]
        kec.setdefault(k, {"lat_sum": 0.0, "lon_sum": 0.0, "n": 0})
        kec[k]["lat_sum"] += r["lat"]; kec[k]["lon_sum"] += r["lon"]; kec[k]["n"] += 1
    centroid = {k: (v["lat_sum"] / v["n"], v["lon_sum"] / v["n"]) for k, v in kec.items()}
    kec_names = {norm(k): k for k in centroid}
    # gabungan desa + kecamatan (untuk endpoint koridor yang boleh berupa kecamatan)
    places = dict(desa)
    for k, (la, lo) in centroid.items():
        places.setdefault(norm(k), {"desa": k, "kecamatan": k, "id_desa": None,
                                    "lat": la, "lon": lo, "jenis": "kecamatan"})
    return desa, kec_names, centroid, places


def sector_of(nama: str) -> str | None:
    for nama_sektor, pat in SEKTOR_P:
        if pat.search(nama):
            return nama_sektor
    return None


def offset(kode: str, lat: float, lon: float) -> tuple[float, float]:
    """Offset deterministik ±250 m supaya marker satu desa tidak menumpuk."""
    h = hashlib.sha256(kode.encode()).digest()
    dx = (h[0] / 255 - 0.5) * 0.0045 * 2   # ~±250 m pada lintang ini
    dy = (h[1] / 255 - 0.5) * 0.0045 * 2
    return round(lat + dy, 6), round(lon + dx, 6)


def resolve_corridor(nama: str, desa: dict, kecmap: dict):
    """Koridor = penanda koridor dengan satu desa di kiri dan satu desa berbeda di kanan penanda."""
    m = DASH.search(nama) or MENUJU.search(nama)
    if not m:
        return None

    def best(part: str, closest_right: bool) -> dict | None:
        low = " " + re.sub(r'[^a-z0-9 ]', ' ', part.lower()) + " "
        hits = [(low.rfind(f" {k} "), k) for k, r in desa.items()
                if len(k) >= 4 and not r.get("jenis") and f" {k} " in low]
        if not hits:
            return None
        _, k = (max(hits) if closest_right else min(hits))
        return desa[k]

    a, b = best(nama[:m.start()], True), best(nama[m.end():], False)
    if not a or not b or a["id_desa"] == b["id_desa"]:
        return None
    return a, b


def pick_desa(nama: str, desa: dict, kec_names: dict) -> dict | None:
    """Prioritas: nama setelah penanda Ds./Desa/Kel. → nama desa bebas (bukan nama kecamatan)."""
    for m in MARK.finditer(nama):
        tail = re.sub(r'[^a-z0-9 ]', ' ', nama[m.end():].lower())
        tail = re.sub(r'\s+', ' ', tail).strip()
        for key in sorted(desa, key=len, reverse=True):
            if len(key) >= 4 and (tail.startswith(key) or tail.startswith(key.replace(' ', ''))):
                return desa[key]
    low = " " + re.sub(r'[^a-z0-9 ]', ' ', nama.lower()) + " "
    cands = [k for k in desa if len(k) >= 4 and f" {k} " in low and k not in kec_names]
    if cands:
        return desa[max(cands, key=len)]
    return None


def build(slug: str, tahun_list: list[int], out_name: str) -> None:
    rows: list[tuple[int, list]] = []
    for th in tahun_list:
        rows += [(th, r) for r in load_raw(slug, th)]
    desa, kec_lookup, centroid, places = load_gazetteer(slug)

    paket, sektor_cnt, sektor_pagu = [], collections.Counter(), collections.Counter()
    stats = collections.Counter()
    for th, r in rows:
        kode, satker, nama_raw, pagu = r[0], r[1], r[2], int(r[3] or 0)
        nama = clean(nama_raw)
        if not START.match(nama) or EXC.search(nama):
            continue
        sektor = sector_of(nama)
        if not sektor:
            continue
        low = " " + re.sub(r'[^a-z0-9 ]', ' ', nama.lower()) + " "
        kor = resolve_corridor(nama, places, kec_lookup)
        d = pick_desa(nama, desa, kec_lookup)
        rec = {"kode_rup": kode, "tahun": th, "satker": satker, "nama": nama, "pagu": pagu,
               "metode": r[4], "sumber": r[5], "bulan": r[7], "sektor": sektor,
               "lokasi_mikro": nama if re.search(r'\b(Jl|Jalan|Kp|Kampung|RT|RW|Gg|Gang)\b', nama, re.I) else None}
        if kor:
            da, db = kor
            lat = (da["lat"] + db["lat"]) / 2
            lon = (da["lon"] + db["lon"]) / 2
            rec.update({"desa_resmi": da["desa"], "kecamatan_resmi": da["kecamatan"], "id_desa": da["id_desa"],
                        "koridor": {"dari": da["desa"], "ke": db["desa"],
                                    "kecamatan": f"{da['kecamatan']}–{db['kecamatan']}",
                                    "lat_dari": da["lat"], "lon_dari": da["lon"],
                                    "lat_ke": db["lat"], "lon_ke": db["lon"]},
                        "lat": lat, "lon": lon, "presisi_peta": "Garis Koridor"})
            stats["koridor"] += 1
        elif d:
            lat, lon = offset(kode, d["lat"], d["lon"])
            rec.update({"desa_resmi": d["desa"], "kecamatan_resmi": d["kecamatan"],
                        "id_desa": d["id_desa"], "lat": lat, "lon": lon,
                        "presisi_peta": "Desa/Kelurahan"})
            stats["desa"] += 1
        else:
            kfound = [k for k in kec_lookup if len(k) >= 4 and f" {k} " in low]
            if kfound:
                k = kec_lookup[max(kfound, key=len)]
                c = centroid[k]
                lat, lon = offset(kode, c[0], c[1])
                rec.update({"desa_resmi": None, "kecamatan_resmi": k, "id_desa": None,
                            "lat": lat, "lon": lon, "presisi_peta": "Kecamatan"})
                stats["kecamatan"] += 1
            else:
                rec.update({"desa_resmi": None, "kecamatan_resmi": None, "id_desa": None,
                            "lat": None, "lon": None, "presisi_peta": "Kabupaten"})
                stats["kabupaten"] += 1
        paket.append(rec)
        sektor_cnt[sektor] += 1
        sektor_pagu[sektor] += pagu

    terpetakan = len(paket) - stats["kabupaten"]
    out = {
        "produk": "SAKSI",
        "wilayah": slug,
        "diambil": "2026-10-29",
        "tahun_anggaran": tahun_list,
        "total_rup": len(rows),
        "total_paket_fisik": len(paket),
        "ringkasan_sektor": [{"Name": s, "Count": sektor_cnt[s], "TotalPaguMiliar": round(sektor_pagu[s] / 1e9, 2)}
                             for s in sektor_cnt],
        "geocoding_stats": dict(stats),
        "terpetakan": terpetakan,
        "persen_terpetakan": round(terpetakan / len(paket) * 100, 1) if paket else 0,
        "paket": paket,
    }
    dest = ROOT / "data" / out_name
    dest.write_text(json.dumps(out, ensure_ascii=False))
    print(f"{slug}: RUP {len(rows)} → fisik {len(paket)} · sektor {dict(sektor_cnt)}")
    print(f"  presisi: {dict(stats)} · terpetakan {terpetakan} ({out['persen_terpetakan']}%)")
    print(f"  -> {dest}")


if __name__ == "__main__":
    slug = sys.argv[1]
    tahun = [int(x) for x in sys.argv[2:4]]
    build(slug, tahun, f"saksi_{slug.replace('_kab', '')}_2025_2026.json")
