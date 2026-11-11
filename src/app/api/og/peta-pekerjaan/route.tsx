import { readFileSync } from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import { addressSlug, districtSlug, parseReportSegments } from "@/features/map/report-routes";
import { getRegion, resolveRegionId } from "@/server/regions/region-registry";
import { getSiteOrigin } from "@/lib/seo";
import { loadBrandFonts } from "@/components/seo/og-fonts";
import {
  EMBLEM_FRAME_PATH,
  EMBLEM_SOLID_PATH,
  EMBLEM_VIEWBOX,
  WORDMARK_PATH,
  WORDMARK_VIEWBOX,
} from "@/components/brand/mark-geometry";

export const runtime = "nodejs";

const SIZE = { width: 1200, height: 630 };
const COLORS = {
  ink: "#0b1b33",
  muted: "#52647a",
  blue: "#075da8",
  yellow: "#ffdc19",
  border: "#d5deea",
  map: "#edf4fb",
  mapStroke: "#78a6d0",
  selected: "#ffdc19",
};

type Position = [number, number];
type Geometry = { type: "Polygon" | "MultiPolygon"; coordinates: Position[][] | Position[][][] };
type Feature = { properties: Record<string, unknown>; geometry: Geometry };
type FeatureCollection = { features: Feature[] };
type MapShape = { d: string; selected: boolean };

const geojsonCache = new Map<string, FeatureCollection>();

function readGeoJSON(file: string): FeatureCollection {
  const cached = geojsonCache.get(file);
  if (cached) return cached;
  // Region boundary files are public/data GeoJSON; keep tracing scoped to that directory.
  const fullPath = path.join(process.cwd(), "public", "data", path.basename(file));
  const data = JSON.parse(readFileSync(fullPath, "utf8")) as FeatureCollection;
  geojsonCache.set(file, data);
  return data;
}

function featureRings(feature: Feature): Position[][] {
  if (feature.geometry.type === "Polygon") return feature.geometry.coordinates as Position[][];
  return (feature.geometry.coordinates as Position[][][]).flat();
}

function compactRing(ring: Position[], maxPoints: number): Position[] {
  if (ring.length <= maxPoints) return ring;
  const step = Math.ceil((ring.length - 1) / (maxPoints - 1));
  const compact = ring.filter((_, index) => index % step === 0);
  const last = ring[ring.length - 1];
  if (compact.at(-1) !== last) compact.push(last);
  return compact;
}

function toMapShapes(features: Array<{ feature: Feature; selected: boolean }>): MapShape[] {
  const points = features.flatMap(({ feature }) => featureRings(feature).flatMap((ring) => ring));
  if (!points.length) return [];
  const longitudes = points.map(([longitude]) => longitude);
  const latitudes = points.map(([, latitude]) => latitude);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const width = Math.max((maxLon - minLon) * Math.cos((minLat * Math.PI) / 180), 0.001);
  const height = Math.max(maxLat - minLat, 0.001);
  const scale = 340 / Math.max(width, height);
  const offsetX = (400 - width * scale) / 2;
  const offsetY = (400 - height * scale) / 2;

  return features.map(({ feature, selected }) => {
    const d = featureRings(feature).map((ring) => {
      const compact = compactRing(ring, selected ? 500 : 220);
      return compact.map(([longitude, latitude], index) => {
        const x = offsetX + (longitude - minLon) * Math.cos((minLat * Math.PI) / 180) * scale;
        const y = offsetY + (maxLat - latitude) * scale;
        return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(" ") + " Z";
    }).join(" ");
    return { d, selected };
  });
}

function selectedFeature(regionId: string, segments: string[]) {
  const selection = parseReportSegments(segments);
  const region = getRegion(regionId);
  const kelurahanField = region.batas.kelurahan.nama;
  const districtFile = region.batas.kecamatan?.berkas ?? region.batas.kelurahan.berkas;
  const districtField = region.batas.kecamatan?.nama ?? region.batas.kelurahan.kecamatan;
  const city = readGeoJSON(districtFile).features;
  const matchesDistrict = (value: unknown) =>
    !selection.districtSlug || districtSlug(String(value ?? "")) === selection.districtSlug;
  const district = selection.districtSlug
    ? city.find((feature) => matchesDistrict(feature.properties[districtField]))
    : undefined;

  if (selection.districtSlug && !district) return { city, selected: null, areaLabel: null };

  const lingkungan = region.batas.lingkungan;
  if (selection.rwSlug && lingkungan) {
    const rw = addressSlug(selection.rwSlug.replace(/^rw-?/i, ""));
    const feature = readGeoJSON(lingkungan.berkas).features.find((item) =>
      addressSlug(String(item.properties[lingkungan.nomor] ?? "")) === rw
      && (!selection.villageSlug || addressSlug(String(item.properties[kelurahanField] ?? "")) === selection.villageSlug)
      && matchesDistrict(item.properties[lingkungan.kecamatan]),
    );
    if (feature) {
      const area = `RW ${String(feature.properties[lingkungan.nomor])}`;
      const village = String(feature.properties[kelurahanField]);
      return { city, selected: feature, areaLabel: `${area} · ${village}` };
    }
  }
  if (selection.villageSlug) {
    const kecamatanField = region.batas.kelurahan.kecamatan;
    const feature = readGeoJSON(region.batas.kelurahan.berkas).features.find((item) =>
      addressSlug(String(item.properties[kelurahanField] ?? "")) === selection.villageSlug
      && matchesDistrict(item.properties[kecamatanField]),
    );
    if (feature) {
      return {
        city,
        selected: feature,
        areaLabel: `${String(feature.properties[kelurahanField])} · ${String(feature.properties[kecamatanField])}`,
      };
    }
  }
  if (district) {
    return { city, selected: district, areaLabel: `Kecamatan ${String(district.properties[districtField])}` };
  }
  return { city, selected: null, areaLabel: null };
}

function getFilterLabels(search: URLSearchParams) {
  const year = search.get("tahun");
  const rawWork = search.get("jenis")?.toLocaleUpperCase("id-ID");
  const work = rawWork === "PERMUKAAN" ? "Jalan" : rawWork === "DRAINASE" ? "Drainase" : rawWork === "JEMBATAN" ? "Jembatan" : null;
  const query = search.get("q")?.trim().slice(0, 48);
  const group = search.get("kelompok");
  const view = search.get("tampilan");
  const viewLabel = view === "budget" ? "Sebaran pagu" : view === "work" ? "Jenis pekerjaan" : null;
  return [
    year === "2025" || year === "2026" ? `Tahun ${year}` : null,
    work,
    viewLabel,
    group && /^[1-9]$|^10$/.test(group) ? `Kelompok D${group}` : null,
    search.get("umum") === "1" ? "Lokasi umum" : search.get("lokasi") === "0" ? "Termasuk lokasi umum" : null,
    query ? `Pencarian: “${query}”` : null,
  ].filter(Boolean) as string[];
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const search = requestUrl.searchParams;
  const regionId = resolveRegionId(search.get("region"));
  const regionLabel = getRegion(regionId).label;
  const siteHost = getSiteOrigin().host;
  const segments = (search.get("area") ?? "").split("/").filter(Boolean).slice(0, 8).map((segment) => segment.slice(0, 96));
  const labels = getFilterLabels(search);

  let shapes: MapShape[] = [];
  let areaLabel: string | null = null;
  try {
    const selection = selectedFeature(regionId, segments);
    areaLabel = selection.areaLabel;
    const mapFeatures = selection.selected
      ? [{ feature: selection.selected, selected: true }]
      : selection.city.map((feature) => ({ feature, selected: false }));
    shapes = toMapShapes(mapFeatures);
  } catch {
    // Berkas batas tidak terbaca: kartu tetap dibuat, hanya tanpa gambar peta.
    shapes = [];
    areaLabel = null;
  }

  const heading = areaLabel ?? regionLabel;
  const focusLabel = areaLabel ? "Area pilihan" : "Cakupan peta";
  const response = new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", padding: 32, backgroundColor: "#f7f9fc", color: COLORS.ink, fontFamily: "Open Sans, sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", padding: "34px 42px", border: `1px solid ${COLORS.border}`, borderTop: `10px solid ${COLORS.blue}`, backgroundColor: "#ffffff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <svg width={32} height={38} viewBox={EMBLEM_VIEWBOX} fill="none">
              <path d={EMBLEM_FRAME_PATH} fill={COLORS.yellow} fillRule="evenodd" />
              <path d={EMBLEM_SOLID_PATH} fill={COLORS.blue} fillRule="evenodd" />
            </svg>
            <svg width={89} height={22} viewBox={WORDMARK_VIEWBOX} fill="none">
              <path d={WORDMARK_PATH} fill={COLORS.blue} />
            </svg>
            <div style={{ display: "flex", marginLeft: 4, fontSize: 16, color: COLORS.muted }}>Sistem Akuntabilitas &amp; Komparasi Spasial Infrastruktur</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 28 }}>
            <div style={{ display: "flex", flexDirection: "column", width: 610 }}>
              <div style={{ display: "flex", marginBottom: 16, fontSize: 17, fontWeight: 600, letterSpacing: 2.5, color: COLORS.blue, textTransform: "uppercase" }}>{focusLabel}</div>
              <div style={{ display: "flex", fontFamily: "Raleway, sans-serif", fontSize: areaLabel ? 42 : 48, fontWeight: 800, lineHeight: 1.12 }}>{heading}</div>
              <div style={{ display: "flex", marginTop: 14, fontSize: 23, color: COLORS.muted }}>Peta pekerjaan jalan · {regionLabel}</div>
              {labels.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 24 }}>{labels.map((label) => <div key={label} style={{ display: "flex", padding: "8px 12px", border: `1px solid ${COLORS.border}`, backgroundColor: "#f7f9fc", color: COLORS.muted, fontSize: 16 }}>{label}</div>)}</div>}
            </div>
            <div style={{ display: "flex", width: 400, height: 400, alignItems: "center", justifyContent: "center", border: `1px solid ${COLORS.border}`, backgroundColor: COLORS.map }}>
              <svg width="380" height="380" viewBox="0 0 400 400" fill="none">
                {shapes.map((shape, index) => <path key={index} d={shape.d} fill={shape.selected ? COLORS.selected : "#c9dff1"} fillOpacity={shape.selected ? 1 : 0.82} stroke={shape.selected ? COLORS.blue : COLORS.mapStroke} strokeWidth={shape.selected ? 2.6 : 1.35} strokeLinejoin="round" />)}
              </svg>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 14, borderTop: `1px solid ${COLORS.border}`, color: COLORS.muted, fontSize: 15 }}>
            <div style={{ display: "flex" }}>Data publik · wilayah · kontrak</div>
            <div style={{ display: "flex", fontWeight: 600, color: COLORS.blue }}>{siteHost}</div>
          </div>
        </div>
      </div>
    ),
    { ...SIZE, fonts: loadBrandFonts() },
  );

  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800");
  return new Response(response.body, { status: response.status, headers });
}
