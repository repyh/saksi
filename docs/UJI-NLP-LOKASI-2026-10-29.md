# Uji NLP untuk pipeline ekstraksi lokasi — hasil (29 Oktober 2026)

**Pertanyaan:** kalau pipeline lokasi memakai NLP/LLM, berapa paket tambahan yang benar-benar bisa
diselamatkan — dan apakah lapisan itu layak dibangun?

**Jawaban singkat: tidak layak untuk ekstraksi lokasi.** Batas atasnya ~+1,5 poin persentase
keterpetaan, dan yang gagal bukan karena bahasa, melainkan karena 60% sisa paket memang tidak
menyebut tempat apa pun. NLP justru layak untuk hal lain (klasifikasi sebab kerusakan, deteksi
koridor pada kalimat bebas).

## Populasi uji

- Paket fisik Kab. Bandung (filter seragam dari `docs/MEMO-TANGERANG-2026-10-29.md`): **5.363**.
- Gagal cocok kamus 280 desa/31 kecamatan: **982 paket (18,3%)** — setara 684 paket (13,6%) pada
  classifier proyek yang lebih ketat. Inilah "ekor" yang diharapkan diselamatkan NLP.
- Sampel acak berbenih (seed 42): **100 paket** untuk lengan fuzzy, **40 paket** untuk lengan LLM.
  Lengan LLM **dihentikan di baris ke-40** dari 100 yang direncanakan karena batas laju Groq (429),
  bukan karena hasilnya sudah cukup. Sampel kecil — angka di bawah indikatif, bukan presisi.

## Empat lengan

| Lengan | Metode | Hasil |
|---|---|---|
| A. baseline | pencocokan gazetteer persis | 0/982 menurut definisi (populasi uji) |
| B. fuzzy tanpa LLM | kemiripan string token→nama desa (cutoff 0,87) | **0/100** (uji pertama 1/200, kebetulan) |
| C. LLM + gazetteer | `gpt-oss-20b` mengekstrak nama tempat, divalidasi tertutup ke gazetteer | **0/38** baris sukses, 0 dari 23 token tervalidasi |
| D. LLM + OSM | token hasil LLM dicari di Nominatim (bounded Kab. Bandung), desa hasil pencarian dicek ke gazetteer | **4/23 token**, realistis **2–3** yang masuk akal |

Kontrol penting: pada 40 baris yang sama, **regex sederhana** (`Kp.`/`Jl.`/`Ds.`/`Gg.` + kata
sesudahnya) menemukan nama tempat di **12 baris**, LLM di **15 baris** — dan 3 baris tambahan LLM
isinya sampah (`RT. 001`, `RT. 003`, `Kabupaten Bandung`). **LLM tidak menambah kemampuan ekstraksi
yang berarti di tugas ini.**

## Mengapa gagal

1. **Setengah sisa paket memang tidak punya lokasi** — contoh dari sampel: `Pengadaan Mebel`,
   `Pengadaan Peralatan Olahraga`, `Normalisasi Sungai Wilayah 2`,
   `Rehabilitasi Rumah Terdampak Bencana Paket 16`, `Peningkatan Jl RT. 001, 003 dan 004 RW. 002`. Ini
   bukan masalah parsing; ini paket non-spasial atau agregat. Tidak ada NLP yang bisa memetakannya,
   dan memaksanya jadi titik justru melanggar prinsip "jangan buat titik palsu" di `SPEC.md`.
2. **Yang menyebut tempat menyebut patokan, bukan desa** — `Jl. Bhayangkara`, `Kp. Cangri`,
   `Taman PSU Perumahan Griya Bandung Asri`, `Depo Arsip`, `Gedung Negara Sederhana`. Nama patokan
   tidak ada di gazetteer desa, jadi validasi tertutup (yang menjaga dari halusinasi) otomatis menolak.
3. **Jembatan patokan→desa (OSM) tipis.** Uji Nominatim pada 23 token: `Jl. Bhayangkara` →
   Cileunyi Kulon ✓, `SEKEMANDUNG` → Cilengkrang ✓, `Logawa` → Warjabakti (meragukan),
   `Kabupaten Bandung` → Pamekaran ✗ (jelas salah). Dan tarikan Overpass untuk seluruh Kab. Bandung
   hanya menghasilkan **190 nama hamlet** — cakupan OSM untuk kampung di Bandung memang jarang, jadi
   gazetteer kampung lokal pun tidak akan banyak menambah.

## Perkiraan manfaat dan biaya

- Manfaat: ~2–3 baris selamat per 38 baris sisa ≈ **8% dari 18,3%** ≈ **+1,5 poin** keterpetaan
  (86,4% → ~88%), dengan risiko titik palsu dan ketergantungan API eksternal.
- Biaya: Groq gratis membatasi laju — 40 panggilan makan **9 menit** (97 dari 200 percobaan pertama
  kena HTTP 429). Untuk 982 baris sisa: ~1 jam panggilan LLM + ~25 menit Nominatim (1 permintaan/detik).
  Tidak bisa dipakai saat demo langsung; hasilnya harus dibekukan jadi JSON.

## Rekomendasi

1. **Jangan bangun lapisan NLP untuk ekstraksi lokasi.** Gain-nya ~1,5 poin, gagalnya senyap, dan
   tidak bisa direproduksi persis.
2. **Perbaiki di tempat lain, gratis:** paket tanpa penanda tempat sebaiknya **tidak dipaksa ke peta**
   — tampilkan di tabel dengan label `Lokasi: Kab. Bandung (Umum)` dan hitung terpisah sebagai
   "paket tanpa lokus". Itu jujur, dan sekaligus menaikkan kualitas peta karena marker yang ada
   semuanya bisa dipertanggungjawabkan.
3. **Pakai LLM di tempat yang headroom-nya nyata:**
   - klasifikasi **sebab kerusakan** dan sektor dari teks laporan warga (bukan dari nama paket);
   - **deteksi koridor** pada kalimat bebas — ada 365 kandidat Kab. Bandung dan 1.163 kandidat Kab.
     Tangerang yang menyebut ≥2 kecamatan tetapi belum bisa dipastikan sebagai koridor;
   - narasi kartu sandingan (FR-04).
4. Kalau kelak butuh cakupan peta lebih tinggi, jalannya **bukan** LLM: bangun gazetteer kampung
   lokal sekali (`data/scratch/osm_hamlet_bandung.json`, 190 nama) atau pakai data dusun BPS, lalu
   pencocokan kembali deterministik dan instan.

## Berkas

- Skrip uji: `tools/uji_nlp_lokasi.py` (lengan A–D, checkpoint per 10 baris).
- Hasil mentah: `data/scratch/uji_nlp_hasil.json`, `data/scratch/uji_nlp_checkpoint.json`,
  `data/scratch/osm_hamlet_bandung.json`.
- Catatan operasional: Groq `openai/gpt-oss-20b`, suhu 0, `response_format=json_object`; Nominatim
  dengan `User-Agent` yang menyebut identitas + `bounded=1` sesuai kebijakan penggunaan.
