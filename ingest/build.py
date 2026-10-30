"""Gabungkan hasil ingest menjadi JSON untuk web.

Output: data/nasional.json, data/provinsi.json, data/manifest.json
Semua angka dihitung di sini — web tidak menghitung apa pun.
"""
from __future__ import annotations

import json
import pathlib
import statistics
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = ROOT / "ingest" / ".cache" / "parsed"
DATA = ROOT / "data"

SUMBER = {
    "sikd": {
        "nama": "SIKD — DJPK Kementerian Keuangan",
        "endpoint": "https://djpk.kemenkeu.go.id/portal/csv_apbd?type=apbd&periode={3,6,9,12}&tahun=2025&provinsi={01-38}&pemda=--",
        "format": "XML SpreadsheetML (CSV)",
        "keterangan": "Pagu, realisasi, dan persentase per akun belanja, per periode kumulatif.",
    },
    "bnpb": {
        "nama": "BNPB — DIBI (Data Informasi Bencana Indonesia)",
        "endpoint": "https://data.bnpb.go.id/api/3/action/datastore_search?resource_id=df39e8c3-117e-40fa-b518-ff1037743955",
        "format": "JSON (CKAN DataStore)",
        "keterangan": "Jumlah kejadian bencana per provinsi per jenis, tahun 2025.",
    },
}


def load(name: str):
    p = CACHE / name
    return json.loads(p.read_text()) if p.exists() else None


def pct(rec: dict, akun: str, periode: int, field: str = "persen"):
    return ((rec.get("periode", {}).get(str(periode)) or {}).get(akun) or {}).get(field)


def main() -> None:
    DATA.mkdir(exist_ok=True)
    tarik = time.strftime("%Y-%m-%d")

    # ---------- nasional ----------
    kurva = []
    for p in (3, 6, 9, 12):
        rec = load(f"nasional_p{p}.json")
        if rec:
            kurva.append({"periode": p, "akun": rec["akun"]})
    nasional = load("nasional_p12.json") or {}

    # turunan: nilai kuartal IV = realisasi setahun - realisasi s.d. September
    q4_deriv = {}
    for akun, v in (nasional.get("akun") or {}).items():
        p9 = ((load("nasional_p9.json") or {}).get("akun") or {}).get(akun) or {}
        if v.get("pagu") and p9.get("persen") is not None and v.get("realisasi"):
            real9 = v["pagu"] * p9["persen"] / 100
            q4 = v["realisasi"] - real9
            q4_deriv[akun] = {
                "nilai": q4,
                "porsi_realisasi": round(q4 / v["realisasi"] * 100, 2),
                "persen_sd_september": p9["persen"],
            }

    nas = {
        "kuartal4": q4_deriv,
        "tahun": 2025,
        "sumber": SUMBER["sikd"],
        "tarik": tarik,
        "akun_setahun": nasional.get("akun", {}),
        "kurva": kurva,
    }

    # ---------- provinsi ----------
    bencana = load("bencana_2025.json") or {}
    bmap = {b["provinsi"].upper(): b for b in bencana.get("provinsi", [])}
    alias = {
        "DKI JAKARTA": "DKI JAKARTA", "DI YOGYAKARTA": "DAERAH ISTIMEWA YOGYAKARTA",
        "BANGKA BELITUNG": "KEPULAUAN BANGKA BELITUNG",
    }

    prov = []
    for f in sorted(CACHE.glob("prov_*.json")):
        rec = json.loads(f.read_text())
        nama = rec["nama"]
        pagu = pct(rec, "Belanja Daerah", 12, "pagu")
        real = pct(rec, "Belanja Daerah", 12, "realisasi")
        if not pagu or not real:
            continue
        bkey = (alias.get(nama.upper()) or nama.upper())
        b = bmap.get(bkey) or next(
            (v for k, v in bmap.items() if bkey.split()[0] in k and len(bkey.split()) == 1), None)

        # Indeks Desember (porsi realisasi setahun yang jatuh di Q4)
        def indeks(akun: str):
            r9, r12 = pct(rec, akun, 9, "realisasi"), pct(rec, akun, 12, "realisasi")
            if not r9 or not r12:
                return None
            return round((r12 - r9) / r12 * 100, 2)

        prov.append({
            "kode": rec["kode"],
            "nama": nama,
            "pagu": pagu,
            "realisasi": real,
            "persen": round(real / pagu * 100, 2),
            "sisa": pagu - real,
            "modal_persen": pct(rec, "Belanja Modal", 12),
            "modal_persen_h1": pct(rec, "Belanja Modal", 6),
            "indeks_desember": indeks("Belanja Daerah"),
            "indeks_desember_modal": indeks("Belanja Modal"),
            "btt": {
                "pagu": pct(rec, "Belanja Tidak Terduga", 12, "pagu"),
                "realisasi": pct(rec, "Belanja Tidak Terduga", 12, "realisasi"),
                "persen": pct(rec, "Belanja Tidak Terduga", 12),
                "persen_h1": pct(rec, "Belanja Tidak Terduga", 6),
            },
            "bencana": {
                "total": (b or {}).get("total"),
                "per_jenis": (b or {}).get("per_jenis"),
            } if b else None,
        })

    # kuadran: risiko tinggi (bencana >= median) & serapan BTT rendah (<= median)
    punya = [p for p in prov if p["bencana"] and p["btt"]["persen"] is not None]
    if punya:
        med_b = statistics.median(p["bencana"]["total"] for p in punya)
        med_s = statistics.median(p["btt"]["persen"] for p in punya)
        for p in prov:
            if p["bencana"] and p["btt"]["persen"] is not None:
                p["kuadran"] = {
                    "risiko_tinggi": p["bencana"]["total"] >= med_b,
                    "serapan_rendah": p["btt"]["persen"] <= med_s,
                }
        med = {"bencana": med_b, "btt_persen": med_s}
    else:
        med = None

    t_btt_pagu = sum(p["btt"]["pagu"] or 0 for p in prov)
    t_btt_real = sum(p["btt"]["realisasi"] or 0 for p in prov)

    ringkas = {
        "tarik": tarik,
        "jumlah_provinsi": len(prov),
        "pagu_total": sum(p["pagu"] for p in prov),
        "realisasi_total": sum(p["realisasi"] for p in prov),
        "sisa_total": sum(p["sisa"] for p in prov),
        "btt_pagu_total": t_btt_pagu,
        "btt_realisasi_total": t_btt_real,
        "btt_persen_total": round(t_btt_real / t_btt_pagu * 100, 2) if t_btt_pagu else None,
        "bencana_total": bencana.get("total_kejadian"),
        "median": med,
    }

    (DATA / "nasional.json").write_text(json.dumps(nas, ensure_ascii=False, indent=1))
    (DATA / "provinsi.json").write_text(json.dumps(
        {"sumber": [SUMBER["sikd"], SUMBER["bnpb"]], "tarik": tarik,
         "ringkas": ringkas, "provinsi": prov}, ensure_ascii=False, indent=1))

    manifest = {
        "produk": "SOROT",
        "versi_data": time.strftime("%Y%m%d"),
        "ditarik": tarik,
        "tahun_anggaran": 2025,
        "sumber": [SUMBER["sikd"], SUMBER["bnpb"]],
        "jumlah": {"provinsi": len(prov), "kurva_periode": len(kurva),
                   "kejadian_bencana": bencana.get("total_kejadian")},
        "peringatan": [
            "SIKD memakai kode provinsi internal 01-38, bukan kode BPS; join dilakukan lewat nama.",
            "Angka adalah snapshot hasil tarik, bukan aliran waktu nyata.",
            "Belanja tidak terduga yang tidak terserap bukan bukti pemborosan.",
        ],
    }
    (DATA / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1))

    print(f"provinsi: {len(prov)} | kurva: {len(kurva)} titik")
    print(f"pagu {ringkas['pagu_total']/1e12:.2f} T | realisasi {ringkas['realisasi_total']/1e12:.2f} T "
          f"({ringkas['realisasi_total']/ringkas['pagu_total']*100:.2f}%)")
    print(f"BTT {t_btt_real/1e12:.2f} T / {t_btt_pagu/1e12:.2f} T = {ringkas['btt_persen_total']}%")
    print(f"bencana: {ringkas['bencana_total']} kejadian | median: {med}")
    if prov:
        mod = nasional.get("akun", {}).get("Belanja Modal", {})
        if mod.get("realisasi"):
            q4 = mod["realisasi"] * (1 - (mod.get("persen_p9") or 0) / 100)
            print(f"modal: realisasi {mod['realisasi']/1e12:.2f} T, persen {mod['persen']}")


if __name__ == "__main__":
    main()
