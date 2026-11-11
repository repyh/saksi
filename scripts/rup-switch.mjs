#!/usr/bin/env node
/**
 * Uji "RUP switch": apakah paket register yang tidak punya rekam penyedia sebenarnya dieksekusi
 * melalui **kode RUP lain**?
 *
 * Latar: paket tanpa baris di LPSE/Data INAPROC bisa berarti (a) belum berjalan, (b) berjalan tetapi
 * pencatatannya belum masuk, (c) RUP tidak dieksekusi, atau (d) dieksekusi dengan kode RUP lain.
 * Hanya (d) yang bisa diuji tanpa data baru: cari RUP lain dengan nama yang sama, lalu periksa
 * apakah RUP lain itu punya penyedia.
 *
 * Uji ini **tidak** boleh dipakai untuk menyimpulkan pembatalan. Tidak ada pasangan berarti
 * "tidak ada pasangan", bukan "tidak dikerjakan".
 *
 * Pakai: node scripts/rup-switch.mjs [--region kota-tangerang] [--keluaran <berkas>] [--verbose]
 * Keluaran bawaan: data/rup_switch_<region>.json
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { AKAR, bacaJson, muatRegion } from "./lib/region.mjs";
import { indeksNama, kunciNama, sidikNama, hitungDerauPagu, kunciBulan } from "./lib/rup-switch.mjs";
import { objekJalan } from "./lib/road-filter.mjs";

const argv = process.argv.slice(2);
const arg = (nama, bawaan) => {
  const i = argv.indexOf(`--${nama}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : bawaan;
};
const VERBOSE = argv.includes("--verbose");
const REGION_ID = arg("region", "kota-tangerang");
const region = await muatRegion(REGION_ID).catch((error) => {
  console.error(`region: ${error.message}`);
  process.exit(1);
});
const KELUARAN = resolve(AKAR, arg("keluaran", `data/rup_switch_${region.id}.json`));

/** Filter pelaksana yang sama dengan `src/server/packages/lpse-merge.ts`. */
const BUKAN_PENYEDIA = /^\s*(dinas|pegawai|opd|pemerintah|badan|kantor|uptd|kecamatan|kelurahan|unsur)\b/i;

/** Satker register ("Dinas Pekerjaan Umum Dan Penataan Ruang") vs dump RUP ("… - 1.03.2.10…"). */
const kunciSatker = (s) =>
  String(s ?? "")
    .split(" - ")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const register = (await bacaJson(region.keluaran)).paket;
const rupMentah = (await bacaJson(region.sumber.rup)).item;
const realisasi = await bacaJson(region.sumber.realisasi);
if (!region.lpse?.keluaran) {
  console.error(`region ${region.id}: "lpse.keluaran" wajib diisi`);
  process.exit(1);
}
const lpse = (await bacaJson(region.lpse.keluaran)).item;

// Rekam penyedia = definisi produksi: LPSE yang punya pemenang, atau realisasi yang bukan
// swakelola dan pelaksananya bukan instansi.
const pelaksanaRealisasi = realisasi.item.filter(
  (r) =>
    r.kode_rup &&
    r.penyedia &&
    String(r.metode ?? "").toLowerCase() !== "swakelola" &&
    !BUKAN_PENYEDIA.test(r.penyedia),
);
const lpsePemenang = lpse.filter((b) => b.pemenang?.trim());

const rekamPerRup = new Map();
for (const b of lpsePemenang) {
  rekamPerRup.set(String(b.kode_rup), {
    sumber: "LPSE",
    penyedia: b.pemenang.trim(),
    nilai: b.nilai_kontrak ?? null,
    paket: b.id_lpse ?? null,
  });
}
for (const r of pelaksanaRealisasi) {
  const k = String(r.kode_rup);
  if (rekamPerRup.has(k)) continue;
  const agregat = realisasi.per_rup.find((x) => String(x.kode_rup) === k);
  rekamPerRup.set(k, {
    sumber: "Data INAPROC",
    penyedia: r.penyedia,
    nilai: agregat?.nilai ?? r.nilai ?? null,
    paket: r.kode_paket ?? null,
  });
}

const tanpaRekam = register.filter((p) => !rekamPerRup.has(String(p.kode_rup)));
const paguTanpaRekam = tanpaRekam.reduce((n, p) => n + (p.pagu ?? 0), 0);

const kunciRup = (x) => String(x.kode_rup);
const diRup = indeksNama(rupMentah, (x) => x.paket);
const diRupSidik = indeksNama(rupMentah, (x) => x.paket, sidikNama);
const diLpse = indeksNama(lpsePemenang, (x) => x.nama_rup);

/** Baris LPSE bersumber nama paket ini, tahun sama, tetapi tercatat pada kode RUP lain. */
const penguatUntuk = (p) =>
  (diLpse.get(kunciNama(p.nama)) ?? [])
    .filter((b) => String(b.kode_rup) !== kunciRup(p) && String(b.tahun) === String(p.tahun))
    .map((b) => ({
      kode_rup: String(b.kode_rup),
      id_lpse: b.id_lpse ?? null,
      pemenang: b.pemenang?.trim() ?? null,
      hps: b.hps ?? null,
      nilai_kontrak: b.nilai_kontrak ?? null,
    }));

const isiKandidat = (p, x, jenis) => ({
  kode_rup: kunciRup(p),
  nama: p.nama,
  pagu: p.pagu,
  tahun: p.tahun,
  satker: p.satker,
  metode: p.metode ?? null,
  jenis,
  kandidat: {
    kode_rup: kunciRup(x),
    nama: x.paket,
    pagu: x.total_nilai,
    tahun: x.tahun,
    satker: x.satker ?? null,
    selisih_pagu: (x.total_nilai ?? 0) - (p.pagu ?? 0),
    rekam: rekamPerRup.get(kunciRup(x)) ?? null,
  },
  penguat_lpse: penguatUntuk(p),
});

// Nama identik se-tahun: dua entri RUP untuk pekerjaan yang sama pada TA yang sama. Ini satu-satunya
// kelompok yang layak disebut "diduga dieksekusi lewat RUP lain", dan hanya bila kandidatnya punya
// rekam penyedia.
const kembarSeTahun = [];
const kembarLintasTahun = [];
const perluTinjau = [];
const terlibat = new Set();

for (const p of tanpaRekam) {
  const persis = (diRup.get(kunciNama(p.nama)) ?? []).filter((x) => kunciRup(x) !== kunciRup(p));
  const sidik = (diRupSidik.get(sidikNama(p.nama)) ?? []).filter((x) => kunciRup(x) !== kunciRup(p));
  const pasangan = persis.length ? persis.map((x) => [x, "nama identik"]) : sidik.map((x) => [x, "sidik sama"]);

  for (const [x, jenis] of pasangan) {
    const isi = isiKandidat(p, x, jenis);
    terlibat.add(kunciRup(p));
    if (String(x.tahun) === String(p.tahun)) {
      if (jenis === "nama identik") kembarSeTahun.push(isi);
      else perluTinjau.push(isi);
    } else {
      kembarLintasTahun.push(isi);
    }
  }
}

// Pagu saja tidak cukup: pagu dibulatkan dan sangat sering berulang. Angka ini menunjukkan berapa
// kandidat "pagu sama, tahun sama, satker sama, nama berbeda" yang akan dihasilkan bila aturannya
// dilonggarkan — inilah sebab aturan uji memakai nama, bukan pagu.
const derauPagu = tanpaRekam.filter((p) =>
  rupMentah.some(
    (x) =>
      kunciRup(x) !== kunciRup(p) &&
      String(x.tahun) === String(p.tahun) &&
      kunciSatker(x.satker) === kunciSatker(p.satker) &&
      x.total_nilai === p.pagu &&
      kunciNama(x.paket) !== kunciNama(p.nama),
  ),
).length;
const derauRegister = hitungDerauPagu(register, {
  tahun: (x) => x.tahun,
  satker: (x) => kunciSatker(x.satker),
  pagu: (x) => x.pagu,
  kunciRup,
});

// Baris realisasi tanpa `kode_rup` tidak bisa di-join. Kalau isinya pekerjaan jalan, paket register
// yang namanya cocok mungkin sebenarnya sudah tercatat.
const tanpaKode = realisasi.item.filter((r) => !r.kode_rup);
const tanpaKodeJalan = tanpaKode.filter((r) => objekJalan(r.paket ?? ""));

// Jadwal kontrak satu-satunya pembeda "belum berjalan" versus "jadwal sudah lewat" yang tersedia
// tanpa data baru. Paket yang jadwalnya belum lewat tidak boleh disebut bermasalah.
const rincian = await bacaJson(region.sumber.detail);
const detailPerRup = new Map(rincian.item.map((d) => [String(d.kode_rup), d]));
const acuanJadwal = String(rincian.snapshot ?? "").slice(0, 7) || null;
const tanpaRekamJadwal = tanpaRekam.map((p) => {
  const d = detailPerRup.get(String(p.kode_rup));
  const akhir = kunciBulan(d?.jadwal_kontrak_akhir) ?? kunciBulan(d?.jadwal_pemilihan_akhir);
  const status = !akhir || !acuanJadwal ? "tanpa_jadwal" : akhir < acuanJadwal ? "jadwal_lewat" : "belum_lewat";
  return {
    kode_rup: String(p.kode_rup),
    nama: p.nama,
    pagu: p.pagu,
    tahun: p.tahun,
    satker: p.satker,
    metode: p.metode ?? null,
    jadwal_akhir: akhir,
    status,
  };
});
const hitungStatus = (status) => tanpaRekamJadwal.filter((x) => x.status === status).length;

const urutSelisih = (a, b) => Math.abs(a.kandidat.selisih_pagu) - Math.abs(b.kandidat.selisih_pagu);
const denganRekam = (x) => Boolean(x.kandidat.rekam);
const paguSama = (x) => x.kandidat.selisih_pagu === 0;

const laporan = {
  dibuat: new Date().toISOString().slice(0, 10),
  region: region.id,
  sumber: {
    register: region.keluaran,
    rup: region.sumber.rup,
    realisasi: region.sumber.realisasi,
    lpse: region.lpse.keluaran,
  },
  register: {
    paket: register.length,
    tanpa_rekam: tanpaRekam.length,
    pagu_tanpa_rekam: paguTanpaRekam,
  },
  uji: {
    kembar_se_tahun: kembarSeTahun.length,
    kembar_se_tahun_pagu_sama: kembarSeTahun.filter((x) => paguSama(x) && denganRekam(x)).length,
    kembar_lintas_tahun: kembarLintasTahun.length,
    perlu_tinjau: perluTinjau.length,
    paket_terlibat: terlibat.size,
    tanpa_pasangan: tanpaRekam.length - terlibat.size,
  },
  derau_pagu: {
    tanpa_rekam_berkandidat_pagu_sama: derauPagu,
    register_berbagi_pagu: derauRegister,
  },
  baris_realisasi_tanpa_kode: {
    jumlah: tanpaKode.length,
    jalan: tanpaKodeJalan.length,
  },
  jadwal: {
    acuan: acuanJadwal,
    belum_lewat: hitungStatus("belum_lewat"),
    jadwal_lewat: hitungStatus("jadwal_lewat"),
    tanpa_jadwal: hitungStatus("tanpa_jadwal"),
  },
  tanpa_rekam: tanpaRekamJadwal,
  temuan: kembarSeTahun.filter(denganRekam).sort(urutSelisih),
  tinjauan: [...kembarSeTahun.filter((x) => !denganRekam(x)), ...perluTinjau].sort(urutSelisih),
  lintas_tahun: kembarLintasTahun.sort(urutSelisih),
};

mkdirSync(dirname(KELUARAN), { recursive: true });
writeFileSync(KELUARAN, JSON.stringify(laporan, null, 1));

const rupiah = (n) => {
  const nilai = n ?? 0;
  if (nilai >= 1e9) return `Rp${(nilai / 1e9).toFixed(2).replace(".", ",")} M`;
  return `Rp${(nilai / 1e6).toFixed(1).replace(".", ",")} jt`;
};
console.log(`register            : ${register.length} paket`);
console.log(`tanpa rekam         : ${tanpaRekam.length} paket · ${rupiah(paguTanpaRekam)}`);
console.log(`kembar se-tahun     : ${kembarSeTahun.length} paket (pagu sama: ${laporan.uji.kembar_se_tahun_pagu_sama})`);
console.log(`kembar lintas tahun : ${kembarLintasTahun.length} (tinjauan, bukan temuan)`);
console.log(`perlu tinjauan      : ${perluTinjau.length} (sidik sama, nama tidak identik)`);
console.log(`tanpa pasangan nama : ${laporan.uji.tanpa_pasangan}`);
console.log(`derau pagu          : ${derauPagu} paket tanpa rekam punya kandidat berpagu sama & setahun dengan nama berbeda`);
console.log(`baris tanpa kode_rup: ${tanpaKode.length} (${tanpaKodeJalan.length} menyebut objek jalan)`);
console.log(
  `jadwal kontrak      : ${laporan.jadwal.belum_lewat} belum lewat · ${laporan.jadwal.jadwal_lewat} sudah lewat · ` +
    `${laporan.jadwal.tanpa_jadwal} tanpa jadwal (acuan ${laporan.jadwal.acuan ?? "-"})`,
);

if (laporan.temuan.length) {
  console.log("\ntemuan (nama identik · tahun sama · kandidat punya rekam):");
  for (const x of laporan.temuan) {
    const penguat = x.penguat_lpse.length ? ` · LPSE ${x.penguat_lpse[0].pemenang}` : "";
    console.log(
      `  ${x.kode_rup} ${x.nama} · ${rupiah(x.pagu)} → ${x.kandidat.kode_rup} ${rupiah(x.kandidat.pagu)} · ` +
        `${x.kandidat.rekam.penyedia} (${x.kandidat.rekam.sumber})${penguat}`,
    );
  }
}
if (VERBOSE && laporan.tinjauan.length) {
  console.log("\ntinjauan:");
  for (const x of laporan.tinjauan) {
    console.log(`  ${x.kode_rup} ${x.nama} · ${rupiah(x.pagu)} → ${x.kandidat.kode_rup} ${rupiah(x.kandidat.pagu)}`);
  }
}
console.log(`\n→ ${KELUARAN}`);
