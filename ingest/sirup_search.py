#!/usr/bin/env python3
"""Tarik RUP dari SIRUP Inaproc lewat endpoint pencarian paket (tanpa login).

Endpoint: GET /sirup/caripaketctr/search
  - parameter wajib: tahunAnggaran, draw, start, length
  - filter: kldi=<idKldi> (mis. D50 = Kab. Tangerang), search[value]=<kata kunci>
  - respons JSON: data[] memuat idKldi, kldi, lokasi, satuanKerja, paket, pagu,
    jenisPengadaan, metode, pemilihan (bulan), sumberDana
  - recordsTotal/recordsFiltered tersedia untuk paginasi

Berbeda dari /sirup/datatablectr/dataruppenyediakldi (8 kolom tanpa lokasi),
endpoint ini memberi kolom `lokasi` dan `jenisPengadaan` sekaligus.

Usage:
  python3 ingest/sirup_search.py cari "Kota Tangerang" 2026
  python3 ingest/sirup_search.py tarik D50 2025 data/scratch/tangerang_2025.json
"""
from __future__ import annotations

import json
import pathlib
import sys
import time
import urllib.parse
import urllib.request

UA = "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0"
BASE = "https://sirup.inaproc.id/sirup/caripaketctr/search"
COLS = {
    1: "paket", 2: "pagu", 3: "jenisPengadaan", 4: "isPDN", 5: "isUMK",
    6: "metode", 7: "pemilihan", 8: "kldi", 9: "satuanKerja", 10: "lokasi", 11: "id",
}


def _get(params: dict) -> dict:
    q = {
        "tahunAnggaran": params.pop("tahun"),
        "draw": 1,
        "start": params.pop("start", 0),
        "length": params.pop("length", 10),
        "search[value]": params.pop("search", ""),
        "search[regex]": "false",
    }
    for i, name in COLS.items():
        q[f"columns[{i}][data]"] = name
        q[f"columns[{i}][searchable]"] = "true"
        q[f"columns[{i}][orderable]"] = "true"
        q[f"columns[{i}][search][value]"] = ""
        q[f"columns[{i}][search][regex]"] = "false"
    q["order[0][column]"] = 11
    q["order[0][dir]"] = "desc"
    q.update(params)
    url = BASE + "?" + urllib.parse.urlencode(q)
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "X-Requested-With": "XMLHttpRequest",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Referer": "https://sirup.inaproc.id/sirup/caripaketctr/index",
    })
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode())


def cari(kata: str, tahun: int) -> None:
    res = _get({"tahun": tahun, "search": kata, "length": 200})
    seen: dict[str, list] = {}
    for row in res["data"]:
        seen.setdefault(row["idKldi"], [row["kldi"], 0])[1] += 1
    print(f"recordsFiltered={res['recordsFiltered']} untuk '{kata}' TA{tahun}")
    for kldi, (nama, n) in sorted(seen.items(), key=lambda kv: kv[1][0]):
        print(f"  {kldi:>5}  {nama:<45} (≥{n} di 200 baris pertama)")


def tarik(kldi: str, tahun: int, out: pathlib.Path, page: int = 20000) -> None:
    rows: list[dict] = []
    start = 0
    total = None
    while total is None or start < total:
        res = _get({"tahun": tahun, "kldi": kldi, "start": start, "length": page})
        total = res["recordsFiltered"]
        batch = res["data"]
        if not batch:
            break
        rows.extend(batch)
        start += len(batch)
        print(f"  {kldi} TA{tahun}: {start}/{total}", flush=True)
        if len(batch) < page:
            break
        time.sleep(1)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"tahun": tahun, "idKldi": kldi, "jumlah": len(rows),
                               "recordsFiltered": total, "paket": rows},
                              ensure_ascii=False))
    print(f"-> {out} ({len(rows)} baris)")


if __name__ == "__main__":
    if len(sys.argv) < 4:
        raise SystemExit(__doc__)
    mode, arg, tahun = sys.argv[1], sys.argv[2], int(sys.argv[3])
    if mode == "cari":
        cari(arg, tahun)
    elif mode == "tarik":
        tarik(arg, tahun, pathlib.Path(sys.argv[4]))
    else:
        raise SystemExit(__doc__)
