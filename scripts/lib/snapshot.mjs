// Inti pembangun snapshot paket jalan. Dipakai oleh scripts/build-snapshot.mjs (CLI) dan
// workers/ingest.mjs supaya normalisasi worker dan snapshot aplikasi tidak pernah berbeda.
// Tidak ada I/O di sini: masukan sudah dibaca pemanggil.
import { judul, norm } from "./region.mjs";
import { jenisBukanFisik, namaNonFisik, objekJalan, objekLain } from "./road-filter.mjs";

export const SEKTOR_JALAN = "Jalan, Jembatan & Drainase";

export const namaSatker = (teks) => judul(String(teks ?? "").split(" - ")[0].trim());

/**
 * Bangun daftar paket jalan dari baris RUP + detail.
 * `detail` boleh Map(kode_rup -> detail) atau array detail.
 */
export function bangunSnapshot(region, { rup, detail: detailMasukan } = {}) {
  const { kelurahanResmi, unitLingkungan, aliasKelurahan, reLingkungan, reKelurahan } = region;
  const detail =
    detailMasukan instanceof Map
      ? detailMasukan
      : new Map((detailMasukan ?? []).map((d) => [String(d.kode_rup), d]));

  const kecamatanResmi = new Set([...kelurahanResmi.values()].map((k) => norm(k.kecamatan)));

  const paket = [];
  let ditolakObjek = 0;
  let ditolakBukanFisik = 0;
  let ditolakNonKonstruksi = 0;
  const aliasDipakai = new Map();

  for (const r of rup ?? []) {
    const nama = String(r.paket ?? "").replace(/&#x27;/g, "'");
    if (!objekJalan(nama)) {
      ditolakBukanFisik += 1;
      continue;
    }
    if (objekLain(nama)) {
      ditolakObjek += 1;
      continue;
    }
    // Jenis pengadaan RUP lebih kuat daripada nama: barang, jasa lainnya, dan jasa konsultansi
    // bukan paket pekerjaan jalan meski namanya menyebut jalan/jembatan/drainase.
    if (jenisBukanFisik(r.jenis)) {
      ditolakNonKonstruksi += 1;
      continue;
    }
    if (namaNonFisik(nama)) {
      ditolakNonKonstruksi += 1;
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
      bulan:
        rincian?.jadwal_pemilihan_mulai &&
        String(rincian.jadwal_pemilihan_mulai).slice(-4) === String(r.tahun)
          ? rincian.jadwal_pemilihan_mulai
          : null,
      sektor: SEKTOR_JALAN,
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

  return { paket, ditolakObjek, ditolakBukanFisik, ditolakNonKonstruksi, aliasDipakai };
}

/** Serialisasi snapshot persis seperti berkas yang dibaca aplikasi. */
export function serialisasiSnapshot(snapshot, paket) {
  return JSON.stringify({ snapshot: snapshot.snapshot, sumber: snapshot.sumber, paket });
}
