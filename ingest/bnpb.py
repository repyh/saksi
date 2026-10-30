"""BNPB — DataStore CKAN: kejadian & dampak bencana per provinsi.

Halaman dataset di data.bnpb.go.id dilindungi Cloudflare, TAPI API CKAN-nya
terbuka dan resource-nya aktif di DataStore, jadi JSON bisa diambil langsung.
Tahun diekstrak dari dataset yang tersedia; ganti RESOURCE_ID tiap tahun.
"""
from __future__ import annotations

import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from fetch import get_json  # noqa: E402

API = "https://data.bnpb.go.id/api/3/action"
# "Kompilasi Data Kejadian dan Dampak Bencana 2025" -> resource kejadian per provinsi
PKG_2025 = "kompilasi-data-kejadian-dan-dampak-bencana-2025"
RES_KEJADIAN_2025 = "df39e8c3-117e-40fa-b518-ff1037743955"

META = {"_id", "No.", "Kode Wilayah Provinsi", "Provinsi", "Latitude", "Longitude"}


def run() -> None:
    out = pathlib.Path(__file__).resolve().parent / ".cache" / "parsed"
    out.mkdir(parents=True, exist_ok=True)

    listing = get_json(f"{API}/package_list", "bnpb/package_list.json")
    n = len((listing or {}).get("result", []))

    pkg = get_json(f"{API}/package_show?id={PKG_2025}", "bnpb/package_2025.json")
    resources = (pkg or {}).get("result", {}).get("resources", [])

    ds = get_json(
        f"{API}/datastore_search?resource_id={RES_KEJADIAN_2025}&limit=40",
        "bnpb/kejadian_2025.json",
    )
    records = ((ds or {}).get("result") or {}).get("records", [])
    if not records:
        print("! data bencana kosong")
        return

    haz = [k for k in records[0] if k not in META]
    rows = []
    for r in records:
        nama = str(r.get("Provinsi") or "").strip()
        # buang baris agregat (mis. "JUMLAH"/"TOTAL") yang tidak punya kode wilayah
        if not nama or not str(r.get("Kode Wilayah Provinsi") or "").isdigit():
            continue
        if any(k in nama.upper() for k in ("JUMLAH", "TOTAL", "INDONESIA")):
            continue
        rows.append({
            "provinsi": nama,
            "kode_bps": r.get("Kode Wilayah Provinsi"),
            "total": sum(int(r.get(k) or 0) for k in haz),
            "per_jenis": {k: int(r.get(k) or 0) for k in haz},
        })

    payload = {
        "sumber": {
            "nama": "BNPB — Data Informasi Bencana Indonesia (DIBI)",
            "dataset": PKG_2025,
            "resource_id": RES_KEJADIAN_2025,
            "endpoint": f"{API}/datastore_search?resource_id={RES_KEJADIAN_2025}",
            "jumlah_dataset_portal": n,
            "jumlah_resource_dipakai": len(resources),
        },
        "tahun": 2025,
        "provinsi": rows,
        "total_kejadian": sum(r["total"] for r in rows),
    }
    (out / "bencana_2025.json").write_text(json.dumps(payload, ensure_ascii=False, indent=1))
    print(f"bencana: {len(rows)} provinsi, {payload['total_kejadian']:,} kejadian "
          f"| portal punya {n} dataset")


if __name__ == "__main__":
    run()
