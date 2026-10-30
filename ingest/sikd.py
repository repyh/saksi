"""SIKD DJPK Kemenkeu — APBD per pemda per periode.

CATATAN KRITIS: portal ini memakai kode provinsi INTERNAL 01-38 (urut abjad),
bukan kode BPS. Memakai kode BPS (51, 52, ...) menghasilkan HTTP 500.
Karena itu join ke sumber lain WAJIB lewat nama provinsi, bukan kode.
"""
from __future__ import annotations

import json
import pathlib
import sys
import xml.etree.ElementTree as ET

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from fetch import get  # noqa: E402

BASE = "https://djpk.kemenkeu.go.id/portal/csv_apbd?type=apbd&periode={p}&tahun={y}&provinsi={prov}&pemda=--"

PROV = {
    "01": "Aceh", "02": "Sumatera Utara", "03": "Sumatera Barat", "04": "Riau",
    "05": "Jambi", "06": "Sumatera Selatan", "07": "Bengkulu", "08": "Lampung",
    "09": "DKI Jakarta", "10": "Jawa Barat", "11": "Jawa Tengah", "12": "DI Yogyakarta",
    "13": "Jawa Timur", "14": "Kalimantan Barat", "15": "Kalimantan Tengah",
    "16": "Kalimantan Selatan", "17": "Kalimantan Timur", "18": "Sulawesi Utara",
    "19": "Sulawesi Tengah", "20": "Sulawesi Selatan", "21": "Sulawesi Tenggara",
    "22": "Bali", "23": "Nusa Tenggara Barat", "24": "Nusa Tenggara Timur",
    "25": "Maluku", "26": "Papua", "27": "Maluku Utara", "28": "Banten",
    "29": "Bangka Belitung", "30": "Gorontalo", "31": "Kepulauan Riau",
    "32": "Papua Barat", "33": "Sulawesi Barat", "34": "Kalimantan Utara",
    "35": "Papua Selatan", "36": "Papua Tengah", "37": "Papua Pegunungan",
    "38": "Papua Barat Daya",
}

PERIODS = (3, 6, 9, 12)


def parse_rows(xml_text: str) -> dict[str, list[float | None]]:
    """Kembalikan {label: [pagu, realisasi, persen]}.

    Cell SpreadsheetML menyimpan teks di elemen <Data> bersarang, jadi
    `cell.text` kosong — harus pakai itertext().
    """
    root = ET.fromstring(xml_text)
    out: dict[str, list[float | None]] = {}
    for row in root.iter():
        if row.tag.split("}")[-1] != "Row":
            continue
        cells = ["".join(c.itertext()).strip() for c in row]
        if not cells or not cells[0]:
            continue
        nums: list[float | None] = []
        for t in cells[1:4]:
            t = t.replace("\u00a0", "").strip()
            try:
                nums.append(float(t))
            except ValueError:
                # format Indonesia: 1.234.567,89
                try:
                    nums.append(float(t.replace(".", "").replace(",", ".")))
                except ValueError:
                    nums.append(None)
        out.setdefault(cells[0], nums + [None] * (3 - len(nums)))
    return out


def fetch_period(period: int, prov: str = "--", year: int = 2025) -> dict | None:
    name = f"sikd/{'nasional' if prov == '--' else 'prov_' + prov}_p{period}_{year}.xml"
    body = get(BASE.format(p=period, y=year, prov=prov), name)
    if not body or "<Row>" not in body:
        return None
    try:
        return parse_rows(body)
    except ET.ParseError:
        return None


def account(rows: dict, label: str) -> dict:
    pagu, real, pct = (rows.get(label) or [None, None, None])[:3]
    return {"pagu": pagu, "realisasi": real, "persen": pct}


AKUN = ["Belanja Daerah", "Belanja Modal", "Belanja Barang dan Jasa",
        "Belanja Pegawai", "Belanja Tidak Terduga"]


def run(provinces: list[str] | None = None) -> None:
    out = pathlib.Path(__file__).resolve().parent / ".cache" / "parsed"
    out.mkdir(parents=True, exist_ok=True)
    codes = provinces or list(PROV)

    for p in PERIODS:
        rows = fetch_period(p)
        data = {"periode": p, "akun": {a: account(rows or {}, a) for a in AKUN}}
        (out / f"nasional_p{p}.json").write_text(json.dumps(data, ensure_ascii=False, indent=1))
        print(f"nasional p{p}: " + ", ".join(
            f"{a.split()[-1]}={data['akun'][a]['persen']}" for a in AKUN))

    for code in codes:
        rec = {"kode": code, "nama": PROV[code], "periode": {}}
        ok = False
        for p in (6, 9, 12):
            rows = fetch_period(p, code)
            if rows:
                rec["periode"][p] = {a: account(rows, a) for a in AKUN}
                ok = True
        if ok:
            (out / f"prov_{code}.json").write_text(json.dumps(rec, ensure_ascii=False, indent=1))
            print(f"  {code} {PROV[code]}: {len(rec['periode'])} periode")
    print("selesai. cache di", out)


if __name__ == "__main__":
    args = sys.argv[1:]
    if args and args[0] == "--only":
        lo, hi = args[1], args[2]
        run([c for c in PROV if lo <= c <= hi])
    else:
        run()
