"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as maplibregl from "maplibre-gl";
import { FaRoad, FaWater } from "react-icons/fa6";
import { FiChevronDown, FiChevronUp, FiMaximize } from "react-icons/fi";
import { GiBridge } from "react-icons/gi";
import type { IconType } from "react-icons";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { RoadPackageItem, RoadPackageMapData } from "@/contracts/packages/road-package.contract";
import type { RegionSummary } from "@/contracts/regions/region.contract";
import { normalizeAreaKey } from "@/contracts/packages/area-key";
import { ROAD_WORK_LABELS, ROAD_WORK_TYPES, type SpecificRoadWorkCategory } from "@/contracts/packages/road-work";
import { addressSlug, districtSlug, type ReportAddress } from "./report-routes";
import { formatRupiahFull } from "./road-types";
import { BASEMAP_URL, attributionBasemap } from "./basemap";
import {
  bringRoadHighlightToFront,
  clearRoadHighlight,
  collectRoadHighlight,
  ensureRoadHighlightLayer,
  removeRoadHighlight,
  roadHighlightKey,
  setRoadHighlight,
} from "./basemap-roads";

type BoundaryPrecision = "RW" | "Kelurahan" | "Kecamatan";

type ClickedRegion = {
  district: string | null;
  village: string | null;
  rw: string | null;
  precision: BoundaryPrecision;
};

interface MapCanvasProps {
  /** Agregat per wilayah dari server; peta tidak lagi menerima seluruh baris paket. */
  areaStats: RoadPackageMapData;
  region: RegionSummary;
  selectedPackage: RoadPackageItem | null;
  selectedRegion: ReportAddress | null;
  /** Klik poligon hanya memilih wilayah; panel paket dibuka dari register. */
  onSelectRegion: (region: ClickedRegion | null) => void;
  /** Kirim batas viewport agar agregat peta bisa dibatasi. */
  onViewportChange?: (bbox: [number, number, number, number]) => void;
  viewMode: "packages" | "budget" | "work";
  /** Jumlah paket pada filter aktif; dipakai untuk keadaan kosong di peta. */
  packageCount?: number;
  mapHeightClassName?: string;
}

type BoundaryProperties = Record<string, unknown>;
type BoundaryFields = RegionSummary["boundaryFields"];

const properti = (properties: BoundaryProperties, kunci: string | null) =>
  kunci ? properties[kunci] : undefined;
type BoundaryFeature = Feature<Geometry, BoundaryProperties>;
type BoundaryCollection = FeatureCollection<Geometry, BoundaryProperties>;
type WorkCounts = Record<SpecificRoadWorkCategory, number>;
type AreaStats = { count: number; budget: number; workCounts: WorkCounts; sampleRup: string | null };
type AreaStatsMaps = { rw: Map<string, AreaStats>; kel: Map<string, AreaStats>; kec: Map<string, AreaStats> };
type AreaView = MapCanvasProps["viewMode"];
type Highlight = "exact" | "scope" | null;
type StyledProperties = BoundaryProperties & {
  _fill: string;
  _stroke: string;
  _weight: number;
  _lineOpacity: number;
  _fillOpacity: number;
  _highlight: Highlight;
};
type StyledCollection = FeatureCollection<Geometry, StyledProperties>;

const BUDGET_COLORS = ["#EFF6FF", "#BFDBFE", "#60A5FA", "#0058A3"] as const;
const WORK_ICONS: Record<SpecificRoadWorkCategory, IconType> = {
  PERMUKAAN: FaRoad,
  DRAINASE: FaWater,
  JEMBATAN: GiBridge,
};

const KEC_ZOOM = 11;
const KEL_ZOOM = 14;
const CLASSES = [
  { min: 0, max: 0, fill: "#F1F5F9", stroke: "#94A3B8", label: "0 paket" },
  { min: 1, max: 1, fill: "#FFF4B8", stroke: "#E6C84D", label: "1 paket" },
  { min: 2, max: 3, fill: "#FFE680", stroke: "#D6B52D", label: "2–3 paket" },
  { min: 4, max: 6, fill: "#FFD633", stroke: "#C99B00", label: "4–6 paket" },
  { min: 7, max: 10, fill: "#F5B800", stroke: "#AD7C00", label: "7–10 paket" },
  { min: 11, max: Number.MAX_SAFE_INTEGER, fill: "#D98F00", stroke: "#805500", label: "11+ paket" },
] as const;

const PRECISIONS: BoundaryPrecision[] = ["Kecamatan", "Kelurahan", "RW"];
const PRECISION_STATS_KEY: Record<BoundaryPrecision, "rw" | "kel" | "kec"> = {
  RW: "rw",
  Kelurahan: "kel",
  Kecamatan: "kec",
};

const normalize = normalizeAreaKey;

// Turbopack tidak menurunkan URL worker dari import.meta.url paket; worker disalin
// ke public/vendor oleh scripts/copy-maplibre-worker.mjs (predev/prebuild).
maplibregl.setWorkerUrl("/vendor/maplibre-gl-worker.mjs");

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>\"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  })[character] ?? character);
}

function classFor(count: number, classes: typeof CLASSES | ClassBand[] = CLASSES) {
  return classes.find((item) => count >= item.min && count <= item.max) ?? classes[0];
}

type ClassBand = { min: number; max: number; fill: string; stroke: string; label: string };

// Skala jumlah paket untuk kecamatan memakai kuantil: 13 poligon dengan 90–200 paket
// tidak masuk akal dipecah dengan kelas 0/1/2–3/… seperti level RW.
function quantileCountBands(counts: Map<string, AreaStats>): ClassBand[] {
  const values = [...counts.values()].map((aggregate) => aggregate.count).filter((nilai) => nilai > 0).sort((a, b) => a - b);
  if (values.length < 4) return [...CLASSES];
  const quantile = (fraction: number) => values[Math.min(values.length - 1, Math.max(0, Math.round((values.length - 1) * fraction)))];
  const edges = [...new Set([quantile(0.2), quantile(0.4), quantile(0.6), quantile(0.8)])];
  const fills = ["#FFF4B8", "#FFE680", "#FFD633", "#F5B800", "#D98F00"];
  const strokes = ["#E6C84D", "#D6B52D", "#C99B00", "#AD7C00", "#805500"];
  const bands: ClassBand[] = edges.map((max, index) => ({
    min: index === 0 ? 1 : edges[index - 1] + 1,
    max,
    fill: fills[Math.min(index, fills.length - 2)],
    stroke: strokes[Math.min(index, strokes.length - 2)],
    label: index === 0 ? `1–${max} paket` : `${edges[index - 1] + 1}–${max} paket`,
  }));
  bands.unshift({ min: 0, max: 0, fill: "#F1F5F9", stroke: "#94A3B8", label: "0 paket" });
  const tertinggi = edges[edges.length - 1];
  bands.push({
    min: tertinggi + 1,
    max: Number.MAX_SAFE_INTEGER,
    fill: fills[fills.length - 1],
    stroke: strokes[strokes.length - 1],
    label: `> ${tertinggi} paket`,
  });
  return bands;
}

function budgetBands(counts: Map<string, AreaStats>) {
  const values = [...counts.values()].map(({ budget }) => budget).filter((budget) => budget > 0).sort((a, b) => a - b);
  if (!values.length) return [];
  const quantile = (fraction: number) => values[Math.min(values.length - 1, Math.floor((values.length - 1) * fraction))];
  const thresholds = [...new Set([quantile(0.25), quantile(0.5), quantile(0.75)])];
  return thresholds.map((threshold, index) => ({
    max: threshold,
    fill: BUDGET_COLORS[index],
    label: index === 0
      ? `≤ ${formatRupiahFull(threshold)}`
      : `${formatRupiahFull(thresholds[index - 1])} – ${formatRupiahFull(threshold)}`,
  })).concat([{
    max: Number.POSITIVE_INFINITY,
    fill: BUDGET_COLORS[Math.min(thresholds.length, BUDGET_COLORS.length - 1)],
    label: `> ${formatRupiahFull(thresholds[thresholds.length - 1])}`,
  }]);
}

function toAreaStatsMaps(data: RoadPackageMapData): AreaStatsMaps {
  const build = (rows: RoadPackageMapData["rw"]) =>
    new Map<string, AreaStats>(
      Object.entries(rows).map(([key, value]) => [
        key,
        {
          count: value.count,
          budget: value.budget,
          workCounts: { ...value.workCounts },
          sampleRup: value.sampleRup,
        },
      ]),
    );
  return { rw: build(data.rw), kel: build(data.kel), kec: build(data.kec) };
}

function workTypeIconMarkup(category: SpecificRoadWorkCategory) {
  const Icon = WORK_ICONS[category];
  return renderToStaticMarkup(
    <span
      title={ROAD_WORK_LABELS[category]}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "4px",
        border: "1px solid #0058A3",
        borderRadius: "999px",
        background: "rgba(255,255,255,.96)",
        boxShadow: "0 1px 4px rgba(10,25,47,.25)",
        pointerEvents: "none",
        color: "#0058A3",
      }}
    >
      <Icon size={12} aria-hidden="true" />
    </span>,
  );
}

function budgetClassFor(budget: number, bands: ReturnType<typeof budgetBands>) {
  return bands.find((band) => budget <= band.max) ?? bands[bands.length - 1];
}

function areaKeyFromProperties(
  properties: BoundaryProperties,
  precision: BoundaryPrecision,
  fields: BoundaryFields,
) {
  if (precision === "Kecamatan") return normalize(properti(properties, fields.kecamatan));
  return precision === "RW"
    ? normalize(`${properti(properties, fields.kelurahan)}|${properti(properties, fields.lingkungan)}`)
    : normalize(properti(properties, fields.kelurahan));
}

function areaKey(feature: BoundaryFeature, precision: BoundaryPrecision, fields: BoundaryFields) {
  return areaKeyFromProperties(feature.properties ?? {}, precision, fields);
}

function styleFor(
  feature: BoundaryFeature,
  precision: BoundaryPrecision,
  fields: BoundaryFields,
  counts: Map<string, AreaStats>,
  highlight: Highlight,
  view: AreaView,
  bands: ReturnType<typeof budgetBands>,
  classes: ClassBand[],
) {
  const key = areaKey(feature, precision, fields);
  const aggregate = counts.get(key);
  const count = aggregate?.count ?? 0;
  const bucket = view === "budget" && aggregate
    ? budgetClassFor(aggregate.budget, bands)
    : classFor(count, classes);
  const selected = highlight === "exact";
  const inSelectedScope = highlight === "scope";
  const bucketStroke = "stroke" in bucket ? bucket.stroke : bucket.fill;

  return {
    color: selected ? "#0A192F" : inSelectedScope ? "#0058A3" : bucketStroke,
    weight: selected ? 4 : inSelectedScope ? 2.5 : count === 0 ? 0.5 : 0.8,
    opacity: selected || inSelectedScope ? 1 : 0.8,
    fillColor: bucket.fill,
    fillOpacity: count === 0 ? 0.18 : 0.72,
    count,
  };
}

function featureHighlight(
  feature: BoundaryFeature,
  precision: BoundaryPrecision,
  fields: BoundaryFields,
  selected: RoadPackageItem | null,
  selectedRegion: ReportAddress | null,
): Highlight {
  const properties = feature.properties ?? {};
  const villageSlug = addressSlug(String(properti(properties, fields.kelurahan) ?? ""));
  const districtKey = normalize(properti(properties, fields.kecamatan));
  if (selectedRegion?.rwSlug) {
    const featureRw = `rw-${addressSlug(String(properti(properties, fields.lingkungan) ?? "").replace(/^rw-?/i, ""))}`;
    if (precision === "RW" && villageSlug === selectedRegion.villageSlug && featureRw === selectedRegion.rwSlug) return "exact";
    if (precision === "Kelurahan" && villageSlug === selectedRegion.villageSlug) return "scope";
    if (precision === "Kecamatan") return "scope";
  }
  if (selectedRegion?.villageSlug) {
    if (precision === "Kelurahan" && villageSlug === selectedRegion.villageSlug) return "exact";
    if (precision === "RW" && !selectedRegion.rwSlug && villageSlug === selectedRegion.villageSlug) return "scope";
    if (precision === "Kecamatan") return "scope";
  }
  if (!selected) return null;
  const key = areaKey(feature, precision, fields);

  if (selected.presisi_peta === "RW" && selected.unit_id) {
    if (precision === "RW" && key === normalize(selected.unit_id)) return "exact";
    if (precision === "Kelurahan" && selected.desa_resmi && key === normalize(selected.desa_resmi)) return "scope";
    if (precision === "Kecamatan" && selected.kecamatan_resmi && key === normalize(selected.kecamatan_resmi)) return "scope";
    return null;
  }
  if (selected.presisi_peta === "Kelurahan" && precision === "Kelurahan" && selected.desa_resmi) {
    return key === normalize(selected.desa_resmi) ? "exact" : null;
  }
  if (selected.presisi_peta === "Kelurahan" && precision === "Kecamatan" && selected.kecamatan_resmi) {
    return districtKey === normalize(selected.kecamatan_resmi) ? "scope" : null;
  }
  if (selected.presisi_peta === "Kecamatan" && precision === "Kecamatan" && selected.kecamatan_resmi) {
    return districtKey === normalize(selected.kecamatan_resmi) ? "exact" : null;
  }
  return null;
}

function styledCollection(
  data: BoundaryCollection,
  precision: BoundaryPrecision,
  fields: BoundaryFields,
  counts: Map<string, AreaStats>,
  selectedPackage: RoadPackageItem | null,
  selectedRegion: ReportAddress | null,
  view: AreaView,
  bands: ReturnType<typeof budgetBands>,
  classes: ClassBand[],
): StyledCollection {
  return {
    ...data,
    features: data.features.map((feature) => {
      const highlight = featureHighlight(feature, precision, fields, selectedPackage, selectedRegion);
      const style = styleFor(feature, precision, fields, counts, highlight, view, bands, classes);
      return {
        ...feature,
        properties: {
          ...(feature.properties ?? {}),
          _fill: style.fillColor,
          _stroke: style.color,
          _weight: style.weight,
          _lineOpacity: style.opacity,
          _fillOpacity: style.fillOpacity,
          _highlight: highlight,
          _count: style.count,
        },
      };
    }),
  };
}

type Bounds = [[number, number], [number, number]];

function visitCoordinates(geometry: Geometry, visit: (lng: number, lat: number) => void) {
  switch (geometry.type) {
    case "Point":
      visit(geometry.coordinates[0], geometry.coordinates[1]);
      break;
    case "MultiPoint":
    case "LineString":
      for (const coordinate of geometry.coordinates) visit(coordinate[0], coordinate[1]);
      break;
    case "MultiLineString":
    case "Polygon":
      for (const line of geometry.coordinates) for (const coordinate of line) visit(coordinate[0], coordinate[1]);
      break;
    case "MultiPolygon":
      for (const polygon of geometry.coordinates) for (const ring of polygon) for (const coordinate of ring) visit(coordinate[0], coordinate[1]);
      break;
    case "GeometryCollection":
      for (const child of geometry.geometries) visitCoordinates(child, visit);
      break;
  }
}

function boundsOfFeature(feature: BoundaryFeature): Bounds | null {
  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;
  visitCoordinates(feature.geometry, (lng, lat) => {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    west = Math.min(west, lng);
    south = Math.min(south, lat);
    east = Math.max(east, lng);
    north = Math.max(north, lat);
  });
  if (!Number.isFinite(west) || !Number.isFinite(south) || !Number.isFinite(east) || !Number.isFinite(north)) return null;
  return [[west, south], [east, north]];
}

function boundsOfCollection(collection: BoundaryCollection): Bounds | null {
  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;
  for (const feature of collection.features) {
    visitCoordinates(feature.geometry, (lng, lat) => {
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
      west = Math.min(west, lng);
      south = Math.min(south, lat);
      east = Math.max(east, lng);
      north = Math.max(north, lat);
    });
  }
  if (!Number.isFinite(west) || !Number.isFinite(south) || !Number.isFinite(east) || !Number.isFinite(north)) return null;
  return [[west, south], [east, north]];
}

function centerOfFeature(feature: BoundaryFeature): [number, number] | null {
  const bounds = boundsOfFeature(feature);
  if (!bounds) return null;
  return [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2];
}

/** Pengguna yang meminta gerak minimal tidak diberi animasi terbang peta. */
function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function sourceId(precision: BoundaryPrecision) {
  return `saksi-${precision.toLocaleLowerCase("id-ID")}`;
}

function fillLayerId(precision: BoundaryPrecision) {
  return `${sourceId(precision)}-fill`;
}

const ROAD_SOURCE_ID = "saksi-jaringan-jalan";

function roadTooltipHtml(layer: NonNullable<RegionSummary["roadLayer"]>, properties: BoundaryProperties) {
  const value = (kunci: string) => escapeHtml(properties[layer.fields[kunci as keyof typeof layer.fields]] ?? "");
  const kelas = value("kelas");
  const panjang = value("panjang");
  const lebar = value("lebar");
  const kecamatan = value("kecamatan");
  const kelurahan = value("kelurahan");
  const detail = [
    kelas ? `kelas ${kelas}` : null,
    panjang ? `${panjang} m` : null,
    lebar ? `lebar ${lebar} m` : null,
  ].filter(Boolean).join(" · ");
  const wilayah = [kelurahan, kecamatan ? `Kec. ${kecamatan}` : null].filter(Boolean).join(" · ");
  const nama = value("nama") || "Ruas tanpa nama";
  return `<div style="line-height:1.45"><strong>${nama}</strong>${detail ? `<br>${detail}` : ""}${wilayah ? `<br>${wilayah}` : ""}<br><span style="opacity:.7">${escapeHtml(layer.label)}${layer.sourceRelease ? ` ${escapeHtml(layer.sourceRelease)}` : ""} · referensi ruas, bukan lokasi paket</span></div>`;
}

function tooltipHtml(
  properties: BoundaryProperties,
  precision: BoundaryPrecision,
  fields: BoundaryFields,
  environmentLabel: string,
  aggregate: AreaStats | undefined,
  view: AreaView,
) {
  const title = precision === "RW"
    ? `${environmentLabel} ${escapeHtml(properti(properties, fields.lingkungan))} · ${escapeHtml(properti(properties, fields.kelurahan))}`
    : precision === "Kecamatan"
      ? `Kec. ${escapeHtml(properti(properties, fields.kecamatan))}`
      : escapeHtml(properti(properties, fields.kelurahan));
  const district = escapeHtml(properti(properties, fields.kecamatan));
  const detail = aggregate && view === "budget"
    ? `<strong>${formatRupiahFull(aggregate.budget)}</strong><br>${aggregate.count.toLocaleString("id-ID")} paket`
    : aggregate && view === "work"
      ? `${ROAD_WORK_TYPES.filter((category) => aggregate.workCounts[category] > 0).map((category) => `${ROAD_WORK_LABELS[category]}: ${aggregate.workCounts[category]}`).join("<br>")}<br><strong>${aggregate.count.toLocaleString("id-ID")} paket · ${formatRupiahFull(aggregate.budget)}</strong>`
      : aggregate
        ? `${aggregate.count.toLocaleString("id-ID")} paket · ${formatRupiahFull(aggregate.budget)}`
        : "Tidak ada paket terhubung";
  const barisKecamatan = precision === "Kecamatan" ? "" : `<span>Kec. ${district}</span><br>`;
  return `<div style="line-height:1.45"><strong>${title}</strong><br>${barisKecamatan}${detail}<br><span style="opacity:.7">Batas wilayah, bukan titik pekerjaan</span></div>`;
}

function clickedRegion(
  properties: BoundaryProperties,
  precision: BoundaryPrecision,
  fields: BoundaryFields,
): ClickedRegion {
  const district = properti(properties, fields.kecamatan);
  const village = properti(properties, fields.kelurahan);
  const rw = properti(properties, fields.lingkungan);
  return {
    district: typeof district === "string" ? district : null,
    village: precision === "Kecamatan" ? null : typeof village === "string" ? village : null,
    rw: precision === "RW" && typeof rw === "string" ? rw : null,
    precision,
  };
}

const levelLabels = (environmentLabel: string): Record<BoundaryPrecision, string> => ({
  Kecamatan: "Kecamatan",
  Kelurahan: "Kelurahan",
  RW: environmentLabel,
});

export default function MapCanvas(props: MapCanvasProps) {
  const fields = props.region.boundaryFields;
  const labels = levelLabels(props.region.environmentLabel);
  const urls = props.region.boundaries;
  const precisions = useMemo(
    () =>
      PRECISIONS.filter(
        (level) =>
          (level !== "RW" || urls.lingkungan) && (level !== "Kecamatan" || urls.kecamatan),
      ),
    [urls.lingkungan, urls.kecamatan],
  );
  const [precision, setPrecision] = useState<BoundaryPrecision>("Kelurahan");
  const [boundaries, setBoundaries] = useState<{ rw: BoundaryCollection; kel: BoundaryCollection; kec: BoundaryCollection } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [roadEnabled, setRoadEnabled] = useState(false);
  const [roadError, setRoadError] = useState(false);
  const [legendOpen, setLegendOpen] = useState(() => typeof window === "undefined" || window.matchMedia("(min-width: 1024px)").matches);
  const [aboutOpen, setAboutOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  // Tooltip yang sedang tampil; ruas jalan menang atas tooltip wilayah.
  const hoverOwnerRef = useRef<"region" | "road" | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const initialFitRef = useRef(false);
  const view: AreaView = props.viewMode;
  const onViewportChange = props.onViewportChange;
  const roadLayer = props.region.roadLayer;
  const areaStats = useMemo(() => toAreaStatsMaps(props.areaStats), [props.areaStats]);
  const bands = useMemo(
    () => ({ rw: budgetBands(areaStats.rw), kel: budgetBands(areaStats.kel), kec: budgetBands(areaStats.kec) }),
    [areaStats],
  );
  const kecClasses = useMemo(() => quantileCountBands(areaStats.kec), [areaStats.kec]);
  // Kelurahan punya rentang paket lebar (median belasan, maksimum puluhan), jadi kelas tetap
  // menumpuk hampir semua wilayah di kelas teratas. Kuantil dipakai seperti kecamatan.
  const kelClasses = useMemo(() => quantileCountBands(areaStats.kel), [areaStats.kel]);
  const classes = useMemo(
    () => ({ rw: [...CLASSES] as ClassBand[], kel: kelClasses, kec: kecClasses }),
    [kecClasses, kelClasses],
  );

  // Handler dan efek MapLibre mendaftar sekali; nilai terbaru dibaca lewat ref ini.
  const latestRef = useRef({ areaStats, bands, classes, selectedPackage: props.selectedPackage, selectedRegion: props.selectedRegion, view, precision, onSelectRegion: props.onSelectRegion, roadLayer });

  useEffect(() => {
    latestRef.current = { areaStats, bands, classes, selectedPackage: props.selectedPackage, selectedRegion: props.selectedRegion, view, precision, onSelectRegion: props.onSelectRegion, roadLayer };
  }, [areaStats, bands, classes, props.onSelectRegion, props.selectedPackage, props.selectedRegion, precision, roadLayer, view]);

  useEffect(() => {
    const controller = new AbortController();
    const ambil = (url: string, pesan: string) =>
      fetch(url, { signal: controller.signal }).then((response) => {
        if (!response.ok) throw new Error(pesan);
        return response.json() as Promise<BoundaryCollection>;
      });
    const kosong: BoundaryCollection = { type: "FeatureCollection", features: [] };
    Promise.all([
      urls.lingkungan
        ? ambil(urls.lingkungan, `Batas ${props.region.environmentLabel} tidak tersedia.`)
        : Promise.resolve(kosong),
      ambil(urls.kelurahan, "Batas kelurahan tidak tersedia."),
      urls.kecamatan
        ? ambil(urls.kecamatan, "Batas kecamatan tidak tersedia.")
        : Promise.resolve(kosong),
    ])
      .then(([rw, kel, kec]) => setBoundaries({ rw, kel, kec }))
      .catch(() => {
        if (!controller.signal.aborted) setLoadError(true);
      });
    return () => controller.abort();
  }, [props.region, urls.kecamatan, urls.kelurahan, urls.lingkungan, reloadToken]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = new maplibregl.Map({
      container,
      style: BASEMAP_URL,
      center: props.region.center,
      zoom: props.region.zoom,
      minZoom: 10,
      maxZoom: 18,
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    map.addControl(
      new maplibregl.AttributionControl({ compact: true, customAttribution: attributionBasemap(BASEMAP_URL) }),
      "bottom-left",
    );
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12, className: "saksi-region-tooltip" });
    popupRef.current = popup;
    const handleLoad = () => setMapLoaded(true);
    map.on("load", handleLoad);
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(container);
    const frame = window.requestAnimationFrame(() => map.resize());

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      map.off("load", handleLoad);
      popup.remove();
      popupRef.current = null;
      mapRef.current = null;
      initialFitRef.current = false;
      setMapLoaded(false);
      map.remove();
    };
  }, [props.region.center, props.region.zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !boundaries) return;

    const state = latestRef.current;
    const handlers: Array<() => void> = [];

    for (const level of precisions) {
      const id = sourceId(level);
      if (!map.getSource(id)) {
        map.addSource(id, {
          type: "geojson",
          data: styledCollection(
            boundaries[PRECISION_STATS_KEY[level]],
            level,
            fields,
            state.areaStats[PRECISION_STATS_KEY[level]],
            state.selectedPackage,
            state.selectedRegion,
            state.view,
            state.bands[PRECISION_STATS_KEY[level]],
            state.classes[PRECISION_STATS_KEY[level]],
          ),
        });
      }

      if (!map.getLayer(`${id}-fill`)) {
        map.addLayer({
          id: `${id}-fill`,
          type: "fill",
          source: id,
          layout: { visibility: level === state.precision ? "visible" : "none" },
          paint: {
            "fill-color": ["coalesce", ["get", "_fill"], "#F1F5F9"],
            "fill-opacity": ["coalesce", ["get", "_fillOpacity"], 0.18],
          },
        } as unknown as maplibregl.AddLayerObject);
      }

      if (!map.getLayer(`${id}-line`)) {
        map.addLayer({
          id: `${id}-line`,
          type: "line",
          source: id,
          layout: { visibility: level === state.precision ? "visible" : "none", "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": ["coalesce", ["get", "_stroke"], "#94A3B8"],
            "line-width": ["coalesce", ["get", "_weight"], 0.5],
            "line-opacity": ["coalesce", ["get", "_lineOpacity"], 0.8],
          },
        } as unknown as maplibregl.AddLayerObject);
      }

      if (!map.getLayer(`${id}-exact`)) {
        map.addLayer({
          id: `${id}-exact`,
          type: "line",
          source: id,
          filter: ["==", ["get", "_highlight"], "exact"],
          layout: { visibility: level === state.precision ? "visible" : "none", "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#0A192F", "line-width": 4, "line-opacity": 1 },
        } as unknown as maplibregl.AddLayerObject);
      }

      if (!map.getLayer(`${id}-scope`)) {
        map.addLayer({
          id: `${id}-scope`,
          type: "line",
          source: id,
          filter: ["==", ["get", "_highlight"], "scope"],
          layout: { visibility: level === state.precision ? "visible" : "none", "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#0058A3", "line-width": 2.5, "line-opacity": 1, "line-dasharray": [5, 3] },
        } as unknown as maplibregl.AddLayerObject);
      }

      // Angka paket per wilayah hanya pada zoom dekat agar peta kota tidak penuh label.
      if (!map.getLayer(`${id}-label`)) {
        map.addLayer({
          id: `${id}-label`,
          type: "symbol",
          source: id,
          minzoom: 12.5,
          filter: [">", ["get", "_count"], 0],
          layout: {
            visibility: level === state.precision ? "visible" : "none",
            "text-field": ["to-string", ["get", "_count"]],
            "text-font": ["Noto Sans Regular"],
            "text-size": ["interpolate", ["linear"], ["zoom"], 12, 10, 15, 13],
            "text-padding": 2,
            "text-allow-overlap": false,
          },
          paint: { "text-color": "#0A192F", "text-halo-color": "#FFFFFF", "text-halo-width": 1.2 },
        } as unknown as maplibregl.AddLayerObject);
      }

      const hover = (event: maplibregl.MapLayerMouseEvent) => {
        const feature = event.features?.[0];
        if (!feature) return;
        // Tooltip ruas menang saat kursor di atas jalan; jangan ditimpa tooltip wilayah.
        if (hoverOwnerRef.current === "road") return;
        hoverOwnerRef.current = "region";
        const current = latestRef.current;
        const properties = (feature.properties ?? {}) as BoundaryProperties;
        const aggregate = current.areaStats[PRECISION_STATS_KEY[level]].get(areaKeyFromProperties(properties, level, fields));
        map.getCanvas().style.cursor = "pointer";
        popupRef.current
          ?.setLngLat(event.lngLat)
          .setHTML(tooltipHtml(properties, level, fields, props.region.environmentLabel, aggregate, current.view))
          .addTo(map);
      };
      const leave = () => {
        if (hoverOwnerRef.current !== "region") return;
        hoverOwnerRef.current = null;
        map.getCanvas().style.cursor = "";
        popupRef.current?.remove();
      };
      const select = (event: maplibregl.MapLayerMouseEvent) => {
        const feature = event.features?.[0];
        if (!feature) return;
        event.preventDefault();
        const current = latestRef.current;
        const properties = (feature.properties ?? {}) as BoundaryProperties;
        current.onSelectRegion(clickedRegion(properties, level, fields));
      };
      const layerId = `${id}-fill`;
      map.on("mousemove", layerId, hover);
      map.on("mouseleave", layerId, leave);
      map.on("click", layerId, select);
      handlers.push(() => {
        map.off("mousemove", layerId, hover);
        map.off("mouseleave", layerId, leave);
        map.off("click", layerId, select);
      });
    }

    const handleMapClick = (event: maplibregl.MapMouseEvent) => {
      if (event.defaultPrevented) return;
      const active = latestRef.current.precision;
      const hits = map.queryRenderedFeatures([event.point.x, event.point.y], { layers: [fillLayerId(active)] });
      if (hits.length) return;
      latestRef.current.onSelectRegion(null);
    };
    map.on("click", handleMapClick);

    const emitViewport = () => {
      const bounds = map.getBounds();
      onViewportChange?.([bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]);
    };
    map.on("moveend", emitViewport);

    if (!initialFitRef.current) {
      const bounds = boundsOfCollection(boundaries.kel);
      if (bounds) {
        map.fitBounds(bounds, { padding: 18, animate: false });
        initialFitRef.current = true;
      }
    }

    // Sorot ruas harus tetap di atas poligon wilayah meski layer batas dibuat ulang.
    bringRoadHighlightToFront(map);

    return () => {
      map.off("click", handleMapClick);
      map.off("moveend", emitViewport);
      for (const remove of handlers) remove();
      if (mapRef.current !== map) return;
      for (const level of precisions) {
        const id = sourceId(level);
        for (const suffix of ["fill", "line", "exact", "scope", "label"]) {
          if (map.getLayer(`${id}-${suffix}`)) map.removeLayer(`${id}-${suffix}`);
        }
        if (map.getSource(id)) map.removeSource(id);
      }
    };
  }, [boundaries, fields, mapLoaded, onViewportChange, precisions, props.region.environmentLabel]);

  // Jaringan jalan digambar oleh peta dasar; layer Overture di sini tak terlihat dan hanya dipakai
  // untuk hit-test tooltip. Sorot memakai geometri ruas itu sendiri, jadi tidak ada garis ganda.
  useEffect(() => {
    const map = mapRef.current;
    const layer = latestRef.current.roadLayer;
    if (!map || !mapLoaded || !layer) return;

    const lineId = `${ROAD_SOURCE_ID}-line`;
    let hoverKey: string | null = null;
    const clearHover = () => {
      hoverKey = null;
      clearRoadHighlight(map);
    };
    const removeLayers = () => {
      if (hoverOwnerRef.current === "road") hoverOwnerRef.current = null;
      removeRoadHighlight(map);
      if (map.getLayer(lineId)) map.removeLayer(lineId);
      if (map.getSource(ROAD_SOURCE_ID)) map.removeSource(ROAD_SOURCE_ID);
      popupRef.current?.remove();
    };

    if (!roadEnabled) {
      removeLayers();
      return;
    }

    ensureRoadHighlightLayer(map);

    if (!map.getSource(ROAD_SOURCE_ID)) {
      map.addSource(ROAD_SOURCE_ID, {
        type: "vector",
        tiles: [layer.tiles],
        minzoom: layer.minzoom,
        maxzoom: layer.maxzoom,
      } as maplibregl.VectorSourceSpecification);
      map.addLayer({
        id: lineId,
        type: "line",
        source: ROAD_SOURCE_ID,
        "source-layer": layer.sourceLayer,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#6B7280",
          "line-opacity": 0,
          // Lebar hanya untuk area tangkap kursor; garisnya tidak pernah terlihat.
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, 6, 14, 8, 18, 12],
        },
      } as unknown as maplibregl.AddLayerObject);
    }

    const hover = (event: maplibregl.MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature) return;
      hoverOwnerRef.current = "road";
      map.getCanvas().style.cursor = "pointer";
      popupRef.current
        ?.setLngLat(event.lngLat)
        .setHTML(roadTooltipHtml(layer, (feature.properties ?? {}) as BoundaryProperties))
        .addTo(map);
      const key = roadHighlightKey(feature, layer.fields.nama);
      if (key === hoverKey) return;
      hoverKey = key;
      setRoadHighlight(map, collectRoadHighlight(map, lineId, feature, layer.fields.nama));
    };
    const leave = () => {
      if (hoverOwnerRef.current === "road") hoverOwnerRef.current = null;
      clearHover();
      map.getCanvas().style.cursor = "";
      popupRef.current?.remove();
    };
    map.on("mousemove", lineId, hover);
    map.on("mouseleave", lineId, leave);
    // Klik ruas hanya menampilkan atribut; tidak menautkan atau memfilter paket.
    map.on("click", lineId, hover);

    return () => {
      map.off("mousemove", lineId, hover);
      map.off("mouseleave", lineId, leave);
      map.off("click", lineId, hover);
      if (mapRef.current === map) removeLayers();
    };
  }, [mapLoaded, roadEnabled, roadLayer?.tiles]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !boundaries) return;
    const state = latestRef.current;
    for (const level of precisions) {
      const id = sourceId(level);
      const visible = level === precision;
      // Hanya tingkat yang tampil dibangun ulang; tingkat tersembunyi dibangun saat dipilih.
      if (visible) {
        const source = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
        if (source) {
          source.setData(styledCollection(
            level === "RW" ? boundaries.rw : level === "Kelurahan" ? boundaries.kel : boundaries.kec,
            level,
            fields,
            state.areaStats[PRECISION_STATS_KEY[level]],
            state.selectedPackage,
            state.selectedRegion,
            state.view,
            state.bands[PRECISION_STATS_KEY[level]],
            state.classes[PRECISION_STATS_KEY[level]],
          ));
        }
      }
      for (const suffix of ["fill", "line", "exact", "scope", "label"]) {
        if (map.getLayer(`${id}-${suffix}`)) {
          map.setLayoutProperty(`${id}-${suffix}`, "visibility", visible ? "visible" : "none");
        }
      }
    }
  }, [areaStats, bands, boundaries, classes, fields, mapLoaded, precision, precisions, props.region.environmentLabel, props.selectedPackage, props.selectedRegion, view]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !boundaries) return;
    for (const marker of markersRef.current) marker.remove();
    markersRef.current = [];
    if (view !== "work") return;

    const data = precision === "RW" ? boundaries.rw : precision === "Kelurahan" ? boundaries.kel : boundaries.kec;
    const aggregates = areaStats[PRECISION_STATS_KEY[precision]];
    // Satu wilayah bisa terpecah menjadi beberapa fitur; pakai poligon terbesar agar
    // ikon tidak muncul dua kali di wilayah yang sama.
    const perArea = new Map<string, BoundaryFeature>();
    for (const feature of data.features) {
      const key = areaKey(feature, precision, fields);
      const previous = perArea.get(key);
      if (!previous) {
        perArea.set(key, feature);
        continue;
      }
      const bounds = boundsOfFeature(feature);
      const previousBounds = boundsOfFeature(previous);
      if (!bounds || !previousBounds) continue;
      const area = (bounds[1][0] - bounds[0][0]) * (bounds[1][1] - bounds[0][1]);
      const previousArea = (previousBounds[1][0] - previousBounds[0][0]) * (previousBounds[1][1] - previousBounds[0][1]);
      if (area > previousArea) perArea.set(key, feature);
    }
    const render = () => {
      for (const marker of markersRef.current) marker.remove();
      markersRef.current = [];
      const viewport = map.getBounds();
      for (const [key, feature] of perArea) {
        const aggregate = aggregates.get(key);
        if (!aggregate) continue;
        // Satu ikon per wilayah: jenis dominan. Semua jenis tetap ada di tooltip.
        const dominan = ROAD_WORK_TYPES.reduce<SpecificRoadWorkCategory | null>((best, category) => {
          if (aggregate.workCounts[category] <= 0) return best;
          if (!best || aggregate.workCounts[category] > aggregate.workCounts[best]) return category;
          return best;
        }, null);
        if (!dominan) continue;
        const center = centerOfFeature(feature);
        if (!center || !viewport.contains(center)) continue;
        const element = document.createElement("div");
        element.className = "saksi-work-type-icon";
        element.style.pointerEvents = "none";
        element.innerHTML = workTypeIconMarkup(dominan);
        const marker = new maplibregl.Marker({ element, anchor: "center" }).setLngLat(center).addTo(map);
        markersRef.current.push(marker);
      }
    };
    render();
    map.on("moveend", render);

    return () => {
      map.off("moveend", render);
      for (const marker of markersRef.current) marker.remove();
      markersRef.current = [];
    };
  }, [areaStats, boundaries, fields, mapLoaded, precision, precisions, view]);

  useEffect(() => {
    const map = mapRef.current;
    const pkg = props.selectedPackage;
    if (!map || !mapLoaded || !boundaries || !pkg || props.selectedRegion?.villageSlug) return;
    if (pkg.presisi_peta !== "RW" && pkg.presisi_peta !== "Kelurahan" && pkg.presisi_peta !== "Kecamatan") return;
    if (pkg.presisi_peta === "RW" && !pkg.unit_id) return;
    if (pkg.presisi_peta === "Kelurahan" && !pkg.desa_resmi) return;
    if (pkg.presisi_peta === "Kecamatan" && !pkg.kecamatan_resmi) return;
    const target: BoundaryPrecision = pkg.presisi_peta === "RW" ? "RW" : pkg.presisi_peta === "Kelurahan" ? "Kelurahan" : "Kecamatan";
    const data = target === "RW" ? boundaries.rw : target === "Kelurahan" ? boundaries.kel : boundaries.kec;
    const key = target === "RW"
      ? normalize(pkg.unit_id ?? "")
      : target === "Kelurahan"
        ? normalize(pkg.desa_resmi)
        : normalize(pkg.kecamatan_resmi);
    if (!key) return;
    const feature = data.features.find((candidate) => areaKey(candidate, target, fields) === key);
    if (!feature) return;
    const bounds = boundsOfFeature(feature);
    const maxZoom = target === "RW" ? 15 : target === "Kelurahan" ? KEL_ZOOM : KEC_ZOOM;
    if (bounds) map.fitBounds(bounds, { padding: 28, maxZoom, duration: reducedMotion() ? 0 : 700 });
  }, [boundaries, fields, mapLoaded, props.selectedPackage, props.selectedRegion]);

  useEffect(() => {
    const map = mapRef.current;
    const region = props.selectedRegion;
    if (!map || !mapLoaded || !boundaries || !region) return;
    const duration = reducedMotion() ? 0 : 700;
    if (region.villageSlug) {
      const target: BoundaryPrecision = region.rwSlug ? "RW" : "Kelurahan";
      const data = target === "RW" ? boundaries.rw : boundaries.kel;
      const feature = data.features.find((candidate) => {
        const properties = candidate.properties ?? {};
        if (addressSlug(String(properti(properties, fields.kelurahan) ?? "")) !== region.villageSlug) return false;
        if (target === "RW") {
          return `rw-${addressSlug(String(properti(properties, fields.lingkungan) ?? "").replace(/^rw-?/i, ""))}` === region.rwSlug;
        }
        return true;
      });
      if (!feature) return;
      const bounds = boundsOfFeature(feature);
      if (bounds) map.fitBounds(bounds, { padding: 28, maxZoom: target === "RW" ? 15 : KEL_ZOOM, duration });
      return;
    }
    // Kecamatan tanpa kelurahan terpilih tetap harus menggerakkan peta; sebelumnya peta diam
    // dan filter wilayah tampak tidak berpengaruh.
    if (!region.districtSlug) return;
    const feature = boundaries.kec.features.find(
      (candidate) => districtSlug(String(properti(candidate.properties ?? {}, fields.kecamatan) ?? "")) === region.districtSlug,
    );
    if (!feature) return;
    const bounds = boundsOfFeature(feature);
    if (bounds) map.fitBounds(bounds, { padding: 28, maxZoom: KEC_ZOOM + 2, duration });
  }, [boundaries, fields, mapLoaded, props.region.environmentLabel, props.selectedRegion]);

  const activeBands = precision === "RW" ? bands.rw : precision === "Kelurahan" ? bands.kel : bands.kec;
  const activeClasses = precision === "RW" ? classes.rw : precision === "Kelurahan" ? classes.kel : classes.kec;
  const wilayahLabel = precision === "RW" ? props.region.environmentLabel : precision === "Kelurahan" ? "kelurahan" : "kecamatan";
  const legendTitle = props.viewMode === "budget"
    ? `Nilai anggaran per ${wilayahLabel}`
    : props.viewMode === "work"
      ? "Jenis pekerjaan"
      : `Paket per ${wilayahLabel}`;
  const legendItems = props.viewMode === "work"
    ? ROAD_WORK_TYPES.map((category) => ({ fill: "transparent", label: ROAD_WORK_LABELS[category], icon: WORK_ICONS[category] }))
    : props.viewMode === "budget"
      ? [{ fill: "#F1F5F9", label: "Tanpa paket" }, ...activeBands]
      : activeClasses;
  const hasSpecificRegion = Boolean(
    props.selectedPackage &&
      ((props.selectedPackage.presisi_peta === "RW" && props.selectedPackage.unit_id) ||
        (props.selectedPackage.presisi_peta === "Kelurahan" && props.selectedPackage.desa_resmi) ||
        (props.selectedPackage.presisi_peta === "Kecamatan" && props.selectedPackage.kecamatan_resmi)),
  );

  const fitCity = () => {
    const map = mapRef.current;
    if (!map || !boundaries) return;
    const bounds = boundsOfCollection(boundaries.kel);
    if (bounds) map.fitBounds(bounds, { padding: 18, duration: reducedMotion() ? 0 : 600 });
  };

  // Pindah ke tingkat RW pada zoom kota membuat poligon selebar jalan. Bawa pengguna ke
  // kelurahan terpilih, atau paling sedikit ke zoom tempat RW terbaca.
  const selectPrecision = (level: BoundaryPrecision) => {
    setPrecision(level);
    if (level !== "RW") return;
    const map = mapRef.current;
    if (!map || !boundaries) return;
    const duration = reducedMotion() ? 0 : 600;
    const village = props.selectedRegion?.villageSlug;
    if (village) {
      const feature = boundaries.kel.features.find(
        (candidate) => addressSlug(String(properti(candidate.properties ?? {}, fields.kelurahan) ?? "")) === village,
      );
      const bounds = feature ? boundsOfFeature(feature) : null;
      if (bounds) {
        map.fitBounds(bounds, { padding: 28, maxZoom: 14.5, duration });
        return;
      }
    }
    if (map.getZoom() < 13.5) map.easeTo({ zoom: 13.5, duration });
  };

  return (
    <div className={`relative z-0 isolate w-full overflow-hidden bg-muted/30 ${props.mapHeightClassName ?? "h-[580px]"}`}>
      <div
        ref={containerRef}
        className="h-full w-full"
        role="region"
        aria-label={`Peta koroplet batas ${wilayahLabel} paket jalan`}
        aria-describedby="saksi-map-help"
        tabIndex={0}
      />
      <p id="saksi-map-help" className="sr-only">
        Gunakan tombol panah untuk menggeser peta dan tombol plus atau minus untuk memperbesar.
        Tingkat wilayah dipilih lewat tombol Kecamatan, Kelurahan, atau {props.region.environmentLabel}.
      </p>
      <div className="saksi-map-overlay absolute top-3 left-14 z-10 flex max-w-[calc(100%-4rem)] flex-wrap overflow-hidden border border-border bg-white/95 shadow-sm">
        {precisions.map((tingkat) => (
          <button
            key={tingkat}
            type="button"
            onClick={() => selectPrecision(tingkat)}
            aria-pressed={precision === tingkat}
            title={`Tampilkan poligon ${labels[tingkat].toLowerCase()}`}
            className={`whitespace-nowrap px-2.5 py-1.5 font-sans text-[10px] font-bold uppercase tracking-[0.08em] transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${
              precision === tingkat ? "bg-primary text-white" : "text-foreground/70 hover:bg-muted"
            }`}
          >
            {labels[tingkat]}
          </button>
        ))}
        {roadLayer ? (
          <button
            type="button"
            onClick={() => { setRoadError(false); setRoadEnabled((current) => !current); }}
            aria-pressed={roadEnabled}
            title={roadEnabled ? "Matikan sorot dan info ruas jalan" : "Aktifkan sorot dan info ruas jalan"}
            className={`whitespace-nowrap border-l border-border px-2.5 py-1.5 font-sans text-[10px] font-bold uppercase tracking-[0.08em] transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${
              roadEnabled ? "bg-[#334155] text-white" : "text-foreground/70 hover:bg-muted"
            }`}
          >
            Jaringan jalan
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={fitCity}
        aria-label="Lihat seluruh kota"
        title="Lihat seluruh kota"
        className="saksi-map-overlay absolute top-[88px] left-3 z-10 flex size-8 items-center justify-center border border-border bg-white/95 text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <FiMaximize className="size-4" aria-hidden="true" />
      </button>
      {props.selectedPackage && !hasSpecificRegion ? (
        <div className="saksi-map-overlay absolute top-[128px] left-3 z-10 max-w-[min(18rem,calc(100%-1.5rem))] border border-border bg-white/95 px-3 py-2 text-xs leading-5 text-foreground shadow-sm">
          RUP {props.selectedPackage.kode_rup} tidak memiliki kecocokan wilayah kecamatan/kelurahan/{props.region.environmentLabel}; peta tidak menandai area tertentu.
        </div>
      ) : null}
      <div className="saksi-map-overlay absolute right-3 bottom-3 z-10 w-[min(17rem,calc(100%-1.5rem))] border border-border bg-white/95 text-foreground shadow-sm">
        <button
          type="button"
          onClick={() => setLegendOpen((open) => !open)}
          aria-expanded={legendOpen}
          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left font-sans text-[11px] font-bold focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
        >
          <span>{legendTitle}</span>
          {legendOpen ? <FiChevronDown className="size-3.5 shrink-0" aria-hidden="true" /> : <FiChevronUp className="size-3.5 shrink-0" aria-hidden="true" />}
        </button>
        {legendOpen ? (
          <div className="border-t border-border px-3 py-2 text-xs">
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {legendItems.map((item) => {
                const Icon = "icon" in item ? item.icon : undefined;
                return (
                  <li key={item.label} className="flex items-center gap-1.5">
                    <span className={`flex size-3.5 shrink-0 items-center justify-center border border-foreground/20 ${Icon ? "rounded-full bg-white" : ""}`} style={Icon ? undefined : { backgroundColor: item.fill }} aria-hidden="true">
                      {Icon ? <Icon className="size-2.5 text-[#0058A3]" /> : null}
                    </span>
                    <span className="leading-4">{item.label}</span>
                  </li>
                );
              })}
            </ul>
            {props.viewMode === "work" ? (
              <p className="mt-1.5 border-t border-border pt-1.5 text-[10px] leading-4 text-muted-foreground">
                Ikon = jenis dominan; warna wilayah = jumlah paket.
              </p>
            ) : props.viewMode === "budget" ? (
              <p className="mt-1.5 border-t border-border pt-1.5 text-[10px] leading-4 text-muted-foreground">
                Skala nilai pagu, bukan status atau peringatan.
              </p>
            ) : null}
            {hasSpecificRegion ? (
              <p className="mt-1.5 flex items-center gap-1.5 border-t border-border pt-1.5 text-[11px]">
                <span className="size-3 shrink-0 border-[3px] border-[#0A192F] bg-transparent" aria-hidden="true" />
                <span>Wilayah paket dipilih</span>
              </p>
            ) : null}
            {roadLayer && roadEnabled ? (
              <p className="mt-1.5 border-t border-border pt-1.5 text-[10px] leading-4 text-muted-foreground">
                Ruas: {roadLayer.label}
                {roadLayer.sourceRelease ? ` ${roadLayer.sourceRelease}` : ""} · {roadLayer.attribution}
                {roadLayer.license === "ODbL-1.0" ? " · ODbL-1.0" : ""}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => setAboutOpen((open) => !open)}
              aria-expanded={aboutOpen}
              className="mt-1.5 border-t border-border pt-1.5 font-sans text-[11px] font-bold text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {aboutOpen ? "Tutup penjelasan" : "Tentang peta"}
            </button>
            {aboutOpen ? (
              <div className="mt-1 space-y-1 text-[10px] leading-4 text-muted-foreground">
                <p>
                  {props.viewMode === "budget"
                    ? "Warna menunjukkan total pagu paket per wilayah; skala ini bukan status atau peringatan."
                    : props.viewMode === "work"
                      ? "Ikon menandai jenis pekerjaan dominan; warna wilayah menunjukkan jumlah paket."
                      : "Warna menunjukkan jumlah paket pada tiap wilayah."}
                  {" "}Arahkan kursor ke wilayah untuk angkanya.
                </p>
                <p>Paket tidak punya titik koordinat; peta memakai batas wilayah. Lokasi pekerjaan di dalam batas tidak diketahui.</p>
                <p>Pindah ke tingkat {props.region.environmentLabel} memperbesar tampilan; paket yang hanya diketahui hingga kelurahan tidak dibagi ke {props.region.environmentLabel}.</p>
                <p>Angka kecamatan menjumlahkan semua paket di dalamnya, termasuk yang presisi {props.region.environmentLabel} dan kelurahan.</p>
                {roadLayer ? (
                  <p>
                    “Jaringan jalan” menyalakan sorot ruas dan tooltip dari {roadLayer.label}
                    {roadLayer.sourceRelease ? ` ${roadLayer.sourceRelease}` : ""} · {roadLayer.attribution}
                    {roadLayer.license === "ODbL-1.0" ? " · lisensi ODbL-1.0" : ""}. Garis jalan berasal dari peta dasar; ruas hanya referensi, bukan lokasi atau penaut paket.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {roadError ? (
        <div role="status" className="saksi-map-overlay absolute top-[128px] left-14 z-10 border border-border bg-white/95 px-3 py-2 text-xs text-muted-foreground">
          Layer jaringan jalan tidak dapat dimuat.
        </div>
      ) : null}
      {props.packageCount === 0 && !loadError && mapLoaded ? (
        <div role="status" className="saksi-map-overlay absolute bottom-20 left-3 z-10 max-w-[min(20rem,calc(100%-1.5rem))] border border-border bg-white/95 px-3 py-2 text-xs leading-5 text-foreground shadow-sm">
          Tidak ada paket yang cocok dengan filter ini. Longgarkan filter atau hapus pencarian.
        </div>
      ) : null}
      {loadError ? (
        <div role="alert" className="saksi-map-overlay absolute top-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 border border-border bg-white/95 px-3 py-2 text-xs text-muted-foreground">
          <span>Batas wilayah tidak dapat dimuat.</span>
          <button
            type="button"
            onClick={() => { setLoadError(false); setReloadToken((token) => token + 1); }}
            className="font-bold text-primary underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Coba lagi
          </button>
        </div>
      ) : null}
    </div>
  );
}
