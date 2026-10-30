"""Pilot data vendor — LPSE Provinsi DKI Jakarta (SPSE).

Kenapa begini: listing paket di SPSE dimuat via JavaScript dan endpoint DataTables-nya 404,
TAPI **halaman paket individual ter-render server** dan berisi nama pemenang, NPWP, alamat,
pagu, dan HPS. Jadi jalannya: kumpulkan ID paket (halaman depan + daftar ID), lalu ambil
halaman `pemenang` / `pengumumanpl`.

Catatan kejujuran: ini **data pilot** (bukan lengkap nasional). Di UI wajib diberi label
"data pilot — DKI Jakarta, <tahun>".
"""
from __future__ import annotations

import json
import pathlib
import re
import subprocess
import sys
import time
import html as htmlmod

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "data"
UA = "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0"
BASE = "https://spse.inaproc.id/jakarta"
SLEEP = 0.8

# ID paket contoh (dari halaman yang sudah terindeks mesin pencari)
SEEDS = [
    "11011883000", "10997126000", "11096569000", "11056235000",  # pengawasan jalan (Bina Marga)
    "11035639000", "11030879000", "10973858000", "10373042000",  # peningkatan jalan / trotoar
    "10973848000", "165248127", "60624127",
]

LABELS = {
    "nama paket", "satuan kerja", "pagu", "hps", "nama pemenang", "alamat", "npwp",
    "metode pengadaan", "tahun anggaran", "nilai pagu paket", "nilai hps paket",
    "lokasi pekerjaan", "jenis pengadaan", "jenis kontrak",
    "harga penawaran", "harga terkoreksi", "hasil negosiasi", "pengumuman", "peserta",
    "hasil evaluasi", "pemenang", "pemenang berkontrak", "nama non tender", "kode",
    "tahapan", "jadwal", "rencana umum pengadaan", "kode rup", "sumber dana",
    "uraian singkat pekerjaan", "tanggal pembuatan", "tahap paket saat ini",
    "k/l/pd/instansi lainnya", "jenis pengadaan", "khusus orang asli papua (oap)",
    "nilai pagu paket", "nilai hps paket", "jenis kontrak", "syarat kualifikasi",
}


def get(url: str) -> str | None:
    r = subprocess.run(["curl", "-s", "-A", UA, "-m", "40", url], capture_output=True, text=True)
    return r.stdout if r.returncode == 0 and len(r.stdout) > 500 else None


def cells(doc: str) -> list[str]:
    body = re.sub(r"<script.*?</script>", "", doc, flags=re.S)
    body = re.sub(r"<[^>]+>", "|", body)
    body = htmlmod.unescape(body)
    raw = [re.sub(r"\s+", " ", c).strip() for c in body.split("|")]
    return [c for c in raw if c]


def field(tokens: list[str], label: str, max_ahead: int = 4) -> str | None:
    """Ambil nilai pertama setelah label yang bukan label lain."""
    for i, t in enumerate(tokens):
        if t.lower() == label:
            for cand in tokens[i + 1 : i + 1 + max_ahead]:
                if cand.lower() not in LABELS and not cand.lower().startswith("rp. "):
                    return cand
    return None


def rupiah(s: str | None) -> int | None:
    """'Rp. 100.000.000,00' -> 100000000 (format Indonesia)."""
    if not s:
        return None
    m = re.search(r"(\d[\d.]*)", s)
    if not m:
        return None
    bulat = m.group(1).replace(".", "")
    return int(bulat) if bulat.isdigit() else None


def parse(doc: str) -> dict | None:
    t = cells(doc)
    if not t:
        return None
    low = [c.lower() for c in t]

    def val(label: str, ahead: int = 3) -> str | None:
        for i, c in enumerate(low):
            if c == label:
                for cand in t[i + 1 : i + 1 + ahead]:
                    if cand.lower() not in LABELS:
                        return cand
        return None
    # nama paket: token setelah tab "Nama Non Tender" (halaman pemenang) atau setelah "Kode" di header
    name = None
    for anchor in ("Nama Non Tender", "Pemenang Berkontrak"):
        if anchor in t:
            i = t.index(anchor)
            for cand in t[i + 1 : i + 4]:
                if len(cand) > 15 and cand.lower() not in LABELS:
                    name = cand
                    break
    satker = val("satuan kerja") or field(t, "Satuan Kerja")
    vendor = field(t, "Nama Pemenang", max_ahead=8)
    if not vendor:
        # non-tender: vendor muncul setelah blok header "Hasil Negosiasi"
        for i, cand in enumerate(t):
            if cand.lower() == "hasil negosiasi":
                for v in t[i + 1 : i + 4]:
                    if re.match(r"^(PT|CV|UD)\.?\s|[A-Z]{4,}", v) and "Rp" not in v and len(v) > 5:
                        vendor = v
                        break
                break
    rec = {
        "nama_paket": name or val("nama paket"),
        "satuan_kerja": satker,
        "metode": val("metode pengadaan"),
        "tahun": val("tahun anggaran"),
        "pagu": rupiah(val("nilai pagu paket") or val("pagu")),
        "hps": rupiah(val("nilai hps paket") or val("hps")),
        "lokasi": val("lokasi pekerjaan"),
        "pemenang": vendor,
        "alamat": val("alamat"),
    }
    if not rec["pagu"]:
        rec["pagu"] = rupiah(next((c for c in t if c.lower().startswith("rp.")), None))
    return rec if (rec["pemenang"] or rec["nama_paket"]) else None


def harvest_home() -> list[str]:
    doc = get(BASE)
    if not doc:
        return []
    return sorted(set(re.findall(r"/jakarta/(?:evaluasinontender|nontender|lelang)/(\d{8,})", doc)))


def fetch_package(pid: str) -> dict | None:
    """Gabung dua halaman: pengumumanpl (metode/pagu/lokasi) + pemenang (vendor)."""
    merged: dict = {}
    for path in (f"/nontender/{pid}/pengumumanpl",
                 f"/evaluasinontender/{pid}/pemenang",
                 f"/evaluasinontender/{pid}/pemenangberkontrak"):
        doc = get(BASE + path)
        time.sleep(SLEEP)
        if not doc:
            continue
        rec = parse(doc) or {}
        for k, v in rec.items():
            if v not in (None, "", 0) and k not in merged:
                merged[k] = v
        merged.setdefault("sumber", BASE + path)
    if not merged.get("nama_paket") and not merged.get("pemenang"):
        return None
    for k in ("nama_paket", "satuan_kerja", "metode", "tahun", "pagu", "hps", "lokasi", "pemenang", "alamat"):
        merged.setdefault(k, None)
    merged["id"] = pid
    return merged


def main() -> None:
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    ids = list(dict.fromkeys(SEEDS))[:limit]
    print(f"kandidat paket: {len(ids)}")
    rows = []
    for i, pid in enumerate(ids, 1):
        rec = fetch_package(pid)
        if not rec:
            print(f"  [{i}/{len(ids)}] {pid}: gagal")
            continue
        rows.append(rec)
        print(f"  [{i}/{len(ids)}] {pid}: {(rec.get('pemenang') or '-')[:32]:<32} | {(rec.get('nama_paket') or '-')[:58]}")

    jalan = [r for r in rows if re.search(r"jalan|trotoar|drainase|jembatan|aspal|beton",
                                           (r.get("nama_paket") or ""), re.I)]
    payload = {
        "sumber": {
            "nama": "LPSE Provinsi DKI Jakarta (SPSE)",
            "basis": BASE,
            "cara": "halaman paket individual (server-rendered); listing berbasis JavaScript tidak dapat diambil",
            "keterangan": "DATA PILOT — bukan sensus pengadaan. Hanya paket yang ID-nya berhasil dikumpulkan.",
        },
        "diambil": time.strftime("%Y-%m-%d"),
        "jumlah": {"kandidat": len(ids), "terbaca": len(rows), "jalan": len(jalan)},
        "paket": rows,
    }
    OUT.mkdir(exist_ok=True)
    (OUT / "vendor_jakarta.json").write_text(json.dumps(payload, ensure_ascii=False, indent=1))
    print(f"\nterbaca {len(rows)} paket, {len(jalan)} di antaranya jalan/trotoar/drainase → data/vendor_jakarta.json")


if __name__ == "__main__":
    main()
