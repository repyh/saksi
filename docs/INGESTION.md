# INGESTION — Worker, Riwayat Run, dan Cron

Worker ada di `workers/`. Ia menjalankan satu region dari sumber mentah sampai snapshot publik:
**RUP → detail RUP → realisasi → LPSE → normalisasi → validasi → upsert DB → rebuild snapshot →
`region:check`**. Tidak ada NLP, computer vision, atau sumber sosial.

## 1. Perintah

```bash
npm run ingest:worker -- --region kota-tangerang
npm run ingest:worker:dry -- --region kota-tangerang
npm run db:verify -- --region kota-tangerang
```

| Opsi | Arti |
|---|---|
| `--region <id>` | direktori `data/regions/<id>` (bawaan `kota-tangerang`) |
| `--dry-run` | baca, normalisasi, validasi, gate ke snapshot sementara; tidak menulis DB/berkas/manifest |
| `--sources rup,detail,realisasi,lpse,boundaries,jalan` | batasi modul yang diimpor/di-refresh |
| `--refresh` | jalankan penarik sumber (`scripts/rup.mjs`, `realisasi.mjs`, `lpse.mjs`) sebelum impor |
| `--trigger manual\|cron\|backfill` | label `ingestion_runs.trigger` |
| `--simulate-failure <stage>` | uji jalur gagal: `fetch`, `normalize`, `validate`, `before-commit`, `after-commit`, `snapshot` |
| `--lock-ttl-minutes <n>` | masa lock (bawaan 120 menit) |
| `--log-level debug\|info\|warn\|error` | verbosity log JSON |

Contoh operasional:

```bash
# Impor ulang dari berkas yang sudah ada, tanpa menyentuh jaringan
npm run ingest:worker -- --region kota-tangerang

# Tarik ulang sumber lalu impor (butuh jaringan)
npm run ingest:worker -- --region kota-tangerang --refresh

# Hanya realisasi + LPSE
npm run ingest:worker -- --region kota-tangerang --sources realisasi,lpse

# Uji kegagalan sebelum commit: run tercatat FAILED, data aktif tidak berubah
npm run ingest:worker -- --region kota-tangerang --simulate-failure before-commit

# Hanya layer jaringan jalan; tidak menuntut berkas RUP/detail
npm run ingest:worker -- --region kota-tangerang --sources jalan
```

`--sources` membatasi modul yang ditulis. Untuk bootstrap penuh atau verifikasi rekonsiliasi,
pakai semua sumber (bawaan). Run parsial tidak boleh dipakai untuk menilai angka manifest.

## 2. Tahap dan Arti Sukses

| Tahap | Yang terjadi | Gagal berarti |
|---|---|---|
| `fetch` | baca berkas sumber, hitung SHA-256, simpan `source_artifacts` + `raw_records` | run FAILED; tabel domain tidak disentuh |
| `normalize` | bangun baris RUP, detail, batas, kontrak, vendor, paket/transaksi realisasi | run FAILED; tidak ada publish |
| `validate` | duplikat kunci, relasi RUP, anchor, angka manifest, gate snapshot sementara | run FAILED; tidak ada publish |
| `upsert` | satu transaksi Postgres untuk seluruh tabel domain | rollback penuh; tidak ada batch parsial |
| `snapshot` | tulis snapshot aktif secara atomik, jalankan `region:check --manifest` | run FAILED; DB sudah berisi batch lengkap, snapshot tetap versi lama |

Snapshot sementara digate **sebelum** transaksi domain. Jadi kegagalan validasi/gate tidak
mengubah data aktif. Jika penulisan snapshot gagal setelah commit, database berisi batch lengkap
(bukan parsial); jalankan ulang worker.

## 3. Sumber dan Provenance

Sumber dibaca dari `data/regions/<id>/region.json`; tidak ada path atau instansi yang ditanam di
worker. Setiap berkas menjadi satu artefak:

- `data/rup_kota_tangerang_2025_2026.json` → `RUP`;
- `data/rup_detail_kota_tangerang.json` → `RUP_DETAIL` (termasuk baris tanpa pasangan RUP);
- `data/realisasi_kota_tangerang.json` → `REALISASI`;
- `data/lpse_kota_tangerang_2025_2026.json` → `LPSE` (kontrak tercocok);
- `data/lpse/rows.json` + `details.jsonl` → `LPSE` (baris mentah, termasuk yang tidak cocok);
- `public/data/{rw,kel,kec}.geojson` → `BOUNDARY`;
- `public/data/jalan.geojson` → `ROAD_NETWORK` (Overture transportation segment, ODbL-1.0).

Jumlah baris tiap artefak dicatat di `source_artifacts` dan direkap di
`data/regions/<id>/manifest.json`; jangan menyalinnya ke dokumen. Berkas detail RUP harus mencakup
seluruh paket snapshot — berkas detail lama yang lebih pendek menurunkan presisi dan ditolak gate
validasi.

Artefak disimpan dengan `UNIQUE (source_id, checksum_sha256)`, sehingga run kedua memakai artefak
yang sama. Raw record memakai `UNIQUE (artifact_id, row_index)`. Inilah dasar idempotensi:
**isi sama → tidak ada baris baru**.

`--refresh` menjalankan perintah penarik yang sudah ada:

| Sumber | Perintah |
|---|---|
| RUP | `node scripts/rup.mjs --region <id>` |
| detail RUP | `node scripts/rup.mjs --detail --region <id>` |
| realisasi | `node scripts/realisasi.mjs --region <id>` |
| LPSE | `node scripts/lpse.mjs list\|detail\|match --region <id>` |

Jeda minimum 1,5 detik antar perintah, retry 3× dengan exponential backoff + jitter. Worker tidak
merayapi `katalog.inaproc.id` atau `sikap.inaproc.id`; keduanya hanya tautan rujukan.

## 4. Lock, Retry, Log, Riwayat

- **Lock**: `ingestion_locks` per region, TTL bawaan 120 menit, heartbeat tiap 30 detik. Run kedua
  mendapat status `SKIPPED` (`LOCK_HELD`, exit code 75) dan tidak menulis domain.
- **Retry**: penarikan sumber memakai 3 percobaan; kegagalan database langsung menggagalkan run
  (tidak ada retry buta untuk transaksi domain).
- **Rate limit**: jeda antar perintah penarik; tidak ada request paralel.
- **Log**: JSON-lines ke stdout/stderr, memuat `ts`, `level`, `msg`, `region`, `run_id`, `owner`,
  `git`, dan data tahap. Cocok untuk journald/CloudWatch.
- **Riwayat**: `ingestion_runs` (status, trigger, durasi, error, stats), `ingestion_run_steps`
  (per tahap), `ingestion_run_artifacts`, `region_manifests`.

Contoh query:

```sql
SELECT id, status, trigger, started_at, finished_at, duration_ms, error_code
FROM ingestion_runs WHERE region_id='kota-tangerang' ORDER BY started_at DESC LIMIT 10;

SELECT step, status, attempt, record_count, error_message
FROM ingestion_run_steps WHERE run_id='<uuid>' ORDER BY created_at;
```

## 5. Penjadwalan

Tiga cara disediakan; **pilih satu**. Semua memanggil worker yang sama, dan lock DB tetap menjadi
lapisan terakhir anti-tumpang-tindih. **Tidak ada deployment yang dilakukan dari repo ini**.

### 5.1 Penjadwal di dalam Next (tanpa systemd)

`src/instrumentation.ts` memanggil `mulaiPenjadwal()` sekali saat server Next siap. Penjadwal
memeriksa jam setempat setiap 20 detik, lalu men-spawn CLI yang sama dengan timer systemd sebagai
proses terpisah, sehingga pekerjaan berat tidak menahan event loop web. Tidak ada unit systemd,
daemon cron, atau proses tambahan: cukup `npm run build` lalu `npm start`. `next dev` tidak
menjadwalkan apa pun, dan `next build` dilewati lewat `NEXT_PHASE` sehingga build tetap berjalan
tanpa `DATABASE_URL`.

| Env | Bawaan | Arti |
|---|---|---|
| `INGEST_SCHEDULER` | aktif saat `NODE_ENV=production` | `0` mematikan seluruh penjadwal; `1` memaksa aktif |
| `INGEST_SCHEDULER_TZ` | `Asia/Jakarta` | zona waktu jadwal |
| `INGEST_SCHEDULER_INGEST` | `02:30` | jam ingestion; `off` untuk mematikan |
| `INGEST_SCHEDULER_RETENTION` | `03:15` | jam retensi foto laporan; `off` untuk mematikan |
| `INGEST_SCHEDULER_REGION` | `kota-tangerang` | direktori `data/regions/<id>` |
| `INGEST_SCHEDULER_REFRESH` | `0` | `1` menambahkan `--refresh` (tarik sumber sebelum impor) |
| `INGEST_SCHEDULER_CATCHUP` | `1` | `0` mematikan catch-up saat boot |

Catch-up adalah pengganti `Persistent=true`: 30 detik setelah boot, penjadwal membandingkan
`dibuat` di `data/regions/<id>/manifest.json` dengan jadwal terakhir. Bila manifest lebih tua dari
jadwal itu (toleransi 15 menit), ingestion dijalankan sekali. Hanya ingestion, bukan retensi.
Manifest hanya ditulis ulang setelah run sukses, jadi kegagalan dicoba lagi pada boot berikutnya.

Batasan:

- **Satu instance.** Beberapa instance aman dari tumpang tindih karena `ingestion_locks` (run kedua
  `SKIPPED`, exit 75), tetapi snapshot ditulis di host tempat worker berjalan.
- **Bukan untuk serverless.** Butuh proses Node panjang dan filesystem tulis (`data/`,
  `public/data/`).
- **Jangan aktif bersamaan** dengan timer systemd atau GitHub Actions. Lock mencegah tumpang tindih,
  tetapi run kedua hanya tercatat `SKIPPED`.
- Penjadwal tidak mematikan child saat server berhenti; lock DB yang mengatur sisa run.
- Log penjadwal berprefix `[jadwal]`; stdout/stderr child diwariskan ke log server.

### 5.2 systemd timer

- `deploy/systemd/saksi-ingestion.service`
- `deploy/systemd/saksi-ingestion.timer` — `02:30 Asia/Jakarta`, `Persistent=true`,
  `RandomizedDelaySec=300`.

Pasang di host:

```bash
sudo useradd --system --home /opt/saksi --shell /usr/sbin/nologin saksi
sudo install -d -o saksi -g saksi /etc/saksi /opt/saksi
sudo install -m 0644 deploy/systemd/saksi-ingestion.* /etc/systemd/system/
sudo install -m 0600 /dev/null /etc/saksi/ingestion.env   # isi DATABASE_URL/DIRECT_URL
sudo systemctl daemon-reload
sudo systemctl enable --now saksi-ingestion.timer
systemctl list-timers saksi-ingestion.timer
journalctl -u saksi-ingestion.service -n 100 --no-pager
```

Env minimum `/etc/saksi/ingestion.env`:

```dotenv
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
```

Worker memuat `.env.local` hanya bila `DATABASE_URL` dan `DIRECT_URL` sama-sama kosong; env host
selalu menang.

### 5.3 GitHub Actions

`.github/workflows/ingestion.yml`:

- jadwal `30 19 * * *` UTC = **02:30 WIB** setiap hari;
- `workflow_dispatch` dengan input `region` dan `dry_run`;
- `concurrency: ingestion-<region>` (lapisan kedua setelah lock DB);
- langkah: `npm ci` → `prisma migrate deploy` → worker `--trigger cron` → `db:verify`;
- log + `manifest.json` diunggah sebagai artefak 30 hari; tidak ada commit snapshot ke repo.

Secret yang dibutuhkan: `DATABASE_URL`, `DIRECT_URL`.

## 6. Runbook

**Harian**
1. Cek `ingestion_runs` terakhir: harus `SUCCEEDED`, `duration_ms` wajar.
2. Jalankan `npm run db:verify -- --region <id>`; semua baris harus `OK`.
3. Cek tidak ada `ingestion_locks` tersisa.

**Run gagal**
1. Baca `error_code`/`error_message` dan `ingestion_run_steps` yang `FAILED`.
2. `VALIDATION_FAILED`: angka sumber berubah atau manifest tidak sinkron. Periksa
   `data/regions/<id>/manifest.json`; jangan menurunkan validasi.
3. `LOCK_HELD`: lihat `ingestion_locks`; tunggu TTL atau hapus hanya bila yakin tidak ada proses
   aktif: `DELETE FROM ingestion_locks WHERE region_id='<id>';`
4. Setelah penyebab diperbaiki, jalankan ulang worker. Run gagal tidak mengubah data aktif.

**Snapshot perlu dikembalikan**
- Snapshot aktif adalah berkas di `data/regions/<id>/region.json` → `keluaran`.
- Versi lama tidak disimpan sebagai berkas; bangun ulang dari commit data sebelumnya, atau
  jalankan worker dari artefak yang checksum-nya cocok di `source_artifacts`.
- Jangan mengedit snapshot/GeoJSON manual.

**Migrasi**
```bash
npx prisma migrate status
npx prisma migrate deploy
```
Migrasi harus aditif. Jangan mengedit migrasi yang sudah diterapkan; buat migrasi baru.

**Rekonsiliasi**
```bash
npm run region:check -- --region kota-tangerang --manifest
npm run db:verify -- --region kota-tangerang
```
`db:verify` membandingkan DB dengan manifest: paket, pagu, presisi, cakupan wilayah, penyedia,
baris realisasi, batas, raw, duplikat, checksum snapshot, dan riwayat run.

## 7. Bukti Uji 8 November 2026

| Uji | Hasil |
|---|---|
| Impor penuh pertama | `SUCCEEDED`, 28.699 RUP + 2.552 detail + 2.552 paket + 1.137 batas + 1.739 kontrak + 50.836 transaksi + 90.782 raw |
| Impor kedua | `SUCCEEDED`; jumlah tabel dan artefak tidak berubah (idempoten) |
| `--simulate-failure before-commit` | run `FAILED` (`SIMULATED_FAILURE`), angka domain tetap sama |
| `region:check` | `LULUS: 0 masalah` |
| `db:verify` | `LULUS: semua metrik cocok` |
| `--sources boundaries` | `SUCCEEDED`; 1.137 poligon, 0 geometri tidak valid |

## 8. Batas yang Disengaja

- Worker tidak mengganti repository aplikasi; `/api/packages` tetap membaca snapshot.
- Worker tidak menulis tabel report/auth.
- Tidak ada penghapusan baris domain saat sumber menyusut; baris lama tetap ada sampai ada
  kebijakan retensi/penonaktifan eksplisit. Snapshot publik tetap menjadi sumber tampilan.
- Run parsial (`--sources`) hanya untuk refresh/inspeksi, bukan untuk menilai rekonsiliasi penuh.
- Deployment cron, secret produksi, dan merge/push tidak dilakukan di sesi ini.

## 9. Layer Jaringan Jalan Overture

Sumber `ROAD_NETWORK` memakai **Overture Maps transportation segment**, bukan layer ArcGIS jalan.
Konfigurasi ada di `data/regions/<id>/region.json` pada kunci `jalan`.

### Prasyarat

```bash
# salah satu jalur CLI; script mencoba overturemaps, lalu uvx, lalu pipx
pip install overturemaps
# atau
uvx overturemaps --version
# clip memakai Shapely di lingkungan sementara uv
uv run --with shapely python3 --version
```

Rilis dipin di `jalan.release`; bila kosong, script memakai `overturemaps releases latest` dan
mencatatnya di manifest. Rilis yang dipakai saat ini: **2026-10-21.0**.

### Perintah

```bash
npm run data:jalan -- --region kota-tangerang
npm run data:jalan -- --region kota-tangerang --check
```

Langkah script:

1. hitung bbox dari `public/data/kec.geojson` (atau `jalan.bbox` bila diisi);
2. unduh `--type=segment -f geojson` ke direktori sementara;
3. buang `subtype != road`, kelas `unknown`/`steps`/pejalan kaki, dan duplikat GERS;
4. petakan GERS id, `names.primary`, `class`, `road_surface`, `width_rules`, geometri;
5. clip ke batas kecamatan dengan Shapely, sederhanakan, bulatkan koordinat;
6. hitung panjang, spatial join kecamatan/kelurahan, tulis `public/data/jalan.geojson`;
7. validasi GERS id unik, geometri garis, dan coverage nama.

`widthM` hanya diisi bila `width_rules` berupa satu aturan numerik tanpa segmen bersyarat.
`number` selalu `null` karena Overture tidak memiliki nomor ruas kota.

### Worker dan jadwal

```bash
# impor layer saja; tidak memerlukan berkas RUP
npm run ingest:worker -- --region kota-tangerang --sources jalan --trigger cron

# rekonsiliasi
npm run db:verify -- --region kota-tangerang
```

Worker menandai segmen yang hilang dari snapshot sebagai `is_active=false`; laporan lama tetap
menunjuk segmen lama. Jadwal bulanan:

- GitHub Actions: `.github/workflows/ingestion-road.yml` (tanggal 1 setiap bulan, 01:00 WIB);
- systemd: `deploy/systemd/saksi-road.{service,timer}`.

Keduanya menjalankan `npm run data:jalan` → worker `--sources jalan` → `db:verify`.

### Runbook

- **CLI tidak tersedia** → pasang `overturemaps` (pip/uv) atau hentikan run; jangan kembali ke
  ArcGIS.
- **Unduhan gagal/timeout** → ulangi; script memakai direktori sementara dan tidak menulis layer
  parsial. Untuk pengembangan, `--input <geojson>` memakai unduhan lokal yang sudah ada.
- **Segmen turun drastis** → periksa rilis Overture dan bbox; jangan menurunkan validasi.
- **Checksum manifest berbeda** → jalankan `npm run region:check -- --region <id> --manifest`
  lalu worker/impor ulang.

## 10. Verifikasi Layer Overture (10 November 2026)

Rilis yang dipakai `2026-10-21.0` (Overture CLI 2.1.0). Angka segmen, coverage nama, ukuran berkas,
dan checksum **tidak ditulis di dokumen**; baca `data/regions/<id>/manifest.json`
(`metrik.jalan`, `berkas["public/data/jalan.geojson"]`) atau jalankan
`npm run db:verify -- --region <id>`.

| Uji | Hasil |
|---|---|
| Unduhan + filter + clip | Snapshot tertulis dan lolos gate `region:check` |
| Validasi | GERS id unik, geometri garis, kelas terisi, lisensi ODbL-1.0 |
| Worker `--sources jalan` dua kali | `SUCCEEDED`; jumlah baris tetap sama (idempoten) |
| `db:verify` | Segmen aktif, coverage nama, rilis/lisensi, dan checksum layer cocok |
| Uji tanpa berkas RUP | `--sources jalan` tetap berjalan dan hanya menulis `ROAD_NETWORK` |
