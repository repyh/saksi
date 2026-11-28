"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as maplibregl from "maplibre-gl";
import { FaRoad, FaRupiahSign, FaWater } from "react-icons/fa6";
import { FiChevronDown, FiChevronUp, FiLayers, FiMaximize, FiPackage } from "react-icons/fi";
import { GiBridge } from "react-icons/gi";
import type { IconType } from "react-icons";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { RoadPackageItem, RoadPackageMapData } from "@/contracts/packages/road-package.contract";
import type { RegionSummary } from "@/contracts/regions/region.contract";
import { normalizeAreaKey } from "@/contracts/packages/area-key";
import { ROAD_WORK_LABELS, ROAD_WORK_TYPES, type SpecificRoadWorkCategory } from "@/contracts/packages/road-work";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { addressSlug, districtSlug, type ReportAddress } from "./report-routes";
import { formatRupiahCompact, formatRupiahFull } from "./road-types";
import { BASEMAP_URL, attributionBasemap } from "./basemap";
import type { WorkCounts } from "./work-encoding";
import { CLUSTER_RADIUS_PX, clusterWorkBadges, type WorkBadgePoint } from "./work-clustering";
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
  viewMode: "packages" | "budget";
  /** Pilihan tema dipindah ke atas peta; papan ketik dan pembaca layar memakai tombol yang sama. */
  onViewModeChange: (view: "packages" | "budget") => void;
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

/** Ramp biru lima kelas; ujung terang dibuat lebih gelap agar terbaca di atas Positron. */
const BUDGET_COLORS = ["#DCE9F6", "#B4D0EA", "#7FAEDC", "#3D7FBF", "#0058A3"] as const;

const THEMES: ReadonlyArray<{ value: AreaView; label: string; icon: IconType }> = [
  { value: "packages", label: "Jumlah paket", icon: FiPackage },
  { value: "budget", label: "Nilai anggaran", icon: FaRupiahSign },
];

const WORK_ICONS: Record<SpecificRoadWorkCategory, IconType> = {
  PERMUKAAN: FaRoad,
  DRAINASE: FaWater,
  JEMBATAN: GiBridge,
};

const WORK_ICON_MARKUP: Record<SpecificRoadWorkCategory, string> = {
  PERMUKAAN: renderToStaticMarkup(<FaRoad size={9} aria-hidden="true" />),
  DRAINASE: renderToStaticMarkup(<FaWater size={9} aria-hidden="true" />),
  JEMBATAN: renderToStaticMarkup(<GiBridge size={9} aria-hidden="true" />),
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

/** Rentang rupiah dengan satuan yang tidak diulang: `Rp2–3,2 Miliar`. */
function rupiahRange(low: number, high: number) {
  const a = formatRupiahCompact(low);
  const b = formatRupiahCompact(high);
  const [nilaiA, ...satuanA] = a.split(" ");
  const [nilaiB, ...satuanB] = b.split(" ");
  if (satuanA.length && satuanA.join(" ") === satuanB.join(" ")) {
    return `${nilaiA}–${nilaiB} ${satuanA.join(" ")}`;
  }
  return `${a} – ${b}`;
}

function budgetBands(counts: Map<string, AreaStats>) {
  const values = [...counts.values()].map(({ budget }) => budget).filter((budget) => budget > 0).sort((a, b) => a - b);
  if (!values.length) return [];
  const quantile = (fraction: number) => values[Math.min(values.length - 1, Math.max(0, Math.floor((values.length - 1) * fraction)))];
  const thresholds = [...new Set([quantile(0.2), quantile(0.4), quantile(0.6), quantile(0.8)])];
  return thresholds.map((threshold, index) => ({
    max: threshold,
    fill: BUDGET_COLORS[index],
    label: index === 0
      ? `≤ ${formatRupiahCompact(threshold)}`
      : rupiahRange(thresholds[index - 1], threshold),
  })).concat([{
    max: Number.POSITIVE_INFINITY,
    fill: BUDGET_COLORS[Math.min(thresholds.length, BUDGET_COLORS.length - 1)],
    label: `> ${formatRupiahCompact(thresholds[thresholds.length - 1])}`,
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

function budgetClassFor(budget: number, bands: ReturnType<typeof budgetBands>) {
  return bands.find((band) => budget <= band.max) ?? bands[bands.length - 1];
}

/**
 * Penanda jenis per wilayah: semua jenis yang ada, masing-masing dengan jumlah paketnya.
 * Kotak kecil berlatar putih, bukan pin, agar tidak terbaca sebagai titik lokasi pekerjaan.
 * Saat beberapa wilayah berdekatan di layar, penanda digabung menjadi kartu grup klikable.
 */
function workBadgeMarkup(counts: WorkCounts, areaCount = 1, areaUnit = "") {
  const categories = ROAD_WORK_TYPES.filter((category) => counts[category] > 0);
  if (!categories.length) return "";
  const items = categories.map(
    (category) =>
      `<span style="display:inline-flex;align-items:center;gap:2px;color:#0058A3">${WORK_ICON_MARKUP[category]}<span style="font-family:'Open Sans',sans-serif;font-size:8px;font-weight:700;line-height:9px;color:#0A192F">${counts[category]}</span></span>`,
  );
  const summary = categories
    .map((category) => `${ROAD_WORK_LABELS[category]}: ${counts[category]}`)
    .join(" · ");
  if (areaCount > 1) {
    const label = `Gabungan ${areaCount} ${areaUnit} · ${summary} · klik untuk memperbesar`;
    return `<button type="button" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}" style="display:inline-flex;flex-direction:column;align-items:stretch;overflow:hidden;padding:0;border:1px solid #0058A3;border-radius:2px;background:rgba(255,255,255,.97);box-shadow:2px 2px 0 rgba(0,88,163,.2);cursor:pointer"><span style="display:block;padding:1px 4px;background:#0058A3;font-family:'Open Sans',sans-serif;font-size:7.5px;font-weight:700;line-height:10px;letter-spacing:.03em;color:#fff;white-space:nowrap;text-align:center">${areaCount} ${escapeHtml(areaUnit)}</span><span style="display:inline-flex;flex-direction:column;align-items:flex-start;gap:1px;padding:2px 3px">${items.join("")}</span></button>`;
  }
  return `<span title="${escapeHtml(summary)}" style="display:inline-flex;flex-direction:column;align-items:flex-start;gap:1px;padding:1px 3px;border:1px solid rgba(10,25,47,.24);border-radius:2px;background:rgba(255,255,255,.95);box-shadow:0 1px 2px rgba(10,25,47,.18);pointer-events:none">${items.join("")}</span>`;
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
    ? budgetClassFor(aggregate.budget, bands) ?? classFor(count, classes)
    : classFor(count, classes);
  const selected = highlight === "exact";
  const inSelectedScope = highlight === "scope";
  const bucketStroke = "stroke" in bucket ? bucket.stroke : bucket.fill;

  // Tema jenis pekerjaan memakai koroplet jumlah yang sama; jenisnya dibawa ikon
  // per wilayah, sehingga peta tetap terisi dan tidak ada wilayah yang kosong.
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

function boundsOfFeature(feature: BoundaryFeature): Bounds | null {  let west = Number.POSITIVE_INFINITY;
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

/** Pengguna yang meminta gerak minimal tidak diberi animasi terbang peta. */
function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Layar besar membuka legenda otomatis; ponsel membiarkannya tertutup agar peta dan atribusi tetap terlihat. */
function useLayarBesar() {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia("(min-width: 1024px)");
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => false,
  );
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
  // Komposisi jenis selalu ikut di tooltip karena penanda di peta hanya memuat angka.
  const komposisi = aggregate
    ? ROAD_WORK_TYPES.filter((category) => aggregate.workCounts[category] > 0)
      .map((category) => `${ROAD_WORK_LABELS[category]}: ${aggregate.workCounts[category]}`)
      .join("<br>")
    : "";
  const detail = !aggregate
    ? "Tidak ada paket terhubung"
    : [
      view === "budget"
        ? `<strong>${formatRupiahFull(aggregate.budget)}</strong><br>${aggregate.count.toLocaleString("id-ID")} paket`
        : `${aggregate.count.toLocaleString("id-ID")} paket · ${formatRupiahFull(aggregate.budget)}`,
      komposisi ? `<span style="opacity:.85">${komposisi}</span>` : null,
    ].filter(Boolean).join("<br>");
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

const boundaryCache = new Map<string, Promise<BoundaryCollection>>();

function loadBoundary(url: string, errorMessage: string): Promise<BoundaryCollection> {
  const cached = boundaryCache.get(url);
  if (cached) return cached;
  const request = fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(errorMessage);
      return response.json() as Promise<BoundaryCollection>;
    })
    .catch((error) => {
      boundaryCache.delete(url);
      throw error;
    });
  boundaryCache.set(url, request);
  return request;
}

type AreaGeometryEntry = {
  key: string;
  feature: BoundaryFeature;
  bounds: Bounds;
  center: [number, number];
};

const areaGeometryCache = new WeakMap<
  BoundaryCollection,
  Partial<Record<BoundaryPrecision, AreaGeometryEntry[]>>
>();

function getAreaGeometries(
  collection: BoundaryCollection,
  precision: BoundaryPrecision,
  fields: BoundaryFields,
): AreaGeometryEntry[] {
  let byPrecision = areaGeometryCache.get(collection);
  if (!byPrecision) {
    byPrecision = {};
    areaGeometryCache.set(collection, byPrecision);
  }
  const cached = byPrecision[precision];
  if (cached) return cached;

  // Satu wilayah bisa terpecah menjadi beberapa fitur; pakai poligon terbesar agar
  // ikon tidak muncul dua kali di wilayah yang sama.
  const perArea = new Map<string, { feature: BoundaryFeature; bounds: Bounds; area: number }>();
  for (const feature of collection.features) {
    const key = areaKey(feature, precision, fields);
    if (!key) continue;
    const bounds = boundsOfFeature(feature);
    if (!bounds) continue;
    const area = (bounds[1][0] - bounds[0][0]) * (bounds[1][1] - bounds[0][1]);
    const previous = perArea.get(key);
    if (!previous || area > previous.area) {
      perArea.set(key, { feature, bounds, area });
    }
  }

  const entries: AreaGeometryEntry[] = [];
  for (const [key, item] of perArea) {
    entries.push({
      key,
      feature: item.feature,
      bounds: item.bounds,
      center: [(item.bounds[0][0] + item.bounds[1][0]) / 2, (item.bounds[0][1] + item.bounds[1][1]) / 2],
    });
  }
  byPrecision[precision] = entries;
  return entries;
}

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
  const [boundaries, setBoundaries] = useState<Partial<Record<"rw" | "kel" | "kec", BoundaryCollection>>>({});
  const [loadError, setLoadError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [loadedMap, setLoadedMap] = useState<maplibregl.Map | null>(null);
  const [roadEnabled, setRoadEnabled] = useState(false);
  const [roadError, setRoadError] = useState(false);
  // Di mobile legenda tertutup; hanya layar besar yang membukanya otomatis.
  const layarBesar = useLayarBesar();
  const [legendPreference, setLegendPreference] = useState<boolean | null>(null);
  const legendOpen = legendPreference ?? layarBesar;
  const [aboutOpen, setAboutOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  // Tooltip yang sedang tampil; ruas jalan menang atas tooltip wilayah.
  const hoverOwnerRef = useRef<"region" | "road" | null>(null);
  const hoveredFeatureRef = useRef<{ source: string; id: string | number } | null>(null);
  const hoveredTooltipKeyRef = useRef<string | null>(null);
  const appliedInputsRef = useRef<
    Partial<
      Record<
        BoundaryPrecision,
        {
          collection: BoundaryCollection;
          areaStats: RoadPackageMapData;
          view: AreaView;
          selectedPackage: RoadPackageItem | null;
          selectedRegion: ReportAddress | null;
        }
      >
    >
  >({});
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
  const latestRef = useRef({
    areaStats,
    bands,
    classes,
    selectedPackage: props.selectedPackage,
    selectedRegion: props.selectedRegion,
    view,
    precision,
    onSelectRegion: props.onSelectRegion,
    roadLayer,
    fields,
    environmentLabel: props.region.environmentLabel,
  });

  useEffect(() => {
    latestRef.current = {
      areaStats,
      bands,
      classes,
      selectedPackage: props.selectedPackage,
      selectedRegion: props.selectedRegion,
      view,
      precision,
      onSelectRegion: props.onSelectRegion,
      roadLayer,
      fields,
      environmentLabel: props.region.environmentLabel,
    };
  }, [areaStats, bands, classes, fields, props.onSelectRegion, props.region.environmentLabel, props.selectedPackage, props.selectedRegion, precision, roadLayer, view]);

  const needKel = true;
  const needRw = Boolean(
    urls.lingkungan &&
      (precision === "RW" || props.selectedRegion?.rwSlug || props.selectedPackage?.presisi_peta === "RW"),
  );
  const needKec = Boolean(
    urls.kecamatan &&
      (precision === "Kecamatan" ||
        props.selectedRegion?.districtSlug ||
        props.selectedPackage?.presisi_peta === "Kecamatan"),
  );

  useEffect(() => {
    let cancelled = false;
    const tasks: Array<{ level: "rw" | "kel" | "kec"; url: string; message: string }> = [];
    if (needKel) {
      tasks.push({ level: "kel", url: urls.kelurahan, message: "Batas kelurahan tidak tersedia." });
    }
    if (needRw && urls.lingkungan) {
      tasks.push({
        level: "rw",
        url: urls.lingkungan,
        message: `Batas ${props.region.environmentLabel} tidak tersedia.`,
      });
    }
    if (needKec && urls.kecamatan) {
      tasks.push({ level: "kec", url: urls.kecamatan, message: "Batas kecamatan tidak tersedia." });
    }
    if (reloadToken > 0) {
      for (const task of tasks) boundaryCache.delete(task.url);
    }

    for (const task of tasks) {
      loadBoundary(task.url, task.message)
        .then((collection) => {
          if (cancelled) return;
          setLoadError(false);
          setBoundaries((previous) =>
            previous[task.level] === collection ? previous : { ...previous, [task.level]: collection },
          );
        })
        .catch(() => {
          if (!cancelled) setLoadError(true);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [needKec, needKel, needRw, props.region.environmentLabel, reloadToken, urls.kecamatan, urls.kelurahan, urls.lingkungan]);

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
    // Setelah gaya peta siap, ukur ulang kanvas sebelum lapisan koroplet digambar:
    // wadah fleksibel kadang belum punya tinggi final saat peta dibuat.
    const handleLoad = () => {
      map.resize();
      setLoadedMap(map);
    };
    map.on("load", handleLoad);
    let resizeFrame = 0;
    const resizeObserver = new ResizeObserver(() => {
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = 0;
        map.resize();
      });
    });
    resizeObserver.observe(container);
    const frame = window.requestAnimationFrame(() => map.resize());

    return () => {
      window.cancelAnimationFrame(frame);
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
      resizeObserver.disconnect();
      map.off("load", handleLoad);
      popup.remove();
      popupRef.current = null;
      hoveredFeatureRef.current = null;
      hoveredTooltipKeyRef.current = null;
      appliedInputsRef.current = {};
      mapRef.current = null;
      initialFitRef.current = false;
      setLoadedMap(null);
      map.remove();
    };
  }, [props.region.center, props.region.zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || loadedMap !== map || !map.getStyle()) return;

    const clearPolygonHover = () => {
      const hovered = hoveredFeatureRef.current;
      if (hovered && map.getSource(hovered.source)) {
        map.setFeatureState({ source: hovered.source, id: hovered.id }, { hover: false });
      }
      hoveredFeatureRef.current = null;
      hoveredTooltipKeyRef.current = null;
      if (hoverOwnerRef.current === "region") {
        hoverOwnerRef.current = null;
        map.getCanvas().style.cursor = "";
        popupRef.current?.remove();
      }
    };

    const handleMouseMove = (event: maplibregl.MapMouseEvent) => {
      if (hoverOwnerRef.current === "road") {
        clearPolygonHover();
        return;
      }
      const current = latestRef.current;
      const active = current.precision;
      const layerId = fillLayerId(active);
      if (!map.getLayer(layerId)) {
        clearPolygonHover();
        return;
      }
      const feature = map.queryRenderedFeatures(event.point, { layers: [layerId] })[0];
      if (!feature) {
        clearPolygonHover();
        return;
      }
      const source = sourceId(active);
      const prev = hoveredFeatureRef.current;
      if (feature.id !== undefined && (prev?.source !== source || prev?.id !== feature.id)) {
        if (prev && map.getSource(prev.source)) {
          map.setFeatureState({ source: prev.source, id: prev.id }, { hover: false });
        }
        map.setFeatureState({ source, id: feature.id }, { hover: true });
        hoveredFeatureRef.current = { source, id: feature.id };
      } else if (feature.id === undefined && prev) {
        if (map.getSource(prev.source)) {
          map.setFeatureState({ source: prev.source, id: prev.id }, { hover: false });
        }
        hoveredFeatureRef.current = null;
      }

      hoverOwnerRef.current = "region";
      map.getCanvas().style.cursor = "pointer";
      const properties = (feature.properties ?? {}) as BoundaryProperties;
      const key = areaKeyFromProperties(properties, active, current.fields);
      const aggregate = current.areaStats[PRECISION_STATS_KEY[active]].get(key);
      const tooltipKey = `${active}:${key}:${current.view}:${aggregate?.count ?? 0}:${aggregate?.budget ?? 0}:${current.environmentLabel}`;
      const popup = popupRef.current;
      if (popup) {
        if (hoveredTooltipKeyRef.current !== tooltipKey) {
          hoveredTooltipKeyRef.current = tooltipKey;
          popup.setHTML(tooltipHtml(properties, active, current.fields, current.environmentLabel, aggregate, current.view));
        }
        popup.setLngLat(event.lngLat);
        if (!popup.isOpen()) popup.addTo(map);
      }
    };

    const handleMapClick = (event: maplibregl.MapMouseEvent) => {
      if (event.defaultPrevented) return;
      const current = latestRef.current;
      const active = current.precision;
      const layerId = fillLayerId(active);
      if (!map.getLayer(layerId)) return;
      const feature = map.queryRenderedFeatures(event.point, { layers: [layerId] })[0];
      if (feature) {
        current.onSelectRegion(clickedRegion((feature.properties ?? {}) as BoundaryProperties, active, current.fields));
      } else {
        current.onSelectRegion(null);
      }
    };

    const emitViewport = () => {
      if (!onViewportChange) return;
      const bounds = map.getBounds();
      onViewportChange([bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]);
    };

    const canvas = map.getCanvas();
    map.on("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", clearPolygonHover);
    map.on("click", handleMapClick);
    if (onViewportChange) map.on("moveend", emitViewport);

    return () => {
      map.off("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", clearPolygonHover);
      map.off("click", handleMapClick);
      if (onViewportChange) map.off("moveend", emitViewport);
    };
  }, [loadedMap, onViewportChange]);

  // Jaringan jalan digambar oleh peta dasar; layer Overture di sini tak terlihat dan hanya dipakai
  // untuk hit-test tooltip. Sorot memakai geometri ruas itu sendiri, jadi tidak ada garis ganda.
  useEffect(() => {
    const map = mapRef.current;
    const layer = latestRef.current.roadLayer;
    if (!map || loadedMap !== map || !layer || !map.getStyle()) return;

    const lineId = `${ROAD_SOURCE_ID}-line`;
    let hoverKey: string | null = null;
    let tooltipKey: string | null = null;
    const clearHover = () => {
      hoverKey = null;
      tooltipKey = null;
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
      const key = roadHighlightKey(feature, layer.fields.nama);
      const popup = popupRef.current;
      if (popup) {
        if (tooltipKey !== key) {
          tooltipKey = key;
          popup.setHTML(roadTooltipHtml(layer, (feature.properties ?? {}) as BoundaryProperties));
        }
        popup.setLngLat(event.lngLat);
        if (!popup.isOpen()) popup.addTo(map);
      }
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
  }, [loadedMap, roadEnabled, roadLayer?.tiles]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || loadedMap !== map || !map.getStyle()) return;

    if (!initialFitRef.current && boundaries.kel) {
      const bounds = boundsOfCollection(boundaries.kel);
      if (bounds) {
        map.fitBounds(bounds, { padding: 18, animate: false });
        initialFitRef.current = true;
      }
    }

    const activeCollection = boundaries[PRECISION_STATS_KEY[precision]];
    const hovered = hoveredFeatureRef.current;
    if (hovered && hovered.source !== sourceId(precision)) {
      if (map.getSource(hovered.source)) {
        map.setFeatureState({ source: hovered.source, id: hovered.id }, { hover: false });
      }
      hoveredFeatureRef.current = null;
      hoveredTooltipKeyRef.current = null;
      if (hoverOwnerRef.current === "region") {
        hoverOwnerRef.current = null;
        map.getCanvas().style.cursor = "";
        popupRef.current?.remove();
      }
    }

    let addedLayers = false;
    for (const level of precisions) {
      const id = sourceId(level);
      const visible = level === precision;
      if (visible && activeCollection) {
        const statsKey = PRECISION_STATS_KEY[level];
        const nextInputs = {
          collection: activeCollection,
          areaStats: props.areaStats,
          view,
          selectedPackage: props.selectedPackage,
          selectedRegion: props.selectedRegion,
        };
        const prevInputs = appliedInputsRef.current[level];
        const needsData =
          !prevInputs ||
          prevInputs.collection !== nextInputs.collection ||
          prevInputs.areaStats !== nextInputs.areaStats ||
          prevInputs.view !== nextInputs.view ||
          prevInputs.selectedPackage !== nextInputs.selectedPackage ||
          prevInputs.selectedRegion !== nextInputs.selectedRegion;

        if (!map.getSource(id)) {
          map.addSource(id, {
            type: "geojson",
            generateId: true,
            data: styledCollection(
              activeCollection,
              level,
              fields,
              areaStats[statsKey],
              props.selectedPackage,
              props.selectedRegion,
              view,
              bands[statsKey],
              classes[statsKey],
            ),
          });
          appliedInputsRef.current[level] = nextInputs;
        } else if (needsData) {
          const source = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
          if (source) {
            source.setData(styledCollection(
              activeCollection,
              level,
              fields,
              areaStats[statsKey],
              props.selectedPackage,
              props.selectedRegion,
              view,
              bands[statsKey],
              classes[statsKey],
            ));
            appliedInputsRef.current[level] = nextInputs;
            hoveredFeatureRef.current = null;
            hoveredTooltipKeyRef.current = null;
          }
        }

        if (!map.getLayer(`${id}-fill`)) {
          addedLayers = true;
          map.addLayer({
            id: `${id}-fill`,
            type: "fill",
            source: id,
            layout: { visibility: "visible" },
            paint: {
              "fill-color": ["coalesce", ["get", "_fill"], "#F1F5F9"],
              "fill-opacity": ["coalesce", ["get", "_fillOpacity"], 0.18],
            },
          } as unknown as maplibregl.AddLayerObject);
        }
        if (!map.getLayer(`${id}-line`)) {
          addedLayers = true;
          map.addLayer({
            id: `${id}-line`,
            type: "line",
            source: id,
            layout: { visibility: "visible", "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": ["coalesce", ["get", "_stroke"], "#94A3B8"],
              "line-width": ["coalesce", ["get", "_weight"], 0.5],
              "line-opacity": ["coalesce", ["get", "_lineOpacity"], 0.8],
            },
          } as unknown as maplibregl.AddLayerObject);
        }
        if (!map.getLayer(`${id}-hover`)) {
          addedLayers = true;
          map.addLayer({
            id: `${id}-hover`,
            type: "line",
            source: id,
            layout: { visibility: "visible", "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": "#0A192F",
              "line-width": 2,
              "line-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.85, 0],
            },
          } as unknown as maplibregl.AddLayerObject);
        }
        if (!map.getLayer(`${id}-exact`)) {
          addedLayers = true;
          map.addLayer({
            id: `${id}-exact`,
            type: "line",
            source: id,
            filter: ["==", ["get", "_highlight"], "exact"],
            layout: { visibility: "visible", "line-join": "round", "line-cap": "round" },
            paint: { "line-color": "#0A192F", "line-width": 4, "line-opacity": 1 },
          } as unknown as maplibregl.AddLayerObject);
        }
        if (!map.getLayer(`${id}-scope`)) {
          addedLayers = true;
          map.addLayer({
            id: `${id}-scope`,
            type: "line",
            source: id,
            filter: ["==", ["get", "_highlight"], "scope"],
            layout: { visibility: "visible", "line-join": "round", "line-cap": "round" },
            paint: { "line-color": "#0058A3", "line-width": 2.5, "line-opacity": 1, "line-dasharray": [5, 3] },
          } as unknown as maplibregl.AddLayerObject);
        }
      }

      for (const suffix of ["fill", "line", "hover", "exact", "scope"]) {
        if (map.getLayer(`${id}-${suffix}`)) {
          map.setLayoutProperty(`${id}-${suffix}`, "visibility", visible ? "visible" : "none");
        }
      }
    }

    if (addedLayers) bringRoadHighlightToFront(map);
  }, [areaStats, bands, boundaries, classes, fields, loadedMap, precision, precisions, props.areaStats, props.selectedPackage, props.selectedRegion, view]);

  // Penanda jenis selalu tampil di semua tema dan semua tingkat zoom; penanda yang
  // berdekatan di layar digabung menjadi klaster agar tetap terbaca saat diperkecil.
  useEffect(() => {
    const map = mapRef.current;
    const data = boundaries[PRECISION_STATS_KEY[precision]];
    if (!map || loadedMap !== map || !data) return;
    for (const marker of markersRef.current) marker.remove();
    markersRef.current = [];

    const aggregates = areaStats[PRECISION_STATS_KEY[precision]];
    const geometries = getAreaGeometries(data, precision, fields);
    const areas: Array<Omit<WorkBadgePoint, "x" | "y">> = [];
    for (const entry of geometries) {
      const aggregate = aggregates.get(entry.key);
      if (!aggregate || aggregate.count === 0) continue;
      areas.push({
        key: entry.key,
        center: entry.center,
        bounds: entry.bounds,
        workCounts: aggregate.workCounts,
        total: aggregate.count,
      });
    }

    const areaUnit = precision === "Kecamatan" ? "kec" : precision === "Kelurahan" ? "kel" : props.region.environmentLabel;
    let lastZoomBucket = -1;
    let cachedClusters: ReturnType<typeof clusterWorkBadges> = [];
    let mountedAll = false;

    const mountClusters = (clusters: ReturnType<typeof clusterWorkBadges>, viewportOnly: boolean) => {
      for (const marker of markersRef.current) marker.remove();
      markersRef.current = [];
      const viewport = viewportOnly ? map.getBounds() : null;
      for (const cluster of clusters) {
        if (viewport && !viewport.contains(cluster.center)) continue;
        const markup = workBadgeMarkup(cluster.workCounts, cluster.areaCount, areaUnit);
        if (!markup) continue;
        const element = document.createElement("div");
        element.className = "saksi-work-type-icon";
        element.innerHTML = markup;
        if (cluster.areaCount > 1) {
          element.style.pointerEvents = "auto";
          element.addEventListener("click", (event) => {
            event.stopPropagation();
            const duration = reducedMotion() ? 0 : 300;
            const dx = Math.abs(cluster.bounds[1][0] - cluster.bounds[0][0]);
            const dy = Math.abs(cluster.bounds[1][1] - cluster.bounds[0][1]);
            if (dx < 1e-5 && dy < 1e-5) {
              map.easeTo({ center: cluster.center, zoom: map.getZoom() + 2, duration });
              return;
            }
            const maxZoom = Math.max(
              map.getZoom() + 2,
              precision === "RW" ? 16.5 : precision === "Kelurahan" ? 14.5 : 13,
            );
            map.fitBounds(cluster.bounds, { padding: 56, maxZoom, duration });
          });
        } else {
          element.style.pointerEvents = "none";
        }
        const marker = new maplibregl.Marker({ element, anchor: "center" }).setLngLat(cluster.center).addTo(map);
        markersRef.current.push(marker);
      }
    };

    const render = () => {
      const zoomBucket = Math.round(map.getZoom() * 4);
      if (zoomBucket !== lastZoomBucket) {
        lastZoomBucket = zoomBucket;
        const projected: WorkBadgePoint[] = areas.map((area) => {
          const pixel = map.project(area.center);
          return { ...area, x: pixel.x, y: pixel.y };
        });
        cachedClusters = clusterWorkBadges(projected, CLUSTER_RADIUS_PX);
        if (cachedClusters.length <= 120) {
          mountedAll = true;
          mountClusters(cachedClusters, false);
          return;
        }
        mountedAll = false;
      } else if (mountedAll) {
        return;
      }
      mountClusters(cachedClusters, true);
    };

    render();
    map.on("moveend", render);

    return () => {
      map.off("moveend", render);
      for (const marker of markersRef.current) marker.remove();
      markersRef.current = [];
    };
  }, [areaStats, boundaries, fields, loadedMap, precision, props.region.environmentLabel]);

  useEffect(() => {
    const map = mapRef.current;
    const pkg = props.selectedPackage;
    if (!map || loadedMap !== map || !pkg || props.selectedRegion?.villageSlug) return;
    if (pkg.presisi_peta !== "RW" && pkg.presisi_peta !== "Kelurahan" && pkg.presisi_peta !== "Kecamatan") return;
    if (pkg.presisi_peta === "RW" && !pkg.unit_id) return;
    if (pkg.presisi_peta === "Kelurahan" && !pkg.desa_resmi) return;
    if (pkg.presisi_peta === "Kecamatan" && !pkg.kecamatan_resmi) return;
    const target: BoundaryPrecision = pkg.presisi_peta === "RW" ? "RW" : pkg.presisi_peta === "Kelurahan" ? "Kelurahan" : "Kecamatan";
    const data = boundaries[PRECISION_STATS_KEY[target]];
    if (!data) return;
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
    if (bounds) map.fitBounds(bounds, { padding: 28, maxZoom, duration: reducedMotion() ? 0 : 300 });
  }, [boundaries, fields, loadedMap, props.selectedPackage, props.selectedRegion]);

  useEffect(() => {
    const map = mapRef.current;
    const region = props.selectedRegion;
    if (!map || loadedMap !== map || !region) return;
    const duration = reducedMotion() ? 0 : 300;
    if (region.villageSlug) {
      const target: BoundaryPrecision = region.rwSlug ? "RW" : "Kelurahan";
      const data = boundaries[PRECISION_STATS_KEY[target]];
      if (!data) return;
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
    if (!region.districtSlug || !boundaries.kec) return;
    const feature = boundaries.kec.features.find(
      (candidate) => districtSlug(String(properti(candidate.properties ?? {}, fields.kecamatan) ?? "")) === region.districtSlug,
    );
    if (!feature) return;
    const bounds = boundsOfFeature(feature);
    if (bounds) map.fitBounds(bounds, { padding: 28, maxZoom: KEC_ZOOM + 2, duration });
  }, [boundaries, fields, loadedMap, props.region.environmentLabel, props.selectedRegion]);

  const activeBands = precision === "RW" ? bands.rw : precision === "Kelurahan" ? bands.kel : bands.kec;
  const activeClasses = precision === "RW" ? classes.rw : precision === "Kelurahan" ? classes.kel : classes.kec;
  const wilayahLabel = precision === "RW" ? props.region.environmentLabel : precision === "Kelurahan" ? "kelurahan" : "kecamatan";
  const legendTitle = props.viewMode === "budget"
    ? `Nilai anggaran per ${wilayahLabel}`
    : `Paket per ${wilayahLabel}`;
  const legendItems: Array<{ fill: string; label: string }> = props.viewMode === "budget"
    ? [{ fill: "#F1F5F9", label: "Tanpa paket" }, ...activeBands.map(({ fill, label }) => ({ fill, label }))]
    : activeClasses.map(({ fill, label }) => ({ fill, label }));

  // Jumlah wilayah per kelas: legenda tidak hanya menjelaskan warna, tetapi juga
  // memperlihatkan apakah kelasnya benar-benar membedakan wilayah.
  const legendCounts = useMemo(() => {
    const stats = areaStats[PRECISION_STATS_KEY[precision]];
    const bandList = precision === "RW" ? bands.rw : precision === "Kelurahan" ? bands.kel : bands.kec;
    const classList = precision === "RW" ? classes.rw : precision === "Kelurahan" ? classes.kel : classes.kec;
    const size = props.viewMode === "budget" ? bandList.length + 1 : classList.length;
    const counts = new Array<number>(size).fill(0);
    for (const area of stats.values()) {
      if (props.viewMode === "budget") {
        const found = bandList.findIndex((band) => area.budget <= band.max);
        counts[1 + (found < 0 ? bandList.length - 1 : found)] += 1;
      } else {
        const found = classList.findIndex((item) => area.count >= item.min && area.count <= item.max);
        counts[found < 0 ? 0 : found] += 1;
      }
    }
    return counts;
  }, [areaStats, bands, classes, precision, props.viewMode]);

  const wilayahBerpaket = areaStats[PRECISION_STATS_KEY[precision]].size;
  const hasSpecificRegion = Boolean(
    props.selectedPackage &&
      ((props.selectedPackage.presisi_peta === "RW" && props.selectedPackage.unit_id) ||
        (props.selectedPackage.presisi_peta === "Kelurahan" && props.selectedPackage.desa_resmi) ||
        (props.selectedPackage.presisi_peta === "Kecamatan" && props.selectedPackage.kecamatan_resmi)),
  );

  const fitCity = () => {
    const map = mapRef.current;
    if (!map || !boundaries.kel) return;
    const bounds = boundsOfCollection(boundaries.kel);
    if (bounds) map.fitBounds(bounds, { padding: 18, duration: reducedMotion() ? 0 : 300 });
  };

  // Pindah ke tingkat RW pada zoom kota membuat poligon selebar jalan. Bawa pengguna ke
  // kelurahan terpilih, atau paling sedikit ke zoom tempat RW terbaca.
  const selectPrecision = (level: BoundaryPrecision) => {
    setPrecision(level);
    if (level !== "RW") return;
    const map = mapRef.current;
    if (!map || !boundaries.kel) return;
    const duration = reducedMotion() ? 0 : 300;
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
      <div className="saksi-map-overlay absolute top-3 left-14 z-10 flex max-w-[calc(100%-4rem)] flex-col items-start gap-1.5">
        <div className="flex flex-wrap overflow-hidden border border-border bg-white/95 shadow-sm">
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
      </div>
      <Tooltip>
        <TooltipTrigger
          type="button"
          onClick={fitCity}
          aria-label="Lihat seluruh kota"
          className="saksi-map-overlay absolute top-[88px] left-3 z-10 flex size-8 items-center justify-center border border-border bg-white/95 text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <FiMaximize className="size-4" aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={10}>
          Lihat seluruh kota
        </TooltipContent>
      </Tooltip>
      {props.selectedPackage && !hasSpecificRegion ? (
        <div className="saksi-map-overlay absolute top-[128px] left-3 z-10 max-w-[min(18rem,calc(100%-1.5rem))] border border-border bg-white/95 px-3 py-2 text-xs leading-5 text-foreground shadow-sm">
          RUP {props.selectedPackage.kode_rup} tidak memiliki kecocokan wilayah kecamatan/kelurahan/{props.region.environmentLabel}; peta tidak menandai area tertentu.
        </div>
      ) : null}
      <div className="saksi-map-overlay pointer-events-none absolute right-3 bottom-14 z-10 flex max-w-[calc(100%-1.5rem)] items-end gap-2">
        <div
          role="group"
          aria-label="Tema peta"
          className="pointer-events-auto flex shrink-0 border border-border bg-white/95 shadow-sm"
        >
          {THEMES.map((tema) => {
            const Icon = tema.icon;
            const active = props.viewMode === tema.value;
            return (
              <Tooltip key={tema.value}>
                <TooltipTrigger
                  type="button"
                  closeOnClick={false}
                  onClick={() => props.onViewModeChange(tema.value)}
                  aria-pressed={active}
                  aria-label={tema.label}
                  className={`flex size-8 items-center justify-center border-r border-border transition-colors last:border-r-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${
                    active ? "bg-foreground text-white" : "text-foreground/70 hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>
                  {tema.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        {!legendOpen ? (
          <button
            type="button"
            onClick={() => setLegendPreference(true)}
            aria-expanded={legendOpen}
            aria-label="Buka legenda peta"
            title="Legenda peta"
            className="pointer-events-auto flex size-8 shrink-0 items-center justify-center border border-border bg-white/95 text-foreground/70 shadow-sm transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary lg:hidden"
          >
            <FiLayers className="size-4" aria-hidden="true" />
          </button>
        ) : null}
        <div className={`pointer-events-auto w-[min(20rem,calc(100vw-6.5rem))] border border-border bg-white/95 text-foreground shadow-sm ${legendOpen ? "" : "max-lg:hidden"}`}>
        <button
          type="button"
          onClick={() => setLegendPreference((open) => !(open ?? layarBesar))}
          aria-expanded={legendOpen}
          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left font-sans text-[11px] font-bold focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
        >
          <span>{legendTitle}</span>
          {legendOpen ? <FiChevronDown className="size-3.5 shrink-0" aria-hidden="true" /> : <FiChevronUp className="size-3.5 shrink-0" aria-hidden="true" />}
        </button>
        {legendOpen ? (
          <div className="border-t border-border px-3 py-2 text-xs">
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {legendItems.map((item, index) => (
                <li key={item.label} className="flex items-center gap-1.5">
                  <span className="size-3.5 shrink-0 border border-foreground/20" style={{ backgroundColor: item.fill }} aria-hidden="true" />
                  <span className="leading-4">
                    {item.label}
                    {legendCounts[index] ? (
                      <span className="ml-1 tabular-nums text-muted-foreground">({legendCounts[index]})</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
            {props.viewMode === "budget" ? (
              <p className="mt-1.5 border-t border-border pt-1.5 text-[10px] leading-4 text-muted-foreground">
                Skala nilai pagu, bukan status atau peringatan.
              </p>
            ) : null}
            <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
              Angka dalam kurung = jumlah {wilayahLabel} di kelas itu; {wilayahBerpaket} {wilayahLabel} berpaket pada tampilan ini.
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-border pt-1.5 text-[10px] leading-4 text-muted-foreground">
              <span>Penanda wilayah:</span>
              {ROAD_WORK_TYPES.map((category) => {
                const Icon = WORK_ICONS[category];
                return (
                  <span key={category} className="inline-flex items-center gap-1">
                    <Icon className="size-2.5 text-[#0058A3]" aria-hidden="true" />
                    {ROAD_WORK_LABELS[category].split(" & ")[0]}
                  </span>
                );
              })}
              <span className="basis-full">Angka di penanda = jumlah paket jenis itu di wilayah tersebut; penanda agregat, bukan lokasi pekerjaan.</span>
            </div>
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
                    : "Warna menunjukkan jumlah paket pada tiap wilayah."}
                  {" "}Arahkan kursor ke wilayah untuk angkanya.
                </p>
                <p>
                  Penanda kecil di tiap wilayah menyebut jumlah paket per jenis pekerjaan (permukaan, drainase, jembatan).
                  Penanda itu agregat wilayah, bukan lokasi pekerjaan.
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
      </div>
      {roadError ? (
        <div role="status" className="saksi-map-overlay absolute top-[128px] left-14 z-10 border border-border bg-white/95 px-3 py-2 text-xs text-muted-foreground">
          Layer jaringan jalan tidak dapat dimuat.
        </div>
      ) : null}
      {props.packageCount === 0 && !loadError && loadedMap ? (
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
