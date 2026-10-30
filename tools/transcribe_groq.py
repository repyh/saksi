#!/usr/bin/env python3
"""Transkripsi Groq Whisper dengan model pilihan + pemotongan + prompt domain.

Berbeda dari skill default (turbo, satu request, tanpa prompt):
- model bisa dipilih (`whisper-large-v3` lebih akurat, lebih lambat);
- audio dinormalkan (mono 16 kHz + loudnorm) sebelum dikirim;
- dipotong per N detik lalu digabung, karena Whisper cenderung membuang
  segmen pelan pada rekaman ruangan yang panjang;
- `prompt` memasok istilah domain (SIRUP, LPSE, IRI, Bina Marga, dsb.) agar
  singkatan tidak ditebak jadi kata lain.

Usage: python3 transcribe_groq.py <audio> <out_dir> [model] [chunk_seconds]
"""
from __future__ import annotations

import json
import pathlib
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request

ENV = pathlib.Path.home() / ".hermes/.env"
UA = "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0"
ENDPOINT = "https://api.groq.com/openai/v1/audio/transcriptions"
PROMPT = (
    "Rekaman bimbingan lomba web di Indonesia. Istilah: SIRUP, LPSE, SPSE, Inaproc, RUP, "
    "APBD, pagu anggaran, Bina Marga, IRI, kemantapan jalan, OpenStreetMap, Google Maps, "
    "geocoding, dashboard, layer, overlay, visualisasi, inferensi, vendor, kontraktor, "
    "masa pemeliharaan, Kecamatan, Kabupaten Bandung, Tangerang, proposal, GitHub."
)


def read_key() -> str:
    for line in ENV.read_text(errors="ignore").splitlines():
        m = re.match(r'\s*(?:export\s+)?GROQ_API_KEY\s*=\s*["\']?([^"\'\s#]+)', line)
        if m:
            return m.group(1)
    raise SystemExit(f"GROQ_API_KEY tidak ada di {ENV}")


def prep(src: pathlib.Path, work: pathlib.Path) -> pathlib.Path:
    out = work / "prep.wav"
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-i", str(src), "-ac", "1", "-ar", "16000",
         "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", str(out)],
        check=True)
    return out


def chunks(wav: pathlib.Path, work: pathlib.Path, size: int) -> list[tuple[pathlib.Path, float]]:
    total = float(subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", str(wav)],
        capture_output=True, text=True, check=True).stdout.strip())
    out = []
    start = 0.0
    i = 0
    while start < total:
        p = work / f"part{i:02d}.wav"
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", f"{start}", "-t", str(size),
                        "-i", str(wav), str(p)], check=True)
        out.append((p, start))
        start += size
        i += 1
    return out


def call(src: pathlib.Path, key: str, model: str) -> dict:
    data = src.read_bytes()
    boundary = f"----t{int(time.time() * 1000)}"

    def part(name: str, value: str) -> bytes:
        return (f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n'
                f"{value}\r\n").encode()

    body = b"".join([
        part("model", model),
        part("language", "id"),
        part("response_format", "verbose_json"),
        part("temperature", "0"),
        part("prompt", PROMPT),
        (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{src.name}"\r\n'
         "Content-Type: audio/wav\r\n\r\n").encode(),
        data,
        f"\r\n--{boundary}--\r\n".encode(),
    ])
    req = urllib.request.Request(
        ENDPOINT, data=body,
        headers={"Authorization": f"Bearer {key}",
                 "Content-Type": f"multipart/form-data; boundary={boundary}",
                 "User-Agent": UA, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=600) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        raise SystemExit(f"HTTP {e.code}: {e.read().decode()[:400]}")


def main() -> None:
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    src = pathlib.Path(sys.argv[1]).expanduser()
    out_dir = pathlib.Path(sys.argv[2]).expanduser()
    model = sys.argv[3] if len(sys.argv) > 3 else "whisper-large-v3"
    size = int(sys.argv[4]) if len(sys.argv) > 4 else 180
    out_dir.mkdir(parents=True, exist_ok=True)
    work = out_dir / f".work-{src.stem}"
    work.mkdir(exist_ok=True)

    key = read_key()
    t0 = time.time()
    wav = prep(src, work)
    segs: list[dict] = []
    for path, offset in chunks(wav, work, size):
        res = call(path, key, model)
        for s in res.get("segments") or []:
            segs.append({"start": offset + s["start"], "end": offset + s["end"],
                         "text": s["text"].strip()})
        print(f"  {path.name}: {len(res.get('segments') or [])} segmen", flush=True)

    segs.sort(key=lambda s: s["start"])
    lines = [f"[{int(s['start']) // 60:02d}:{int(s['start']) % 60:02d}] {s['text']}" for s in segs]
    stem = out_dir / f"{src.stem}-{model.replace('whisper-', '')}"
    stem.with_suffix(".txt").write_text("\n".join(lines) + "\n")
    stem.with_suffix(".json").write_text(json.dumps({"model": model, "segments": segs},
                                                    ensure_ascii=False, indent=1))
    print(f"{len(segs)} segmen, {sum(len(s['text'].split()) for s in segs)} kata, "
          f"{time.time() - t0:.0f}s proses")
    print("->", stem.with_suffix(".txt"))


if __name__ == "__main__":
    main()
