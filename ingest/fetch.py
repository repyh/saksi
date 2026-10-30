"""Utilitas fetch ber-cache untuk semua sumber SOROT.

Prinsip: setiap respons mentah disimpan di ingest/.cache/ supaya
(1) ingest bisa dijalankan ulang tanpa membebani server pemerintah,
(2) angka bisa direproduksi persis seperti saat ditarik,
(3) kegagalan di tengah proses tidak menghilangkan hasil sebelumnya.
"""
from __future__ import annotations

import json
import pathlib
import time
import urllib.request

UA = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0",
    "Referer": "https://djpk.kemenkeu.go.id/portal/data/apbd",
}
CACHE = pathlib.Path(__file__).resolve().parent / ".cache"
SLEEP = 0.7


def _path(name: str) -> pathlib.Path:
    p = CACHE / name
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


def get(url: str, name: str, *, tries: int = 3, sleep: float = SLEEP, force: bool = False) -> str | None:
    """Ambil URL, simpan ke cache dengan nama `name`. Kembalikan teks atau None."""
    p = _path(name)
    if p.exists() and not force:
        return p.read_text(encoding="utf-8", errors="ignore")
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=45) as r:
                body = r.read().decode("utf-8", errors="ignore")
            p.write_text(body, encoding="utf-8")
            time.sleep(sleep)
            return body
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(1.5 * (i + 1))
    print(f"  ! gagal {name}: {last}")
    return None


def get_json(url: str, name: str, **kw) -> dict | None:
    body = get(url, name, **kw)
    if body is None:
        return None
    try:
        return json.loads(body)
    except json.JSONDecodeError:
        print(f"  ! bukan JSON: {name}")
        return None


def manifest_stamp() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z")
