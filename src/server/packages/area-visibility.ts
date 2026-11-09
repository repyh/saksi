import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { normalizeAreaKey, type RoadAreaLevel } from "@/contracts/packages/area-key";
import type { MapBounds } from "@/contracts/packages/road-package.contract";
import { getRegion, type RegionConfig } from "@/server/regions/region-registry";

interface BoundaryFeature {
  properties?: Record<string, unknown>;
  geometry?: { coordinates?: unknown };
}

interface BoundaryCollection {
  features?: BoundaryFeature[];
}

interface AreaBox {
  key: string;
  bbox: MapBounds;
}

interface BoundaryIndex {
  rw: AreaBox[];
  kel: AreaBox[];
  kec: AreaBox[];
}

const AKAR = process.cwd();
const cache = new Map<string, BoundaryIndex>();

function readCollection(berkas: string): BoundaryCollection {
  return JSON.parse(readFileSync(path.resolve(AKAR, berkas), "utf8")) as BoundaryCollection;
}

function coordinateBounds(value: unknown, acc: { minLon: number; minLat: number; maxLon: number; maxLat: number }) {
  if (!Array.isArray(value)) return;
  if (value.length === 2 && typeof value[0] === "number" && typeof value[1] === "number") {
    const [lon, lat] = value as [number, number];
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
    acc.minLon = Math.min(acc.minLon, lon);
    acc.minLat = Math.min(acc.minLat, lat);
    acc.maxLon = Math.max(acc.maxLon, lon);
    acc.maxLat = Math.max(acc.maxLat, lat);
    return;
  }
  for (const child of value) coordinateBounds(child, acc);
}

function featureBounds(feature: BoundaryFeature): MapBounds | null {
  const acc = { minLon: Infinity, minLat: Infinity, maxLon: -Infinity, maxLat: -Infinity };
  coordinateBounds(feature.geometry?.coordinates, acc);
  if (!Number.isFinite(acc.minLon) || !Number.isFinite(acc.minLat)) return null;
  return [acc.minLon, acc.minLat, acc.maxLon, acc.maxLat];
}

function boxesFor(
  collection: BoundaryCollection,
  keyOf: (properties: Record<string, unknown>) => string | null,
): AreaBox[] {
  const boxes: AreaBox[] = [];
  for (const feature of collection.features ?? []) {
    const properties = feature.properties ?? {};
    const key = keyOf(properties);
    if (!key) continue;
    const bbox = featureBounds(feature);
    if (!bbox) continue;
    boxes.push({ key, bbox });
  }
  return boxes;
}

function buildIndex(region: RegionConfig): BoundaryIndex {
  const kelurahan = readCollection(region.batas.kelurahan.berkas);
  const kelNama = region.batas.kelurahan.nama;
  const kecNama = region.batas.kelurahan.kecamatan;
  const lingkungan = region.batas.lingkungan;
  const kecamatan = region.batas.kecamatan;

  const kel = boxesFor(kelurahan, (properties) => {
    const nama = properties[kelNama];
    return typeof nama === "string" && nama.trim() ? normalizeAreaKey(nama) : null;
  });

  const rw = lingkungan
    ? boxesFor(readCollection(lingkungan.berkas), (properties) => {
      const desa = properties[lingkungan.nama];
      const nomor = properties[lingkungan.nomor];
      return typeof desa === "string" && desa.trim() && typeof nomor === "string" && nomor.trim()
        ? normalizeAreaKey(`${desa}|${nomor}`)
        : null;
    })
    : [];

  const kec = kecamatan
    ? boxesFor(readCollection(kecamatan.berkas), (properties) => {
      const nama = properties[kecamatan.nama];
      return typeof nama === "string" && nama.trim() ? normalizeAreaKey(nama) : null;
    })
    : boxesFor(kelurahan, (properties) => {
      const nama = properties[kecNama];
      return typeof nama === "string" && nama.trim() ? normalizeAreaKey(nama) : null;
    });

  return { rw, kel, kec };
}

function boundaryIndex(region: RegionConfig): BoundaryIndex {
  const tersimpan = cache.get(region.id);
  if (tersimpan) return tersimpan;
  let index: BoundaryIndex;
  try {
    index = buildIndex(region);
  } catch {
    // Tanpa batas yang bisa dibaca, jangan sembunyikan agregat: kembalikan indeks kosong.
    index = { rw: [], kel: [], kec: [] };
  }
  cache.set(region.id, index);
  return index;
}

function intersects(a: MapBounds, b: MapBounds) {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

/**
 * Kunci wilayah yang beririsan dengan viewport. `null` berarti jangan menyaring
 * (bbox tidak dikirim atau batas wilayah tidak tersedia untuk tingkat itu).
 */
export function visibleAreaKeys(
  regionId: string,
  level: RoadAreaLevel,
  bbox: MapBounds | null | undefined,
): Set<string> | null {
  if (!bbox) return null;
  const boxes = boundaryIndex(getRegion(regionId))[level];
  if (!boxes.length) return null;
  return new Set(boxes.filter((box) => intersects(box.bbox, bbox)).map((box) => box.key));
}
