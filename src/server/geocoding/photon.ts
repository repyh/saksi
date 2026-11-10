import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Geometry } from "geojson";
import { ApiError } from "@/server/api/shared/api-error";
import { getRegion } from "@/server/regions/region-registry";
import { pointInGeometry } from "@/contracts/reports/location";
import type { GeocodeResponse, GeocodeResult } from "@/contracts/reports/geocode.contract";

const BASE_URL = process.env.PHOTON_BASE_URL?.trim() || "https://photon.komoot.io";
const ATTRIBUTION = "Pencarian alamat oleh Photon · data © OpenStreetMap contributors";
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 200;

type PhotonFeature = {
  geometry?: { coordinates?: number[] };
  properties?: Record<string, unknown>;
};

type Boundary = { geometry: Geometry };

const cache = new Map<string, { expiresAt: number; value: GeocodeResponse }>();
const boundaryCache = new Map<string, Promise<Boundary[]>>();

async function loadRegionBoundaries(regionId: string) {
  const existing = boundaryCache.get(regionId);
  if (existing) return existing;
  const promise = (async () => {
    const region = getRegion(regionId);
    const file = region.batas.kecamatan?.berkas ?? region.batas.kelurahan.berkas;
    const dokumen = JSON.parse(await readFile(path.resolve(process.cwd(), file), "utf8")) as {
      features?: Array<{ geometry?: Geometry }>;
    };
    return (dokumen.features ?? [])
      .map((feature) => (feature.geometry ? { geometry: feature.geometry } : null))
      .filter((item): item is Boundary => item !== null);
  })();
  boundaryCache.set(regionId, promise);
  return promise;
}

function labelOf(properties: Record<string, unknown>) {
  const bagian = [
    properties.name,
    properties.street,
    properties.district,
    properties.city,
  ]
    .map((nilai) => (typeof nilai === "string" ? nilai.trim() : ""))
    .filter(Boolean);
  return [...new Set(bagian)].join(", ") || "Lokasi tanpa nama";
}

function teks(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Proxy server-side Photon dengan cache dan filter wilayah; browser tidak memanggil Photon langsung. */
export async function geocodeAddress(query: string, regionId: string): Promise<GeocodeResponse> {
  const key = `${regionId}:${query.toLocaleLowerCase("id-ID")}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const region = getRegion(regionId);
  const boundaries = await loadRegionBoundaries(regionId);
  const [lon, lat] = region.batas.pusat ?? [106.63, -6.178];
  const url = new URL(`${BASE_URL.replace(/\/$/, "")}/api/`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "8");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "SAKSI/0.1 (prototipe pelaporan warga)" },
      signal: AbortSignal.timeout(6_000),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      502,
      "GEOCODE_UNAVAILABLE",
      "Pencarian alamat sedang tidak tersedia. Geser pin secara manual atau gunakan lokasi perangkat.",
    );
  }
  if (!response.ok) {
    throw new ApiError(
      502,
      "GEOCODE_UNAVAILABLE",
      "Pencarian alamat sedang tidak tersedia. Geser pin secara manual atau gunakan lokasi perangkat.",
    );
  }

  let dokumen: { features?: PhotonFeature[] };
  try {
    dokumen = await response.json() as { features?: PhotonFeature[] };
  } catch {
    throw new ApiError(502, "GEOCODE_UNAVAILABLE", "Jawaban pencarian alamat tidak dapat dibaca.");
  }

  const results: GeocodeResult[] = [];
  for (const feature of dokumen.features ?? []) {
    const coordinates = feature.geometry?.coordinates;
    if (!coordinates || coordinates.length < 2) continue;
    const longitude = Number(coordinates[0]);
    const latitude = Number(coordinates[1]);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) continue;
    const point = { longitude, latitude };
    if (!boundaries.some((boundary) => pointInGeometry(point, boundary.geometry))) continue;
    const properties = feature.properties ?? {};
    results.push({
      label: labelOf(properties),
      name: teks(properties.name),
      street: teks(properties.street),
      district: teks(properties.district),
      city: teks(properties.city),
      latitude,
      longitude,
      osmType: teks(properties.osm_type),
      osmId: Number.isFinite(Number(properties.osm_id)) ? Number(properties.osm_id) : null,
    });
  }

  const value = { results, attribution: ATTRIBUTION };
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  return value;
}
