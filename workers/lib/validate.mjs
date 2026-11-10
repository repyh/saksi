// Validasi batch sebelum satu baris pun ditulis ke tabel domain. Gagal = tidak ada publish.
import { readFileSync } from "node:fs";
import path from "node:path";
import { AKAR } from "../../scripts/lib/region.mjs";

export function bacaManifest(region) {
  const jalur = path.resolve(AKAR, "data", "regions", region.id, "manifest.json");
  try {
    return JSON.parse(readFileSync(jalur, "utf8"));
  } catch {
    return null;
  }
}

function hitungPresisi(roadRows) {
  return roadRows.reduce((akumulasi, row) => {
    akumulasi[row.location_precision] = (akumulasi[row.location_precision] ?? 0) + 1;
    return akumulasi;
  }, {});
}

function hitungPenyedia(hasil, roadKode) {
  const lpse = new Map();
  for (const row of hasil.lpseRows) {
    if (row.pemenang_name && row._vendorKunci && roadKode.has(row.kode_rup)) {
      lpse.set(row.kode_rup, row._vendorKunci);
    }
  }
  const realisasi = new Map();
  for (const row of hasil.transaksiRows) {
    if (!row.kode_rup || !row._vendorKunci || !roadKode.has(row.kode_rup)) continue;
    const set = realisasi.get(row.kode_rup) ?? new Set();
    set.add(row._vendorKunci);
    realisasi.set(row.kode_rup, set);
  }
  let lpseN = 0;
  let realisasiN = 0;
  let tanpa = 0;
  let tanpaPagu = 0;
  const vendor = new Set();
  const paguByKode = new Map(hasil.roadRows.map((r) => [r.rup, Number(r.budget)]));
  for (const kode of roadKode) {
    if (lpse.has(kode)) {
      lpseN += 1;
      vendor.add(lpse.get(kode));
    } else if (realisasi.has(kode)) {
      realisasiN += 1;
      for (const v of realisasi.get(kode)) vendor.add(v);
    } else {
      tanpa += 1;
      tanpaPagu += paguByKode.get(kode) ?? 0;
    }
  }
  return { lpse: lpseN, realisasi: realisasiN, tanpa, tanpaPagu, unik: vendor.size };
}

export function validasi({ hasil, manifest, hanyaJalan = false }) {
  const masalah = [];
  const tolak = (pesan) => masalah.push(pesan);
  const roadKode = new Set(hasil.roadRows.map((r) => r.rup));
  const pagu = hasil.roadRows.reduce((total, r) => total + Number(r.budget), 0);
  const presisi = hitungPresisi(hasil.roadRows);
  const penyedia = hitungPenyedia(hasil, roadKode);

  // Duplikat kunci natural.
  const cekUnik = (nama, daftar, kunci) => {
    const dilihat = new Set();
    for (const item of daftar) {
      const k = kunci(item);
      if (dilihat.has(k)) tolak(`${nama}: kunci ganda ${k}`);
      dilihat.add(k);
    }
  };
  cekUnik("rup_packages", hasil.rupRows, (r) => r.kode_rup);
  cekUnik("road_packages", hasil.roadRows, (r) => r.rup);
  cekUnik("lpse_contracts", hasil.lpseRows, (r) => r.kode_rup);
  cekUnik("administrative_areas", hasil.areaRows, (r) => r.stableKey);
  cekUnik("realization_packages", hasil.paketRows, (r) => `${r.kode_paket}|${r.tahun}`);
  cekUnik("realization_transactions", hasil.transaksiRows, (r) => r.checksum_sha256);
  cekUnik("realization_package_rups", hasil.paketRupRows, (r) => `${r.package_key}|${r.kode_rup}`);
  cekUnik("road_segments", hasil.roadSegmentRows ?? [], (r) => r.source_object_id);

  if (hanyaJalan) {
    if (manifest?.metrik?.jalan?.fitur != null
      && (hasil.roadSegmentRows?.length ?? 0) !== manifest.metrik.jalan.fitur) {
      tolak(`layer jalan: ${hasil.roadSegmentRows?.length ?? 0} ≠ manifest ${manifest.metrik.jalan.fitur}`);
    }
    return {
      lulus: masalah.length === 0,
      masalah,
      metrik: {
        jalan: hasil.roadSegmentRows?.length ?? 0,
        jalan_bernama: (hasil.roadSegmentRows ?? []).filter((r) => r.name).length,
      },
    };
  }

  // Relasi wajib.
  for (const r of hasil.roadRows) {
    if (!hasil.rupKode.has(r.rup)) tolak(`road_package ${r.rup}: tidak ada di katalog RUP`);
  }
  for (const l of hasil.lpseRows) {
    if (!hasil.rupKode.has(l.kode_rup)) tolak(`LPSE ${l.lpse_id}: kode RUP ${l.kode_rup} tidak ada`);
  }

  // Anchor harus punya poligon.
  let linkHilang = 0;
  for (const r of hasil.roadRows) {
    for (const link of r._areaLinks) {
      if (!hasil.areaMap.has(link.stableKey)) linkHilang += 1;
    }
    if (r.location_precision === "RW") {
      if (!r._areaLinks.some((x) => x.role === "RW")) tolak(`road_package ${r.rup}: presisi RW tanpa link RW`);
    }
    if (r.location_precision === "KELURAHAN") {
      if (!r._areaLinks.some((x) => x.role === "KELURAHAN")) {
        tolak(`road_package ${r.rup}: presisi kelurahan tanpa link kelurahan`);
      }
    }
    if (r.location_precision === "KECAMATAN") {
      if (!r._areaLinks.some((x) => x.role === "KECAMATAN")) {
        tolak(`road_package ${r.rup}: presisi kecamatan tanpa link kecamatan`);
      }
    }
  }

  // Rekonsiliasi dengan manifest region (bila ada) dan angka sumber.
  if (manifest?.metrik) {
    const m = manifest.metrik;
    if (m.paket != null && hasil.roadRows.length !== m.paket) {
      tolak(`paket: ${hasil.roadRows.length} ≠ manifest ${m.paket}`);
    }
    if (m.pagu != null && pagu !== m.pagu) tolak(`pagu: ${pagu} ≠ manifest ${m.pagu}`);
    const presisiManifest = {
      RW: m.presisi?.RW ?? 0,
      KELURAHAN: m.presisi?.Kelurahan ?? 0,
      KECAMATAN: m.presisi?.Kecamatan ?? 0,
      KABUPATEN: m.presisi?.Kabupaten ?? 0,
    };
    for (const [level, jumlah] of Object.entries(presisiManifest)) {
      if ((presisi[level] ?? 0) !== jumlah) {
        tolak(`presisi ${level}: ${presisi[level] ?? 0} ≠ manifest ${jumlah}`);
      }
    }
    if (m.berlokus != null) {
      const berlokus = hasil.roadRows.filter((r) => r.location_precision !== "KABUPATEN").length;
      if (berlokus !== m.berlokus) tolak(`berlokus: ${berlokus} ≠ manifest ${m.berlokus}`);
    }
    if (m.penyedia) {
      if (penyedia.lpse !== m.penyedia.lpse) tolak(`penyedia LPSE: ${penyedia.lpse} ≠ manifest ${m.penyedia.lpse}`);
      if (penyedia.realisasi !== m.penyedia.realisasi) {
        tolak(`penyedia realisasi: ${penyedia.realisasi} ≠ manifest ${m.penyedia.realisasi}`);
      }
      if (penyedia.tanpa !== m.penyedia.tanpa_rekam) {
        tolak(`tanpa rekam: ${penyedia.tanpa} ≠ manifest ${m.penyedia.tanpa_rekam}`);
      }
      if (penyedia.unik !== m.penyedia.unik) tolak(`penyedia unik: ${penyedia.unik} ≠ manifest ${m.penyedia.unik}`);
    }
    if (m.sumber) {
      if (m.sumber.rup != null && hasil.rupRows.length !== m.sumber.rup) {
        tolak(`RUP: ${hasil.rupRows.length} ≠ manifest ${m.sumber.rup}`);
      }
      if (m.sumber.detail != null && hasil.detailRows.length + hasil.stats.detail_tanpa_rup !== m.sumber.detail) {
        tolak(`detail: ${hasil.detailRows.length + hasil.stats.detail_tanpa_rup} ≠ manifest ${m.sumber.detail}`);
      }
      if (m.sumber.realisasi != null && hasil.transaksiRows.length !== m.sumber.realisasi) {
        tolak(`realisasi: ${hasil.transaksiRows.length} ≠ manifest ${m.sumber.realisasi}`);
      }
      if (m.sumber.lpse != null && hasil.lpseRows.length !== m.sumber.lpse) {
        tolak(`LPSE: ${hasil.lpseRows.length} ≠ manifest ${m.sumber.lpse}`);
      }
      if (m.sumber.batas_kecamatan != null && hasil.stats.area_per_level.KECAMATAN !== m.sumber.batas_kecamatan) {
        tolak(`batas kecamatan: ${hasil.stats.area_per_level.KECAMATAN} ≠ manifest ${m.sumber.batas_kecamatan}`);
      }
      if (m.sumber.batas_kelurahan != null && hasil.stats.area_per_level.KELURAHAN !== m.sumber.batas_kelurahan) {
        tolak(`batas kelurahan: ${hasil.stats.area_per_level.KELURAHAN} ≠ manifest ${m.sumber.batas_kelurahan}`);
      }
      if (m.sumber.batas_rw != null && hasil.stats.area_per_level.RW !== m.sumber.batas_rw) {
        tolak(`batas RW: ${hasil.stats.area_per_level.RW} ≠ manifest ${m.sumber.batas_rw}`);
      }
      if (m.sumber.jalan != null && (hasil.roadSegmentRows?.length ?? 0) !== m.sumber.jalan) {
        tolak(`layer jalan: ${hasil.roadSegmentRows?.length ?? 0} ≠ manifest ${m.sumber.jalan}`);
      }
    }
  }

  const metrik = {
    paket: hasil.roadRows.length,
    pagu,
    presisi,
    berlokus: hasil.roadRows.filter((r) => r.location_precision !== "KABUPATEN").length,
    penyedia,
    sumber: hasil.stats,
    link_area_hilang: linkHilang,
  };

  return { lulus: masalah.length === 0, masalah, metrik };
}
