import "server-only";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { RegionOption, RegionSummary } from "@/contracts/regions/region.contract";

/**
 * Registry region dibaca dari data/regions/<id>/region.json. Tidak ada daftar region yang
 * ditanam di kode: menambah direktori region baru cukup menambah konfigurasi.
 */

export interface RegionConfig {
  id: string;
  label: string;
  instansi: string;
  tahun: number[];
  metadata: { snapshot: string; sumber: string };
  sumber: { rup: string; detail?: string; realisasi?: string };
  keluaran: string;
  batas: {
    kelurahan: { berkas: string; nama: string; kecamatan: string };
    lingkungan?: {
      berkas: string;
      nama: string;
      kecamatan: string;
      nomor: string;
      label: string;
    };
    kecamatan?: { berkas: string; nama: string };
    pusat?: [number, number];
    zoom?: number;
  };
  lokasi: { token_lingkungan?: string[]; penanda_kelurahan: string[] };
  lpse?: { base: string; direktori: string; keluaran: string };
  realisasi?: { satker_pu?: string };
  jalan?: {
    sumber: "overture";
    release?: string;
    tipe?: string;
    subtype?: string;
    /** Opsional; bila kosong dihitung dari batas kecamatan/kelurahan region. */
    bbox?: [number, number, number, number];
    berkas: string;
    tiles: string;
    tile_minzoom?: number;
    tile_maxzoom?: number;
    tile_layer?: string;
    tile_tolerance?: number;
    label?: string;
    atribusi?: string;
    lisensi?: string;
    filter?: {
      kelas_dipakai?: string[];
      kelas_dibuang?: string[];
    };
    presisi?: number;
    simplify?: number;
  };
}

export const DEFAULT_REGION_ID = "kota-tangerang";

const AKAR = process.cwd();
const DIREKTORI = path.join(AKAR, "data", "regions");

let cache: Map<string, RegionConfig> | undefined;

function muatSemua(): Map<string, RegionConfig> {
  if (cache) return cache;
  const hasil = new Map<string, RegionConfig>();
  for (const entri of readdirSync(DIREKTORI, { withFileTypes: true })) {
    if (!entri.isDirectory()) continue;
    const berkas = path.join(DIREKTORI, entri.name, "region.json");
    try {
      const config = JSON.parse(readFileSync(berkas, "utf8")) as RegionConfig;
      if (config.id === entri.name) hasil.set(config.id, config);
    } catch {
      // Region tanpa region.json yang sah diabaikan; build/check region yang memberi error jelas.
    }
  }
  cache = hasil;
  return hasil;
}

export function getRegionOrNull(id: string | null | undefined): RegionConfig | null {
  if (!id) return null;
  return muatSemua().get(id) ?? null;
}

export function getRegion(id: string = DEFAULT_REGION_ID): RegionConfig {
  const region = getRegionOrNull(id);
  if (!region) throw new Error(`Region "${id}" tidak dikenal.`);
  return region;
}

/** Nilai query yang tidak dikenal jatuh ke region bawaan; API tetap menolak region tak dikenal. */
export function resolveRegionId(value: string | string[] | null | undefined): string {
  const id = Array.isArray(value) ? value[0] : value;
  return id && getRegionOrNull(id) ? id : DEFAULT_REGION_ID;
}

export function listRegions(): RegionOption[] {
  return [...muatSemua().values()]
    .map((region) => ({ id: region.id, label: region.label }))
    .sort((a, b) => a.label.localeCompare(b.label, "id"));
}

/** Ubah path publik (public/data/...) menjadi URL yang disajikan Next. */
function urlPublik(berkas: string): string | null {
  const absolut = path.resolve(AKAR, berkas);
  const relatif = path.relative(path.join(AKAR, "public"), absolut);
  if (!relatif || relatif.startsWith("..")) return null;
  return `/${relatif.split(path.sep).join("/")}`;
}

export function regionSummary(region: RegionConfig): RegionSummary {
  const lingkungan = region.batas.lingkungan;
  const kecamatan = region.batas.kecamatan;
  const kelurahanUrl = urlPublik(region.batas.kelurahan.berkas);
  if (!kelurahanUrl) {
    throw new Error(`Region "${region.id}": batas kelurahan harus berada di public/.`);
  }
  return {
    id: region.id,
    label: region.label,
    environmentLabel: lingkungan?.label ?? "Lingkungan",
    boundaries: {
      lingkungan: lingkungan ? urlPublik(lingkungan.berkas) : null,
      kelurahan: kelurahanUrl,
      kecamatan: kecamatan ? urlPublik(kecamatan.berkas) : null,
    },
    boundaryFields: {
      kelurahan: region.batas.kelurahan.nama,
      kecamatan: region.batas.kelurahan.kecamatan,
      lingkungan: lingkungan?.nomor ?? null,
    },
    roadLayer: region.jalan
      ? {
        tiles: `/api/jalan-tiles/${encodeURIComponent(region.id)}/{z}/{x}/{y}`,
        minzoom: region.jalan.tile_minzoom ?? 10,
        maxzoom: region.jalan.tile_maxzoom ?? 16,
        sourceLayer: region.jalan.tile_layer ?? "jalan",
        label: region.jalan.label ?? "Jaringan jalan Overture",
        attribution: region.jalan.atribusi ?? "© OpenStreetMap contributors, Overture Maps Foundation (ODbL)",
        license: region.jalan.lisensi ?? "ODbL-1.0",
        sourceRelease: region.jalan.release ?? null,
        fields: {
          id: "id",
          nama: "nama",
          kelas: "kelas",
          panjang: "panjang",
          lebar: "lebar",
          kecamatan: "kecamatan",
          kelurahan: "kelurahan",
        },
      }
      : null,
    center: region.batas.pusat ?? [106.63, -6.178],
    zoom: region.batas.zoom ?? 11,
  };
}

export function listRegionSummaries(): RegionSummary[] {
  return listRegions().map((item) => regionSummary(getRegion(item.id)));
}
