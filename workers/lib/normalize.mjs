// Normalisasi sumber mentah menjadi baris domain. Tidak ada I/O dan tidak ada akses DB;
// hasilnya divalidasi dulu sebelum worker menulis satu transaksi.
import { bangunSnapshot } from "../../scripts/lib/snapshot.mjs";
import { judul } from "../../scripts/lib/region.mjs";
import {
  checksumJson,
  kunciArea,
  normalisasiPenyedia,
  penyediaSah,
} from "./util.mjs";

const namaPaket = (nilai) => String(nilai ?? "").replace(/&#x27;/g, "'");

const TINGKAT = {
  KECAMATAN: "KECAMATAN",
  KELURAHAN: "KELURAHAN",
  RW: "RW",
};

function barisArea({ region, sumber, baris, artifact }) {
  const p = baris.properties ?? {};
  const nama = sumber.properti?.nama;
  const nomor = sumber.properti?.nomor;
  const district = judul(
    String(
      sumber.level === "KECAMATAN" ? p[sumber.properti?.nama] : p[sumber.properti?.kecamatan],
    ).trim(),
  );
  const village =
    nama && sumber.level !== "KECAMATAN" ? judul(String(p[nama] ?? "").trim()) : null;
  const rwRaw = sumber.level === "RW" ? String(p[nomor] ?? "").trim() : null;
  const rw = rwRaw && /^\d+$/.test(rwRaw) ? String(Number(rwRaw)) : rwRaw;
  if (!district || (sumber.level !== "KECAMATAN" && !village) || (sumber.level === "RW" && !rw)) {
    return null;
  }
  return {
    stableKey: kunciArea(region.id, TINGKAT[sumber.level], {
      kecamatan: district,
      kelurahan: village,
      rw,
    }),
    level: TINGKAT[sumber.level],
    districtName: district,
    villageName: village,
    rwCode: rw,
    geometry: baris.geometry,
    sourceName: sumber.name,
    sourceFeatureId: p.objectid != null ? String(p.objectid) : null,
    datasetVersion: region.metadata.snapshot,
    retrievedAt: artifact?.retrievedAt ?? new Date().toISOString(),
    sourceArtifactId: artifact?.id ?? null,
    sourceChecksum: artifact?.checksum ?? null,
  };
}

function koordinatDuaDimensi(koordinat) {
  if (!Array.isArray(koordinat) || koordinat.length < 2) return null;
  const [lon, lat] = koordinat;
  return Number.isFinite(lon) && Number.isFinite(lat) ? [lon, lat] : null;
}

function geometriGaris(geometry) {
  if (!geometry || !["LineString", "MultiLineString"].includes(geometry.type)) return null;
  if (geometry.type === "LineString") {
    const coordinates = (geometry.coordinates ?? []).map(koordinatDuaDimensi).filter(Boolean);
    return coordinates.length >= 2 ? { type: "LineString", coordinates } : null;
  }
  const coordinates = (geometry.coordinates ?? [])
    .map((garis) => (garis ?? []).map(koordinatDuaDimensi).filter(Boolean))
    .filter((garis) => garis.length >= 2);
  return coordinates.length ? { type: "MultiLineString", coordinates } : null;
}

export function normalisasi({ region, sumber, data, artifactByKey }) {
  const sekarang = new Date().toISOString();
  const rupSumber = sumber.find((s) => s.key === "rup");
  const detailSumber = sumber.find((s) => s.key === "detail");
  const realisasiSumber = sumber.find((s) => s.key === "realisasi");
  const lpseSumber = sumber.find((s) => s.key === "lpse-cocok");
  const batasSumber = sumber.filter((s) => s.grup === "boundaries");
  const jalanSumber = sumber.find((s) => s.key === "jalan");

  const rupBaris = data.rup?.baris ?? [];
  const detailBaris = detailSumber ? data.detail?.baris ?? [] : [];
  const realisasiBaris = data.realisasi?.baris ?? [];
  const lpseBaris = data["lpse-cocok"]?.baris ?? [];

  const artRup = artifactByKey.get(rupSumber?.key);
  const artDetail = artifactByKey.get(detailSumber?.key);
  const artRealisasi = artifactByKey.get(realisasiSumber?.key);
  const artLpse = artifactByKey.get(lpseSumber?.key);

  // 1. Katalog RUP lengkap (bukan hanya paket jalan).
  const rupKode = new Set();
  const rupRows = rupBaris.map((r) => {
    const kode = String(r.kode_rup);
    rupKode.add(kode);
    return {
      region_id: region.id,
      source_artifact_id: artRup?.id ?? null,
      kode_rup: kode,
      tahun: Number(r.tahun),
      satker: String(r.satker ?? ""),
      instansi: r.instansi ? String(r.instansi) : null,
      name: namaPaket(r.paket),
      cara: r.cara ? String(r.cara) : null,
      method: r.metode && r.metode !== "-" ? String(r.metode) : null,
      jenis: r.jenis ? String(r.jenis) : null,
      sumber_dana: r.sumber_dana ? String(r.sumber_dana) : null,
      total_nilai: Math.round(Number(r.total_nilai ?? 0)),
      pdn: r.pdn ? String(r.pdn) : null,
      umk: r.umk ? String(r.umk) : null,
      is_road: false,
      checksum_sha256: checksumJson(r),
      source_retrieved_at: artRup?.retrievedAt ?? sekarang,
      updated_at: sekarang,
    };
  });

  // 2. Detail RUP: hanya yang punya pasangan RUP; sisanya tetap di raw_records.
  const detailMap = new Map();
  let detailTanpaRup = 0;
  const detailRows = [];
  for (const d of detailBaris) {
    const kode = String(d.kode_rup);
    if (!rupKode.has(kode)) {
      detailTanpaRup += 1;
      continue;
    }
    if (detailMap.has(kode)) continue;
    detailMap.set(kode, d);
    detailRows.push({
      kode_rup: kode,
      tahun: Number(d.tahun),
      satker: d.satker ? String(d.satker) : null,
      jadwal_pemilihan_mulai: d.jadwal_pemilihan_mulai ?? null,
      jadwal_pemilihan_akhir: d.jadwal_pemilihan_akhir ?? null,
      jadwal_kontrak_mulai: d.jadwal_kontrak_mulai ?? null,
      jadwal_kontrak_akhir: d.jadwal_kontrak_akhir ?? null,
      lokasi_raw: Array.isArray(d.lokasi_raw) ? d.lokasi_raw.map(String) : [],
      uraian: d.uraian ?? null,
      volume: d.volume ?? null,
      spesifikasi: d.spesifikasi ?? null,
      mak: d.mak ?? null,
      funding_sources: d.sumberDana ?? d.funding_sources ?? null,
      checksum_sha256: checksumJson(d),
      region_id: region.id,
      source_artifact_id: artDetail?.id ?? null,
      updated_at: sekarang,
    });
  }

  // 3. Paket jalan memakai fungsi yang sama dengan snapshot aplikasi.
  const { paket } = bangunSnapshot(region, { rup: rupBaris, detail: detailMap });
  const roadKode = new Set(paket.map((p) => String(p.kode_rup)));
  for (const row of rupRows) row.is_road = roadKode.has(row.kode_rup);

  const PRECISION = {
    RW: "RW",
    Kelurahan: "KELURAHAN",
    Kecamatan: "KECAMATAN",
    Kabupaten: "KABUPATEN",
  };
  const roadRows = paket.map((p) => ({
    region_id: region.id,
    rup: String(p.kode_rup),
    year: Number(p.tahun),
    name: p.nama,
    agency_name: p.satker,
    budget: p.pagu,
    method: p.metode ?? "",
    source_name: "RUP data.inaproc.id",
    source_url: `https://data.inaproc.id/rup?kode=${p.kode_rup}`,
    source_retrieved_at: artRup?.retrievedAt ?? new Date().toISOString(),
    dataset_version: region.metadata.snapshot,
    dataset_checksum: artRup?.checksum ?? null,
    location_precision: PRECISION[p.presisi_peta],
    official_district: p.kecamatan_resmi,
    official_village: p.desa_resmi,
    rw_code: p.rw,
    micro_location: p.lokasi_mikro,
    updated_at: sekarang,
    _areaLinks: [
      p.kecamatan_resmi
        ? {
            role: "KECAMATAN",
            stableKey: kunciArea(region.id, "KECAMATAN", { kecamatan: p.kecamatan_resmi }),
          }
        : null,
      p.kecamatan_resmi && p.desa_resmi
        ? {
            role: "KELURAHAN",
            stableKey: kunciArea(region.id, "KELURAHAN", {
              kecamatan: p.kecamatan_resmi,
              kelurahan: p.desa_resmi,
            }),
          }
        : null,
      p.presisi_peta === "RW" && p.kecamatan_resmi && p.desa_resmi && p.rw
        ? {
            role: "RW",
            stableKey: kunciArea(region.id, "RW", {
              kecamatan: p.kecamatan_resmi,
              kelurahan: p.desa_resmi,
              rw: p.rw,
            }),
          }
        : null,
    ].filter(Boolean),
  }));

  // 4. Batas administrasi/geometri.
  const areaMap = new Map();
  const areaRows = [];
  const areaPerLevel = { KECAMATAN: 0, KELURAHAN: 0, RW: 0 };
  let areaDitolak = 0;
  for (const sumberBatas of batasSumber) {
    const art = artifactByKey.get(sumberBatas.key);
    for (const fitur of data[sumberBatas.key]?.baris ?? []) {
      const row = barisArea({ region, sumber: sumberBatas, baris: fitur, artifact: art });
      if (!row) {
        areaDitolak += 1;
        continue;
      }
      if (areaMap.has(row.stableKey)) continue;
      areaMap.set(row.stableKey, row);
      areaRows.push(row);
      areaPerLevel[row.level] += 1;
    }
  }

  // 5. Jaringan jalan: referensi peta dan anotasi laporan, bukan sumber lokasi paket.
  const roadSegmentRows = [];
  let jalanDitolak = 0;
  if (jalanSumber) {
    const artJalan = artifactByKey.get(jalanSumber.key);
    for (const fitur of data.jalan?.baris ?? []) {
      const p = fitur?.properties ?? {};
      const objectId = String(p.objectid ?? "").trim();
      const nama = String(p.nama ?? p.namobj ?? "").trim();
      const geometry = geometriGaris(fitur?.geometry);
      if (!objectId || !nama || !geometry) {
        jalanDitolak += 1;
        continue;
      }
      const angka = (nilai) => {
        if (nilai === null || nilai === undefined || nilai === "") return null;
        const parsed = Number(nilai);
        return Number.isFinite(parsed) ? parsed : null;
      };
      const daftar = (nilai) => {
        if (Array.isArray(nilai)) return nilai.map((x) => String(x).trim()).filter(Boolean);
        return String(nilai ?? "").split(",").map((x) => x.trim()).filter(Boolean);
      };
      roadSegmentRows.push({
        region_id: region.id,
        source_object_id: objectId,
        name: nama,
        number: p.nomor ? String(p.nomor).trim() || null : null,
        length_m: angka(p.panjang),
        width_m: angka(p.lebar),
        district_names: daftar(p.kecamatan),
        village_names: daftar(p.kelurahan),
        geometry: JSON.stringify(geometry),
        source_name: jalanSumber.name,
        source_url: jalanSumber.endpoint ?? region.jalan?.layanan ?? null,
        source_retrieved_at: artJalan?.retrievedAt ?? sekarang,
        dataset_version: region.jalan?.versi ?? region.metadata.snapshot,
        is_active: true,
        updated_at: sekarang,
      });
    }
  }

  // 6. Penyedia + kontrak LPSE.
  const vendorMap = new Map();
  const tambahVendor = (nama, npwp = null) => {
    const kunci = normalisasiPenyedia(nama);
    if (!kunci) return null;
    const ada = vendorMap.get(kunci);
    if (ada) {
      if (!ada.npwp_masked && npwp) ada.npwp_masked = npwp;
      return kunci;
    }
    vendorMap.set(kunci, {
      normalized_name: kunci,
      display_name: String(nama).trim(),
      npwp_masked: npwp,
      updated_at: sekarang,
    });
    return kunci;
  };

  const lpseRows = [];
  const lpseKode = new Set();
  for (const item of lpseBaris) {
    const kode = String(item.kode_rup);
    if (lpseKode.has(kode)) throw new Error(`LPSE ganda untuk kode RUP ${kode}`);
    lpseKode.add(kode);
    const pemenang = item.pemenang?.trim() || null;
    const vendorKunci = pemenang ? tambahVendor(pemenang, item.npwp ?? null) : null;
    lpseRows.push({
      region_id: region.id,
      source_artifact_id: artLpse?.id ?? null,
      kode_rup: kode,
      lpse_id: String(item.id_lpse),
      jenis_lpse: String(item.jenis_lpse ?? "lain"),
      name: namaPaket(item.nama_lpse ?? item.nama_rup),
      status: item.status ?? null,
      method: item.metode ?? null,
      satker: item.satker ?? null,
      pagu_lpse: item.pagu_lpse != null ? Math.round(Number(item.pagu_lpse)) : null,
      hps: item.hps != null ? Math.round(Number(item.hps)) : null,
      pemenang_name: pemenang,
      npwp_masked: item.npwp ?? null,
      nilai_kontrak:
        item.nilai_kontrak != null ? Math.round(Number(item.nilai_kontrak)) : null,
      tahun: Number(item.tahun),
      matched_via: item.via ?? null,
      url: item.url ?? null,
      checksum_sha256: checksumJson(item),
      source_retrieved_at: artLpse?.retrievedAt ?? null,
      updated_at: sekarang,
      _vendorKunci: vendorKunci,
    });
  }

  // 6. Transaksi + paket realisasi. Baris tanpa pasangan RUP tetap disimpan.
  const paketMap = new Map();
  const transaksiRows = [];
  let transaksiTanpaRup = 0;
  let transaksiTanpaPenyedia = 0;
  for (const item of realisasiBaris) {
    const kodePaket = String(item.kode_paket);
    const tahun = Number(item.tahun);
    const paketKey = `${kodePaket}|${tahun}`;
    const kodeRup = item.kode_rup ? String(item.kode_rup) : null;
    // Satu baris realisasi bisa memuat beberapa kode RUP dipisah ";". Nilai mentah tetap
    // disimpan; relasi dipecah agar semua RUP yang ada di katalog terhubung.
    const kodeRupDaftar = kodeRup
      ? kodeRup.split(";").map((x) => x.trim()).filter(Boolean)
      : [];
    if (!kodeRup || !rupKode.has(kodeRup)) transaksiTanpaRup += 1;

    const sah = penyediaSah(item);
    if (!sah) transaksiTanpaPenyedia += 1;
    const vendorKunci = sah ? tambahVendor(item.penyedia) : null;
    const nilai = Math.round(Number(item.nilai ?? 0));

    let paket = paketMap.get(paketKey);
    if (!paket) {
      paket = {
        region_id: region.id,
        source_artifact_id: artRealisasi?.id ?? null,
        kode_paket: kodePaket,
        tahun,
        name: item.paket ?? null,
        satker: item.satker ?? null,
        metode: item.metode ?? null,
        sumber_transaksi: item.sumber_transaksi ?? null,
        total_nilai: 0,
        transaction_count: 0,
        rup_count: 0,
        checksum_sha256: null,
        _kodeRup: new Set(),
        _vendorNilai: new Map(),
        _vendorKunci: null,
        updated_at: sekarang,
      };
      paketMap.set(paketKey, paket);
    }
    paket.total_nilai += nilai;
    paket.transaction_count += 1;
    for (const kode of kodeRupDaftar) {
      if (rupKode.has(kode)) paket._kodeRup.add(kode);
    }
    if (vendorKunci) paket._vendorNilai.set(vendorKunci, (paket._vendorNilai.get(vendorKunci) ?? 0) + nilai);

    transaksiRows.push({
      region_id: region.id,
      source_artifact_id: artRealisasi?.id ?? null,
      package_key: paketKey,
      kode_paket: kodePaket,
      kode_rup: kodeRup,
      tahun,
      metode: item.metode ?? null,
      sumber_transaksi: item.sumber_transaksi ?? null,
      satker: item.satker ?? null,
      name: item.paket ?? null,
      penyedia_raw: item.penyedia ?? null,
      nilai,
      checksum_sha256: checksumJson(item),
      _vendorKunci: vendorKunci,
    });
  }

  const paketRows = [...paketMap.values()].map((p) => {
    const utama = [...p._vendorNilai.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    p._vendorKunci = utama?.[0] ?? null;
    p.rup_count = p._kodeRup.size;
    p.checksum_sha256 = checksumJson({
      kode: p.kode_paket,
      tahun: p.tahun,
      total: p.total_nilai,
      transaksi: p.transaction_count,
    });
    return p;
  });

  const paketRupRows = [];
  for (const p of paketRows) {
    for (const kode of p._kodeRup) {
      if (!rupKode.has(kode)) continue;
      paketRupRows.push({ package_key: `${p.kode_paket}|${p.tahun}`, kode_rup: kode });
    }
  }

  return {
    rupRows,
    detailRows,
    roadRows,
    roadSegmentRows,
    paket,
    areaRows,
    lpseRows,
    transaksiRows,
    paketRows,
    paketRupRows,
    vendorMap,
    areaMap,
    rupKode,
    stats: {
      rup: rupRows.length,
      detail: detailRows.length,
      detail_tanpa_rup: detailTanpaRup,
      road: roadRows.length,
      area: areaRows.length,
      area_per_level: areaPerLevel,
      area_ditolak: areaDitolak,
      jalan: roadSegmentRows.length,
      jalan_ditolak: jalanDitolak,
      lpse: lpseRows.length,
      lpse_dengan_pemenang: lpseRows.filter((x) => x.pemenang_name).length,
      realisasi: transaksiRows.length,
      realisasi_tanpa_rup: transaksiTanpaRup,
      realisasi_tanpa_penyedia: transaksiTanpaPenyedia,
      paket_realisasi: paketRows.length,
      paket_rup: paketRupRows.length,
      vendor: vendorMap.size,
    },
  };
}
