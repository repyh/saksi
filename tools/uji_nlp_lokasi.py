#!/usr/bin/env python3
"""Uji: bisakah NLP menyelamatkan paket yang gagal dipetakan ke desa?

Populasi uji: paket fisik Kab. Bandung yang **tidak** cocok kamus desa/kecamatan (18,3% → 982 paket).
Empat lengan diukur pada sampel yang sama:
  A. baseline   : pencocokan gazetteer persis (0% menurut definisi — ini populasi uji)
  B. fuzzy      : kemiripan string tanpa LLM (typo/varian nama desa)
  C. LLM+gazet  : model mengekstrak nama tempat, divalidasi tertutup ke 280 desa/31 kecamatan
  D. LLM+OSM    : nama tempat hasil model yang gagal di gazetteer dicari di Nominatim (OSM) di dalam
                  kotak Kab. Bandung; berhasil bila hasilnya memuat nama desa/kelurahan gazetteer

Catatan operasional: Groq gratis membatasi laju (~15–20 permintaan/menit untuk gpt-oss), jadi
permintaan dijalankan berurutan dengan jeda tetap + retry panjang. Checkpoint ditulis per batch agar
hasil parsial tidak hilang kalau proses mati.

Usage: python3 tools/uji_nlp_lokasi.py [n_sampel] [model]
"""
from __future__ import annotations

import difflib
import html
import json
import pathlib
import random
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCRATCH = ROOT / "data/scratch"
ENV = pathlib.Path.home() / ".hermes/.env"
UA = "saksi-uji-nlp/1.0 (riset lomba mahasiswa; kontak: topher)"
LLM_URL = "https://api.groq.com/openai/v1/chat/completions"
OSM_URL = "https://nominatim.openstreetmap.org/search"
BANDUNG_VIEWBOX = "106.85,-7.45,108.10,-6.75"   # kiri-atas, kanan-bawah (lon,lat)

START = re.compile(r'^(pembangunan|peningkatan|rehabilitasi|rehab|perbaikan|pemeliharaan|renovasi|penggantian|penataan|normalisasi|penyediaan|lanjutan|pemasangan|pengadaan|pembuatan)\b', re.I)
EXC = re.compile(r'\b(alat|kantor|rumah tangga|listrik|telepon|internet|kendaraan|makan|minum|atk|seragam|honor|jasa|konsultan|konsultansi|pengawasan|perencanaan|survei|kajian|ded|andalalin|topografi|aplikasi|komputer|obat|bahan|material|sewa|tagihan|upah|perjalanan|rapat|pakaian|meubel|furniture)\b', re.I)
PREFIX = re.compile(r'^(?:desa|ds\.?|kel\.?|kelurahan|kp\.?|kampung|jalan|jl\.?|gang|gg\.?|kec\.?|kecamatan|ruas|dusun|dsn)\s+', re.I)
PROMPT = (
    "Kamu mengekstrak nama lokasi dari judul paket pengadaan barang/jasa pemerintah Indonesia.\n"
    "Sebutkan HANYA nama tempat/patokan yang benar-benar tertulis di judul — kampung, jalan, gang, "
    "sekolah, gedung, masjid, pasar, atau nomor RT/RW. Jangan mengarang, jangan menambah nama desa "
    "yang tidak tertulis, dan jangan menyalin kata dari instruksi ini.\n"
    "Balas HANYA JSON: {\"tempat\": [\"...\"], \"jenis\": \"jalan|drainase|jembatan|gedung|sekolah|"
    "air|lainnya\", \"sektor\": \"jalan|permukiman|pendidikan|pju|fasilitas\", \"yakin\": 0.0}\n"
    "Jika tidak ada tempat yang disebut, balas {\"tempat\": [], \"jenis\": \"lainnya\", "
    "\"sektor\": \"fasilitas\", \"yakin\": 0.0}."
)


def clean(t: str) -> str:
    t = html.unescape(t or "")
    t = re.sub(r'^\s*[\d\.\-\s\]\)]{4,}', '', t)
    t = re.sub(r'^(?:belanja modal|belanja)\s+jalan desa\s*[-–:]\s*', '', t, flags=re.I)
    return re.sub(r'\s+', ' ', t).strip()


def norm(s: str) -> str:
    s = PREFIX.sub('', str(s).strip().lower())
    s = re.sub(r'^(?:jl|jalan|kp|kampung|ds|desa|kel|kelurahan|gg|gang)\.?\s*', '', s)
    return re.sub(r'[^a-z0-9 ]', ' ', s).strip()


def load_bandung() -> list[dict]:
    rows = []
    for th in (2025, 2026):
        rows += json.loads((SCRATCH / f"bandung_kab_{th}.json").read_text())["rows"]
    return [{"kode": r[0], "satker": r[1], "nama": clean(r[2]), "pagu": int(r[3] or 0)}
            for r in rows if START.match(clean(r[2])) and not EXC.search(clean(r[2]))]


def gazetteer():
    d = json.loads((ROOT / "data/bandung_desa_coords.json").read_text())
    desa = {e["desa"].strip().lower(): e["kecamatan"].strip().lower() for e in d}
    kec = {e["kecamatan"].strip().lower() for e in d}
    return desa, kec


def exact_hit(text: str, desa: dict, kec: set) -> bool:
    flat = " " + re.sub(r'[^a-z0-9 ]', ' ', text.lower()) + " "
    return any(len(x) >= 4 and f" {x} " in flat for x in list(desa) + list(kec))


def fuzzy_lookup(name: str, desa: dict) -> str | None:
    """Cocokkan satu nama tempat (bersih) ke gazetteer: persis, lalu mirip."""
    n = norm(name)
    if not n or n in {"resmi tinggal", "kabupaten", "kab bandung", "bandung"}:
        return None
    if n in desa:
        return n
    cands = [x for x in desa if len(x) >= 4]
    best = difflib.get_close_matches(n, cands, n=1, cutoff=0.87)
    if best:
        return best[0]
    last = n.split()[-1]
    if len(last) >= 5:
        best = difflib.get_close_matches(last, cands, n=1, cutoff=0.9)
        if best:
            return best[0]
    return None


def read_key() -> str:
    for line in ENV.read_text(errors="ignore").splitlines():
        m = re.match(r'\s*(?:export\s+)?GROQ_API_KEY\s*=\s*["\']?([^"\'\s#]+)', line)
        if m:
            return m.group(1)
    raise SystemExit("GROQ_API_KEY tidak ada")


def llm(key: str, model: str, judul: str, attempt: int = 0) -> dict:
    payload = {"model": model, "temperature": 0,
               "messages": [{"role": "system", "content": PROMPT},
                            {"role": "user", "content": judul}]}
    if attempt < 2:
        payload["response_format"] = {"type": "json_object"}
    req = urllib.request.Request(LLM_URL, data=json.dumps(payload).encode(), headers={
        "Authorization": f"Bearer {key}", "Content-Type": "application/json", "User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            j = json.loads(r.read().decode())
        txt = j["choices"][0]["message"]["content"].strip()
        txt = re.sub(r'^```(?:json)?|```$', '', txt).strip()
        return json.loads(txt)
    except urllib.error.HTTPError as e:
        if e.code in (400, 429, 500, 502, 503) and attempt < 6:
            time.sleep(4 * (attempt + 1))
            return llm(key, model, judul, attempt + 1)
        return {"error": f"HTTP {e.code}"}
    except Exception as e:  # noqa: BLE001
        if attempt < 4:
            time.sleep(2 * (attempt + 1))
            return llm(key, model, judul, attempt + 1)
        return {"error": type(e).__name__}


def osm_lookup(tempat: str, desa: dict) -> str | None:
    """Lengan D: cari nama tempat di OSM dalam kotak Kab. Bandung, lihat desa yang dilaporkan."""
    q = {"q": f"{tempat}, Kabupaten Bandung", "format": "jsonv2", "limit": 3,
         "addressdetails": 1, "viewbox": BANDUNG_VIEWBOX, "bounded": 1}
    req = urllib.request.Request(OSM_URL + "?" + urllib.parse.urlencode(q),
                                 headers={"User-Agent": UA, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=45) as r:
            hits = json.loads(r.read().decode())
    except Exception:  # noqa: BLE001
        return None
    time.sleep(1.1)  # kebijakan Nominatim: maksimal 1 permintaan/detik
    for h in hits:
        addr = h.get("address") or {}
        for key in ("village", "hamlet", "suburb", "town", "city_district", "municipality"):
            v = (addr.get(key) or "").strip().lower()
            if v and fuzzy_lookup(v, desa):
                return fuzzy_lookup(v, desa)
    return None


def main() -> None:
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 100
    model = sys.argv[2] if len(sys.argv) > 2 else "openai/gpt-oss-20b"
    desa, kec = gazetteer()
    fisik = load_bandung()
    residue = [r for r in fisik if not exact_hit(r["nama"], desa, kec)]
    random.seed(42)
    sample = random.sample(residue, min(n, len(residue)))
    print(f"fisik {len(fisik)} · gagal cocok {len(residue)} ({len(residue)/len(fisik)*100:.1f}%) · sampel {len(sample)}", flush=True)

    b_hit = [(s["nama"], d) for s in sample if (d := fuzzy_lookup(s["nama"], desa))]
    print(f"B fuzzy        : {len(b_hit)}/{len(sample)} selamat ({len(b_hit)/len(sample)*100:.1f}%)", flush=True)

    key = read_key()
    out: list[dict] = []
    ckpt = SCRATCH / "uji_nlp_checkpoint.json"
    t0 = time.time()
    for i, s in enumerate(sample, 1):
        res = llm(key, model, s["nama"])
        tempat = res.get("tempat") or []
        valid = [v for t in tempat if (v := fuzzy_lookup(t, desa))]
        invalid = [t for t in tempat if not fuzzy_lookup(t, desa)]
        out.append({**s, "llm": res, "valid": valid, "invalid": invalid})
        if i % 10 == 0:
            ckpt.write_text(json.dumps(out, ensure_ascii=False))
            print(f"  …{i}/{len(sample)} ({time.time()-t0:.0f}s) error={sum(1 for o in out if 'error' in (o['llm'] or {}))}", flush=True)
        time.sleep(3.5)

    errs = [o for o in out if "error" in (o["llm"] or {})]
    c_hit = [o for o in out if o["valid"]]
    bad = sum(len(o["invalid"]) for o in out)
    tot = bad + sum(len(o["valid"]) for o in out)
    print(f"C LLM+gazetteer: {len(c_hit)}/{len(sample)} selamat ({len(c_hit)/len(sample)*100:.1f}%)"
          f" · error {len(errs)} · token tervalidasi {tot-bad}/{tot}", flush=True)

    # Lengan D — hanya nama yang gagal divalidasi gazetteer, maks 25 kueri OSM
    cand: list[tuple[str, dict]] = []
    for o in out:
        for t in o["invalid"]:
            if len(cand) < 25:
                cand.append((t, o))
    d_hit = []
    for t, o in cand:
        v = osm_lookup(t, desa)
        if v:
            d_hit.append({"tempat": t, "desa": v, "nama": o["nama"]})
    print(f"D LLM+OSM      : {len(d_hit)}/{len(cand)} kueri OSM berhasil resolve ke desa gazetteer", flush=True)

    hasil = {"model": model, "n": len(sample), "fisik": len(fisik), "gagal": len(residue),
             "fuzzy": len(b_hit), "llm_selamat": len(c_hit), "llm_error": len(errs),
             "token_valid": tot - bad, "token_total": tot, "osm_kueri": len(cand),
             "osm_selamat": len(d_hit), "osm": d_hit, "baris": out}
    (SCRATCH / "uji_nlp_hasil.json").write_text(json.dumps(hasil, ensure_ascii=False, indent=1))
    print("->", SCRATCH / "uji_nlp_hasil.json")
    print("\ncontoh ekstraksi model:")
    for o in [x for x in out if (x["llm"].get("tempat"))][:10]:
        print(f"  · {o['nama'][:80]}")
        print(f"      tempat={o['llm'].get('tempat')} valid={o['valid']} invalid={o['invalid']}")
    for h in d_hit[:6]:
        print(f"  OSM: {h['tempat']} → desa {h['desa']}  ({h['nama'][:60]})")


if __name__ == "__main__":
    main()
