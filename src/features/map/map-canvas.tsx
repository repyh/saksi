"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as maplibregl from "maplibre-gl";
import { FaRoad, FaWater } from "react-icons/fa6";
import { GiBridge } from "react-icons/gi";
import type { IconType } from "react-icons";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { RoadPackageItem } from "@/contracts/packages/road-package.contract";
import { classifyRoadWork, ROAD_WORK_LABELS, ROAD_WORK_TYPES, type SpecificRoadWorkCategory } from "@/contracts/packages/road-work";
import { addressSlug, type ReportAddress } from "./report-routes";
import { formatRupiahFull } from "./road-types";

type BoundaryPrecision = "RW" | "Kelurahan" | "Kecamatan";

type ClickedRegion = {
  district: string | null;
  village: string | null;
  rw: string | null;
  precision: BoundaryPrecision;
};

interface MapCanvasProps {
  packages: RoadPackageItem[];
  selectedPackage: RoadPackageItem | null;
  selectedRegion: ReportAddress | null;
  onSelectRegion: (region: ClickedRegion | null, pkg: RoadPackageItem | null) => void;
  viewMode: "packages" | "budget" | "work";
  mapHeightClassName?: string;
}

type BoundaryProperties = Record<string, unknown> & {
  wadmkd?: string;
  wadmkc?: string;
  rw?: string;
};
type BoundaryFeature = Feature<Geometry, BoundaryProperties>;
type BoundaryCollection = FeatureCollection<Geometry, BoundaryProperties>;
type WorkCounts = Record<SpecificRoadWorkCategory, number>;
type AreaStats = { count: number; budget: number; packages: RoadPackageItem[]; workCounts: WorkCounts };
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

const BUDGET_COLORS = ["#FEE2E2", "#FCA5A5", "#EF4444", "#991B1B"] as const;
const WORK_ICONS: Record<SpecificRoadWorkCategory, IconType> = {
  PERMUKAAN: FaRoad,
  DRAINASE: FaWater,
  JEMBATAN: GiBridge,
};

const RW_ZOOM = 12;
const KEC_ZOOM = 11;
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

const normalize = (value: unknown) => String(value ?? "").toLocaleLowerCase("id-ID").replace(/[^a-z0-9]/g, "");

/** Satu variabel untuk peta dasar; nilai kini URL style JSON (vektor), default OpenFreeMap Positron. */
const BASEMAP_URL =
  process.env.NEXT_PUBLIC_BASEMAP_URL?.trim() || "https://tiles.openfreemap.org/styles/positron";

// Turbopack tidak menurunkan URL worker dari import.meta.url paket; worker disalin
// ke public/vendor oleh scripts/copy-maplibre-worker.mjs (predev/prebuild).
maplibregl.setWorkerUrl("/vendor/maplibre-gl-worker.mjs");

const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const OPENFREEMAP_ATTRIBUTION = '&copy; <a href="https://openfreemap.org/">OpenFreeMap</a>';

function attributionBasemap(url: string) {
  if (url.includes("openfreemap.org")) {
    return `${OSM_ATTRIBUTION} ${OPENFREEMAP_ATTRIBUTION}`;
  }
  if (url.includes("cartocdn.com")) {
    return `${OSM_ATTRIBUTION} &copy; <a href="https://carto.com/attributions">CARTO</a>`;
  }
  if (url.includes("arcgisonline.com")) {
    return '&copy; <a href="https://www.esri.com/">Esri</a>, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  }
  return OSM_ATTRIBUTION;
}

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

function statsByArea(packages: RoadPackageItem[]) {
  const rw = new Map<string, AreaStats>();
  const kel = new Map<string, AreaStats>();
  const kec = new Map<string, AreaStats>();
  const tambah = (map: Map<string, AreaStats>, key: string, item: RoadPackageItem) => {
    const aggregate = map.get(key) ?? { count: 0, budget: 0, packages: [], workCounts: emptyWorkCounts() };
    aggregate.count += 1;
    aggregate.budget += item.pagu;
    aggregate.packages.push(item);
    aggregate.workCounts[classifyRoadWork(item.nama)] += 1;
    map.set(key, aggregate);
  };
  for (const item of packages) {
    if (item.presisi_peta === "RW" && item.unit_id) tambah(rw, normalize(item.unit_id), item);
    if (item.desa_resmi) tambah(kel, normalize(item.desa_resmi), item);
    if (item.kecamatan_resmi) tambah(kec, normalize(item.kecamatan_resmi), item);
  }
  return { rw, kel, kec };
}

function emptyWorkCounts(): WorkCounts {
  return { PERMUKAAN: 0, DRAINASE: 0, JEMBATAN: 0 };
}

function workTypeIconMarkup(categories: SpecificRoadWorkCategory[]) {
  return renderToStaticMarkup(
    <span
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "3px",
        padding: "4px",
        border: "1px solid #6B21A8",
        borderRadius: "999px",
        background: "rgba(255,255,255,.96)",
        boxShadow: "0 1px 4px rgba(10,25,47,.3)",
        pointerEvents: "none",
      }}
    >
      {categories.map((category) => {
        const Icon = WORK_ICONS[category];
        return (
          <span key={category} title={ROAD_WORK_LABELS[category]} style={{ display: "flex", color: "#5B2180" }}>
            <Icon size={12} aria-hidden="true" />
          </span>
        );
      })}
    </span>,
  );
}

function budgetClassFor(budget: number, bands: ReturnType<typeof budgetBands>) {
  return bands.find((band) => budget <= band.max) ?? bands[bands.length - 1];
}

function areaKeyFromProperties(properties: BoundaryProperties, precision: BoundaryPrecision) {
  if (precision === "Kecamatan") return normalize(properties.wadmkc);
  return precision === "RW"
    ? normalize(`${properties.wadmkd}|${properties.rw}`)
    : normalize(properties.wadmkd);
}

function areaKey(feature: BoundaryFeature, precision: BoundaryPrecision) {
  return areaKeyFromProperties(feature.properties ?? {}, precision);
}

function styleFor(
  feature: BoundaryFeature,
  precision: BoundaryPrecision,
  counts: Map<string, AreaStats>,
  highlight: Highlight,
  view: AreaView,
  bands: ReturnType<typeof budgetBands>,
  classes: ClassBand[],
) {
  const key = areaKey(feature, precision);
  const aggregate = counts.get(key);
  const count = aggregate?.count ?? 0;
  const bucket = view === "work"
    ? { fill: aggregate ? "#E8EDF3" : "#F1F5F9", stroke: aggregate ? "#AAB6C4" : "#94A3B8" }
    : view === "budget" && aggregate
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
  };
}

function featureHighlight(
  feature: BoundaryFeature,
  precision: BoundaryPrecision,
  selected: RoadPackageItem | null,
  selectedRegion: ReportAddress | null,
): Highlight {
  const properties = feature.properties ?? {};
  const villageSlug = addressSlug(String(properties.wadmkd ?? ""));
  const districtKey = normalize(properties.wadmkc);
  if (selectedRegion?.rwSlug) {
    const featureRw = `rw-${addressSlug(String(properties.rw ?? "").replace(/^rw-?/i, ""))}`;
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
  const key = areaKey(feature, precision);

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
      const highlight = featureHighlight(feature, precision, selectedPackage, selectedRegion);
      const style = styleFor(feature, precision, counts, highlight, view, bands, classes);
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

function sourceId(precision: BoundaryPrecision) {
  return `saksi-${precision.toLocaleLowerCase("id-ID")}`;
}

function fillLayerId(precision: BoundaryPrecision) {
  return `${sourceId(precision)}-fill`;
}

function tooltipHtml(properties: BoundaryProperties, precision: BoundaryPrecision, aggregate: AreaStats | undefined, view: AreaView) {
  const title = precision === "RW"
    ? `RW ${escapeHtml(properties.rw)} · ${escapeHtml(properties.wadmkd)}`
    : precision === "Kecamatan"
      ? `Kec. ${escapeHtml(properties.wadmkc)}`
      : escapeHtml(properties.wadmkd);
  const district = escapeHtml(properties.wadmkc);
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

function clickedRegion(properties: BoundaryProperties, precision: BoundaryPrecision): ClickedRegion {
  return {
    district: typeof properties.wadmkc === "string" ? properties.wadmkc : null,
    village: precision === "Kecamatan" ? null : typeof properties.wadmkd === "string" ? properties.wadmkd : null,
    rw: precision === "RW" && typeof properties.rw === "string" ? properties.rw : null,
    precision,
  };
}

const LEVEL_LABELS: Record<BoundaryPrecision, string> = { Kecamatan: "Kecamatan", Kelurahan: "Kelurahan", RW: "RW" };

export default function MapCanvas(props: MapCanvasProps) {
  const [precision, setPrecision] = useState<BoundaryPrecision>("Kelurahan");
  const [boundaries, setBoundaries] = useState<{ rw: BoundaryCollection; kel: BoundaryCollection; kec: BoundaryCollection } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const initialFitRef = useRef(false);
  const view: AreaView = props.viewMode;
  const areaStats = useMemo(() => statsByArea(props.packages), [props.packages]);
  const bands = useMemo(
    () => ({ rw: budgetBands(areaStats.rw), kel: budgetBands(areaStats.kel), kec: budgetBands(areaStats.kec) }),
    [areaStats],
  );
  const kecClasses = useMemo(() => quantileCountBands(areaStats.kec), [areaStats.kec]);
  const classes = useMemo(
    () => ({ rw: [...CLASSES] as ClassBand[], kel: [...CLASSES] as ClassBand[], kec: kecClasses }),
    [kecClasses],
  );

  // Handler dan efek MapLibre mendaftar sekali; nilai terbaru dibaca lewat ref ini.
  const latestRef = useRef({ areaStats, bands, classes, selectedPackage: props.selectedPackage, selectedRegion: props.selectedRegion, view, precision, onSelectRegion: props.onSelectRegion });

  useEffect(() => {
    latestRef.current = { areaStats, bands, classes, selectedPackage: props.selectedPackage, selectedRegion: props.selectedRegion, view, precision, onSelectRegion: props.onSelectRegion };
  }, [areaStats, bands, classes, props.onSelectRegion, props.selectedPackage, props.selectedRegion, precision, view]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/data/rw.geojson", { signal: controller.signal }).then((response) => {
        if (!response.ok) throw new Error("Batas RW tidak tersedia.");
        return response.json() as Promise<BoundaryCollection>;
      }),
      fetch("/data/kel.geojson", { signal: controller.signal }).then((response) => {
        if (!response.ok) throw new Error("Batas kelurahan tidak tersedia.");
        return response.json() as Promise<BoundaryCollection>;
      }),
      fetch("/data/kec.geojson", { signal: controller.signal }).then((response) => {
        if (!response.ok) throw new Error("Batas kecamatan tidak tersedia.");
        return response.json() as Promise<BoundaryCollection>;
      }),
    ])
      .then(([rw, kel, kec]) => setBoundaries({ rw, kel, kec }))
      .catch(() => {
        if (!controller.signal.aborted) setLoadError(true);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = new maplibregl.Map({
      container,
      style: BASEMAP_URL,
      center: [106.63, -6.178],
      zoom: 11,
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
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !boundaries) return;

    const state = latestRef.current;
    const handlers: Array<() => void> = [];

    for (const level of PRECISIONS) {
      const id = sourceId(level);
      if (!map.getSource(id)) {
        map.addSource(id, {
          type: "geojson",
          data: styledCollection(
            boundaries[PRECISION_STATS_KEY[level]],
            level,
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

      const hover = (event: maplibregl.MapLayerMouseEvent) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const current = latestRef.current;
        const properties = (feature.properties ?? {}) as BoundaryProperties;
        const aggregate = current.areaStats[PRECISION_STATS_KEY[level]].get(areaKeyFromProperties(properties, level));
        map.getCanvas().style.cursor = "pointer";
        popupRef.current
          ?.setLngLat(event.lngLat)
          .setHTML(tooltipHtml(properties, level, aggregate, current.view))
          .addTo(map);
      };
      const leave = () => {
        map.getCanvas().style.cursor = "";
        popupRef.current?.remove();
      };
      const select = (event: maplibregl.MapLayerMouseEvent) => {
        const feature = event.features?.[0];
        if (!feature) return;
        event.preventDefault();
        const current = latestRef.current;
        const properties = (feature.properties ?? {}) as BoundaryProperties;
        const aggregate = current.areaStats[PRECISION_STATS_KEY[level]].get(areaKeyFromProperties(properties, level));
        current.onSelectRegion(clickedRegion(properties, level), aggregate?.packages[0] ?? null);
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
      latestRef.current.onSelectRegion(null, null);
    };
    map.on("click", handleMapClick);

    if (!initialFitRef.current) {
      const bounds = boundsOfCollection(boundaries.kel);
      if (bounds) {
        map.fitBounds(bounds, { padding: 18, animate: false });
        initialFitRef.current = true;
      }
    }

    return () => {
      map.off("click", handleMapClick);
      for (const remove of handlers) remove();
      if (mapRef.current !== map) return;
      for (const level of PRECISIONS) {
        const id = sourceId(level);
        for (const suffix of ["fill", "line", "exact", "scope"]) {
          if (map.getLayer(`${id}-${suffix}`)) map.removeLayer(`${id}-${suffix}`);
        }
        if (map.getSource(id)) map.removeSource(id);
      }
    };
  }, [boundaries, mapLoaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !boundaries) return;
    const state = latestRef.current;
    for (const level of PRECISIONS) {
      const id = sourceId(level);
      const source = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
      if (source) {
        source.setData(styledCollection(
          level === "RW" ? boundaries.rw : level === "Kelurahan" ? boundaries.kel : boundaries.kec,
          level,
          state.areaStats[PRECISION_STATS_KEY[level]],
          state.selectedPackage,
          state.selectedRegion,
          state.view,
          state.bands[PRECISION_STATS_KEY[level]],
          state.classes[PRECISION_STATS_KEY[level]],
        ));
      }
      const visible = level === precision;
      for (const suffix of ["fill", "line", "exact", "scope"]) {
        if (map.getLayer(`${id}-${suffix}`)) {
          map.setLayoutProperty(`${id}-${suffix}`, "visibility", visible ? "visible" : "none");
        }
      }
    }
  }, [areaStats, bands, boundaries, classes, mapLoaded, precision, props.selectedPackage, props.selectedRegion, view]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !boundaries) return;
    for (const marker of markersRef.current) marker.remove();
    markersRef.current = [];
    if (view !== "work") return;

    const data = precision === "RW" ? boundaries.rw : precision === "Kelurahan" ? boundaries.kel : boundaries.kec;
    const aggregates = areaStats[PRECISION_STATS_KEY[precision]];
    for (const feature of data.features) {
      const aggregate = aggregates.get(areaKey(feature, precision));
      if (!aggregate) continue;
      const categories = ROAD_WORK_TYPES.filter((category) => aggregate.workCounts[category] > 0);
      if (!categories.length) continue;
      const center = centerOfFeature(feature);
      if (!center) continue;
      const element = document.createElement("div");
      element.className = "saksi-work-type-icon";
      element.style.pointerEvents = "none";
      element.innerHTML = workTypeIconMarkup(categories);
      const marker = new maplibregl.Marker({ element, anchor: "center" }).setLngLat(center).addTo(map);
      markersRef.current.push(marker);
    }

    return () => {
      for (const marker of markersRef.current) marker.remove();
      markersRef.current = [];
    };
  }, [areaStats, boundaries, mapLoaded, precision, view]);

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
    const feature = data.features.find((candidate) => areaKey(candidate, target) === key);
    if (!feature) return;
    const bounds = boundsOfFeature(feature);
    const maxZoom = target === "RW" ? 15 : target === "Kelurahan" ? RW_ZOOM - 0.5 : KEC_ZOOM;
    if (bounds) map.fitBounds(bounds, { padding: 28, maxZoom, duration: 700 });
  }, [boundaries, mapLoaded, props.selectedPackage, props.selectedRegion]);

  useEffect(() => {
    const map = mapRef.current;
    const region = props.selectedRegion;
    if (!map || !mapLoaded || !boundaries || !region?.villageSlug) return;
    const target: BoundaryPrecision = region.rwSlug ? "RW" : "Kelurahan";
    const data = target === "RW" ? boundaries.rw : boundaries.kel;
    const feature = data.features.find((candidate) => {
      const properties = candidate.properties ?? {};
      if (addressSlug(String(properties.wadmkd ?? "")) !== region.villageSlug) return false;
      if (target === "RW") {
        return `rw-${addressSlug(String(properties.rw ?? "").replace(/^rw-?/i, ""))}` === region.rwSlug;
      }
      return true;
    });
    if (!feature) return;
    const bounds = boundsOfFeature(feature);
    if (bounds) map.fitBounds(bounds, { padding: 28, maxZoom: target === "RW" ? 15 : RW_ZOOM - 0.5, duration: 700 });
  }, [boundaries, mapLoaded, props.selectedRegion]);

  const activeBands = precision === "RW" ? bands.rw : precision === "Kelurahan" ? bands.kel : bands.kec;
  const activeClasses = precision === "Kecamatan" ? kecClasses : [...CLASSES];
  const wilayahLabel = precision === "RW" ? "RW" : precision === "Kelurahan" ? "kelurahan" : "kecamatan";
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

  return (
    <div className={`relative z-0 isolate w-full overflow-hidden bg-muted/30 ${props.mapHeightClassName ?? "h-[580px]"}`}>
      <div ref={containerRef} className="h-full w-full" role="region" aria-label="Peta koroplet batas wilayah" />
      <div className="saksi-map-overlay absolute top-3 left-14 z-10 flex overflow-hidden border border-border bg-white/95 shadow-sm">
        {(Object.keys(LEVEL_LABELS) as BoundaryPrecision[]).map((tingkat) => (
          <button
            key={tingkat}
            type="button"
            onClick={() => setPrecision(tingkat)}
            aria-pressed={precision === tingkat}
            title={`Tampilkan poligon ${LEVEL_LABELS[tingkat].toLowerCase()}`}
            className={`px-2.5 py-1.5 font-sans text-[10px] font-bold uppercase tracking-[0.08em] transition-colors ${
              precision === tingkat ? "bg-primary text-white" : "text-foreground/70 hover:bg-muted"
            }`}
          >
            {LEVEL_LABELS[tingkat]}
          </button>
        ))}
      </div>
      <div className="saksi-map-overlay pointer-events-none absolute top-3 right-3 z-10 max-w-[min(23rem,calc(100%-1.5rem))] border border-border bg-white/95 px-3 py-2 text-xs leading-5 text-foreground shadow-sm">
        <p>
          {props.selectedPackage && !hasSpecificRegion
            ? `RUP ${props.selectedPackage.kode_rup} tidak memiliki kecocokan wilayah kecamatan/kelurahan/RW; peta tidak menandai area tertentu.`
            : props.viewMode === "budget"
              ? "Warna menunjukkan total pagu paket per wilayah; arahkan kursor untuk melihat jumlah paket."
              : props.viewMode === "work"
                ? "Ikon menandai jenis pekerjaan yang ada; arahkan kursor untuk melihat rinciannya."
                : "Peta menyoroti wilayah yang disebut dalam paket; lokasi pekerjaan di dalam batas tidak diketahui."}
        </p>
      </div>
      <div className="saksi-map-overlay pointer-events-none absolute right-3 bottom-3 z-10 border border-border bg-white/95 p-3 text-xs text-foreground shadow-sm">
        <p className="mb-2 font-bold">{props.viewMode === "budget" ? `Nilai anggaran per ${wilayahLabel}` : props.viewMode === "work" ? "Jenis pekerjaan" : `Paket per ${wilayahLabel}`}</p>
        <ul className="space-y-1.5">
          {legendItems.map((item) => {
            const Icon = "icon" in item ? item.icon : undefined;
            return (
            <li key={item.label} className="flex items-center gap-2">
              <span className={`flex size-4 shrink-0 items-center justify-center border border-foreground/20 ${Icon ? "rounded-full bg-white" : ""}`} style={Icon ? undefined : { backgroundColor: item.fill }} aria-hidden="true">
                {Icon ? <Icon className="size-2.5 text-[#5B2180]" /> : null}
              </span>
              <span>{item.label}</span>
            </li>
            );
          })}
          {hasSpecificRegion ? (
            <li className="flex items-center gap-2 border-t border-border pt-1.5">
              <span className="size-3 border-[3px] border-[#0A192F] bg-transparent" aria-hidden="true" />
              <span>Wilayah paket dipilih · garis tebal</span>
            </li>
          ) : null}
        </ul>
        <div className="mt-2 max-w-52 space-y-1 border-t border-border pt-2 text-[10px] leading-4 text-muted-foreground">
          <p>{props.viewMode === "budget" ? "Warna menunjukkan total pagu; arahkan kursor untuk jumlah paket." : props.viewMode === "work" ? "Ikon menandai jenis paket yang tercatat; warna wilayah tetap netral." : "Warna menunjukkan jumlah paket pada tiap wilayah."}</p>
          <p>Tingkat poligon diatur lewat pemilih Kecamatan / Kelurahan / RW di atas peta. Paket yang hanya diketahui hingga kelurahan tidak dibagi ke RW.</p>
          <p>Angka kecamatan menjumlahkan semua paket di dalamnya, termasuk yang presisi RW dan kelurahan.</p>
        </div>
      </div>
      {loadError ? (
        <div role="status" className="absolute top-3 left-1/2 z-10 -translate-x-1/2 border border-border bg-white/95 px-3 py-2 text-xs text-muted-foreground">
          Batas wilayah tidak dapat dimuat.
        </div>
      ) : null}
    </div>
  );
}
