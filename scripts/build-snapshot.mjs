// Bangun snapshot paket jalan SAKSI dari ekspor RUP data.inaproc.id (sumber utama sejak 5 Nov 2026).
// Masukan : data/rup_kota_tangerang_2025_2026.json (28.699 baris D44), data/rup_detail_kota_tangerang.json,
//           public/data/kel.geojson (104), public/data/rw.geojson (1.020)
// Keluaran: data/saksi_kota_tangerang_2025_2026.json
// Aturan  : tidak ada koordinat pekerjaan; lokasi hanya poligon RW/kelurahan/kecamatan.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const AKAR = process.cwd();
const baca = async (rel) => JSON.parse(await readFile(path.join(AKAR, rel), "utf8"));

const VERB =
  "(pekerjaan|peningkatan|rekonstruksi|pembangunan|pemeliharaan|rehabilitasi|penataan|pengaspalan|pengerasan|pembetonan|pemasangan|lanjutan|normalisasi|perbaikan|pelebaran)";
const OBJ = "(jalan|jembatan|trotoar|drainase|saluran|turap|talud|paving|hotmix|rabat|gorong)";
const BUKAN = "(puskesmas|sekolah|gedung|kantor|ruang|aula|klinik|posyandu|pasar|terminal|instalasi)";
const RE_FISIK = new RegExp(`${VERB}[^|]{0,40}${OBJ}|${OBJ}[^|]{0,25}${VERB}`, "i");
const RE_BUKAN = new RegExp(BUKAN, "i");
const RE_RW = /\bRW\.?\s*0*(\d{1,3})\b/i;
const RE_KEL_MARK = /\b(kel\.?|kelurahan)\s*([A-Za-z][\w'\- ]{2,28})/i;

const norm = (nilai) =>
  String(nilai ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/\b(jl|jalan|gang|gg|komp|komplek|kp|kampung)\.?\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const judul = (teks) => teks.toLowerCase().replace(/\b\w/g, (h) => h.toUpperCase());

const namaSatker = (teks) => judul(String(teks ?? "").split(" - ")[0].trim());

async function main() {
  const rup = (await baca("data/rup_kota_tangerang_2025_2026.json")).item ?? [];
  // Detail RUP opsional: tanpa berkas ini `bulan` dan anchor kecamatan tidak terisi.
  // Jalankan `npm run data:rup-detail` (atau `data:rup-detail-tambal`) lebih dulu bila perlu.
  let detail = new Map();
  try {
    detail = new Map(
      ((await baca("data/rup_detail_kota_tangerang.json")).item ?? []).map((d) => [String(d.kode_rup), d]),
    );
  } catch {
    console.warn("peringatan: data/rup_detail_kota_tangerang.json tidak ada — `bulan` akan kosong");
  }
  const kel = await baca("public/data/kel.geojson");
  const rw = await baca("public/data/rw.geojson");

  const kelurahanResmi = new Map();
  for (const f of kel.features) {
    const nama = String(f.properties?.wadmkd ?? "").trim();
    if (!nama) continue;
    kelurahanResmi.set(norm(nama), {
      nama,
      kecamatan: judul(String(f.properties?.wadmkc ?? "").trim()),
    });
  }

  const unitRw = new Map();
  for (const f of rw.features) {
    const kelurahan = String(f.properties?.wadmkd ?? "").trim();
    const nomor = String(f.properties?.rw ?? "").trim();
    if (!kelurahan || !nomor) continue;
    unitRw.set(`${norm(kelurahan)}|${nomor}`, {
      kecamatan: judul(String(f.properties?.wadmkc ?? "").trim()),
    });
  }

  const kecamatanResmi = new Set([...kelurahanResmi.values()].map((k) => norm(k.kecamatan)));

  const paket = [];
  let ditolakObjek = 0;
  let ditolakBukanFisik = 0;

  for (const r of rup) {
    const nama = String(r.paket ?? "").replace(/&#x27;/g, "'");
    if (!RE_FISIK.test(nama)) {
      ditolakBukanFisik += 1;
      continue;
    }
    if (RE_BUKAN.test(nama)) {
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
      const tanda = nama.match(RE_KEL_MARK);
      if (tanda && kelurahanResmi.has(norm(tanda[2]))) kelurahan = kelurahanResmi.get(norm(tanda[2]));
    }
    const cocokRw = nama.match(RE_RW);
    const nomorRw = cocokRw ? String(Number(cocokRw[1])) : null;

    const kode = String(r.kode_rup);
    const rincian = detail.get(kode);
    let presisi = "Kabupaten";
    let kecamatan = null;
    let unitId = null;

    if (kelurahan && nomorRw && unitRw.has(`${norm(kelurahan.nama)}|${nomorRw}`)) {
      presisi = "RW";
      unitId = `${norm(kelurahan.nama)}|${nomorRw}`;
      kecamatan = unitRw.get(unitId).kecamatan;
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
  await writeFile(
    path.join(AKAR, "data", "saksi_kota_tangerang_2025_2026.json"),
    JSON.stringify({ snapshot: "5 Nov 2026", sumber: "data.inaproc.id/rup", paket }),
  );

  const hitung = (kunci) =>
    paket.reduce((akumulasi, item) => {
      akumulasi[item[kunci] ?? "null"] = (akumulasi[item[kunci] ?? "null"] ?? 0) + 1;
      return akumulasi;
    }, {});
  const pagu = paket.reduce((total, item) => total + item.pagu, 0);

  console.log(`RUP dibaca        : ${rup.length}`);
  console.log(`ditolak (non-fisik): ${ditolakBukanFisik}`);
  console.log(`ditolak (objek lain): ${ditolakObjek}`);
  console.log(`paket tersimpan   : ${paket.length}`);
  console.log(`pagu              : Rp${(pagu / 1e9).toFixed(2)} M`);
  console.log(`per tahun         : ${JSON.stringify(hitung("tahun"))}`);
  console.log(`presisi           : ${JSON.stringify(hitung("presisi_peta"))}`);
  console.log(`punya bulan       : ${paket.filter((item) => item.bulan).length}`);
  console.log(`kecamatan terisi  : ${paket.filter((item) => item.kecamatan_resmi).length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
