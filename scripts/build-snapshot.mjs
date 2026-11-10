// Bangun snapshot paket jalan SAKSI dari ekspor RUP data.inaproc.id.
// Konfigurasi daerah ada di data/regions/<id>/region.json + aliases.json; skrip ini tidak
// menyimpan path, kode instansi, properti batas, token lokasi, atau alias khas satu daerah.
// Pemakaian: node scripts/build-snapshot.mjs [--region <id>]   (bawaan: kota-tangerang)
// Aturan  : tidak ada koordinat pekerjaan; lokasi hanya poligon lingkungan/kelurahan/kecamatan.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { AKAR, bacaJson, muatRegion } from "./lib/region.mjs";
import { bangunSnapshot, serialisasiSnapshot } from "./lib/snapshot.mjs";

async function main() {
  const argv = process.argv.slice(2);
  const indeksRegion = argv.indexOf("--region");
  const regionId =
    indeksRegion >= 0 && argv[indeksRegion + 1] ? argv[indeksRegion + 1] : "kota-tangerang";
  const region = await muatRegion(regionId);

  const rup = (await bacaJson(region.sumber.rup)).item ?? [];
  // Detail RUP opsional: tanpa berkas ini `bulan` dan anchor kecamatan tidak terisi.
  // Jalankan `npm run data:rup-detail` (atau `data:rup-detail-tambal`) lebih dulu bila perlu.
  let detail = [];
  try {
    detail = (await bacaJson(region.sumber.detail)).item ?? [];
  } catch {
    console.warn(`peringatan: ${region.sumber.detail ?? "sumber.detail"} tidak tersedia — \`bulan\` akan kosong`);
  }

  const { paket, ditolakObjek, ditolakBukanFisik, ditolakNonKonstruksi, aliasDipakai } = bangunSnapshot(region, {
    rup,
    detail,
  });

  const jalurKeluaran = path.resolve(AKAR, region.keluaran);
  await mkdir(path.dirname(jalurKeluaran), { recursive: true });
  await writeFile(
    jalurKeluaran,
    serialisasiSnapshot(
      { snapshot: region.metadata.snapshot, sumber: region.metadata.sumber },
      paket,
    ),
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
  console.log(`ditolak (non-konstruksi): ${ditolakNonKonstruksi}`);
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
