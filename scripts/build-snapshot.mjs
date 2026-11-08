// Bangun snapshot paket jalan SAKSI dari ekspor RUP data.inaproc.id.
// Konfigurasi daerah ada di data/regions/<id>/region.json + aliases.json; skrip ini tidak
// menyimpan path, kode instansi, properti batas, token lokasi, atau alias khas satu daerah.
// Pemakaian: node scripts/build-snapshot.mjs [--region <id>]   (bawaan: kota-tangerang)
// Aturan  : tidak ada koordinat pekerjaan; lokasi hanya poligon lingkungan/kelurahan/kecamatan.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { AKAR, bacaJson, judul, muatRegion, norm } from "./lib/region.mjs";
import { objekJalan, objekLain } from "./lib/road-filter.mjs";

const namaSatker = (teks) => judul(String(teks ?? "").split(" - ")[0].trim());

async function main() {
  const argv = process.argv.slice(2);
  const indeksRegion = argv.indexOf("--region");
  const regionId =
    indeksRegion >= 0 && argv[indeksRegion + 1] ? argv[indeksRegion + 1] : "kota-tangerang";
  const region = await muatRegion(regionId);
  const { kelurahanResmi, unitLingkungan, aliasKelurahan, reLingkungan, reKelurahan } = region;

  const rup = (await bacaJson(region.sumber.rup)).item ?? [];
  // Detail RUP opsional: tanpa berkas ini `bulan` dan anchor kecamatan tidak terisi.
  // Jalankan `npm run data:rup-detail` (atau `data:rup-detail-tambal`) lebih dulu bila perlu.
  let detail = new Map();
  try {
    detail = new Map(
      ((await bacaJson(region.sumber.detail)).item ?? []).map((d) => [String(d.kode_rup), d]),
    );
  } catch {
    console.warn(`peringatan: ${region.sumber.detail ?? "sumber.detail"} tidak tersedia — \`bulan\` akan kosong`);
  }

  const kecamatanResmi = new Set([...kelurahanResmi.values()].map((k) => norm(k.kecamatan)));

  const paket = [];
  let ditolakObjek = 0;
  let ditolakBukanFisik = 0;
  const aliasDipakai = new Map();

  for (const r of rup) {
    const nama = String(r.paket ?? "").replace(/&#x27;/g, "'");
    if (!objekJalan(nama)) {
      ditolakBukanFisik += 1;
      continue;
    }
    if (objekLain(nama)) {
      ditolakObjek += 1;
      continue;
    }

    const teks = ` ${norm(nama)} `;
    let kelurahan = null;
    for (const [kunci, isi] of kelurahanResmi) {
      if (teks.includes(` ${kunci} `)) {
        kelurahan = isi;
        break;
      }
    }
    if (!kelurahan) {
      for (const [alias, isi] of aliasKelurahan) {
        if (teks.includes(` ${alias} `)) {
          kelurahan = isi;
          aliasDipakai.set(alias, (aliasDipakai.get(alias) ?? 0) + 1);
          break;
        }
      }
    }
    if (!kelurahan) {
      const tanda = nama.match(reKelurahan);
      if (tanda && kelurahanResmi.has(norm(tanda[1]))) kelurahan = kelurahanResmi.get(norm(tanda[1]));
    }
    const cocokRw = reLingkungan ? nama.match(reLingkungan) : null;
    const nomorRw = cocokRw ? String(Number(cocokRw[1])) : null;

    const kode = String(r.kode_rup);
    const rincian = detail.get(kode);
    let presisi = "Kabupaten";
    let kecamatan = null;
    let unitId = null;

    if (kelurahan && nomorRw && unitLingkungan.has(`${norm(kelurahan.nama)}|${nomorRw}`)) {
      presisi = "RW";
      unitId = `${norm(kelurahan.nama)}|${nomorRw}`;
      kecamatan = unitLingkungan.get(unitId).kecamatan;
    } else if (kelurahan) {
      presisi = "Kelurahan";
      unitId = `${norm(kelurahan.nama)}|*`;
      kecamatan = kelurahan.kecamatan;
    } else if (rincian) {
      const disebut = new Set(
        (rincian.lokasi_raw ?? [])
          .flatMap((baris) => String(baris ?? "").split(/[,;]/))
          .map((potong) => norm(potong.replace(/^(kec\.?|kecamatan)\s+/i, "")))
          .filter((potong) => kecamatanResmi.has(potong)),
      );
      if (disebut.size === 1) {
        presisi = "Kecamatan";
        const kunci = [...disebut][0];
        kecamatan = [...kelurahanResmi.values()].find((k) => norm(k.kecamatan) === kunci)?.kecamatan ?? null;
      }
    }

    paket.push({
      kode_rup: kode,
      tahun: Number(r.tahun),
      satker: namaSatker(r.satker),
      nama,
      pagu: Math.round(Number(r.total_nilai ?? 0)),
      metode: r.metode && r.metode !== "-" ? String(r.metode) : null,
      sumber: r.sumber_dana ? String(r.sumber_dana) : null,
      // Jadwal hanya dipakai bila tahunnya cocok dengan tahun RUP; kalau tidak, biarkan kosong
      // daripada menampilkan "Januari 2023" pada paket TA 2025.
      bulan:
        rincian?.jadwal_pemilihan_mulai &&
        String(rincian.jadwal_pemilihan_mulai).slice(-4) === String(r.tahun)
          ? rincian.jadwal_pemilihan_mulai
          : null,
      sektor: "Jalan, Jembatan & Drainase",
      desa_resmi: kelurahan?.nama ?? null,
      rw: nomorRw,
      unit_id: unitId,
      kecamatan_resmi: kecamatan,
      lat: null,
      lon: null,
      presisi_peta: presisi,
      lokasi_mikro: null,
    });
  }

  // Tahun terbaru dulu, lalu pagu terbesar: paket yang paling lengkap datanya tampil lebih dulu.
  paket.sort((a, b) => b.tahun - a.tahun || b.pagu - a.pagu || a.kode_rup.localeCompare(b.kode_rup));
  const jalurKeluaran = path.resolve(AKAR, region.keluaran);
  await mkdir(path.dirname(jalurKeluaran), { recursive: true });
  await writeFile(
    jalurKeluaran,
    JSON.stringify({ snapshot: region.metadata.snapshot, sumber: region.metadata.sumber, paket }),
  );

  const hitung = (kunci) =>
    paket.reduce((akumulasi, item) => {
      akumulasi[item[kunci] ?? "null"] = (akumulasi[item[kunci] ?? "null"] ?? 0) + 1;
      return akumulasi;
    }, {});
  const pagu = paket.reduce((total, item) => total + item.pagu, 0);

  console.log(`region            : ${region.label} (${region.id}, ${region.instansi})`);
  console.log(
    region.batas.lingkungan
      ? `batas             : ${region.jumlahKelurahan} kelurahan · ${region.jumlahUnitLingkungan} ${region.batas.lingkungan.label}`
      : `batas             : ${region.jumlahKelurahan} kelurahan · tanpa unit lingkungan`,
  );
  console.log(`RUP dibaca        : ${rup.length}`);
  console.log(`ditolak (non-fisik): ${ditolakBukanFisik}`);
  console.log(`ditolak (objek lain): ${ditolakObjek}`);
  console.log(`paket tersimpan   : ${paket.length}`);
  console.log(`pagu              : Rp${(pagu / 1e9).toFixed(2)} M`);
  console.log(`per tahun         : ${JSON.stringify(hitung("tahun"))}`);
  console.log(`presisi           : ${JSON.stringify(hitung("presisi_peta"))}`);
  console.log(`punya bulan       : ${paket.filter((item) => item.bulan).length}`);
  console.log(`kecamatan terisi  : ${paket.filter((item) => item.kecamatan_resmi).length}`);
  console.log(`alias kelurahan   : ${JSON.stringify(Object.fromEntries(aliasDipakai))}`);
}

main().catch((error) => {
  console.error(error?.name === "RegionError" ? `region: ${error.message}` : error);
  process.exitCode = 1;
});
