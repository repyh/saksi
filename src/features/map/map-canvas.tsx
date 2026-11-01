"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import L from "leaflet";
import { FaRoad, FaWater } from "react-icons/fa6";
import { GiBridge } from "react-icons/gi";
import type { IconType } from "react-icons";
import {
  MapContainer,
  TileLayer,
  useMap,
} from "react-leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { RoadPackageItem } from "@/contracts/packages/road-package.contract";
import { classifyRoadWork, ROAD_WORK_LABELS, ROAD_WORK_TYPES, type SpecificRoadWorkCategory } from "@/contracts/packages/road-work";
import { addressSlug, type ReportAddress } from "./report-routes";
import { formatRupiahFull } from "./road-types";

type ClickedRegion = {
  district: string | null;
  village: string | null;
  rw: string | null;
  precision: "RW" | "Kelurahan";
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

const BUDGET_COLORS = ["#FEE2E2", "#FCA5A5", "#EF4444", "#991B1B"] as const;
const WORK_ICONS: Record<SpecificRoadWorkCategory, IconType> = {
  PERMUKAAN: FaRoad,
  DRAINASE: FaWater,
  JEMBATAN: GiBridge,
};

const RW_ZOOM = 12;
const CLASSES = [
  { min: 0, max: 0, fill: "#F1F5F9", stroke: "#94A3B8", label: "0 paket" },
  { min: 1, max: 1, fill: "#FFF4B8", stroke: "#E6C84D", label: "1 paket" },
  { min: 2, max: 3, fill: "#FFE680", stroke: "#D6B52D", label: "2–3 paket" },
  { min: 4, max: 6, fill: "#FFD633", stroke: "#C99B00", label: "4–6 paket" },
  { min: 7, max: 10, fill: "#F5B800", stroke: "#AD7C00", label: "7–10 paket" },
  { min: 11, max: Number.MAX_SAFE_INTEGER, fill: "#D98F00", stroke: "#805500", label: "11+ paket" },
] as const;

const normalize = (value: unknown) => String(value ?? "").toLocaleLowerCase("id-ID").replace(/[^a-z0-9]/g, "");

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>\"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  })[character] ?? character);
}

function classFor(count: number) {
  return CLASSES.find((item) => count >= item.min && count <= item.max) ?? CLASSES[0];
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
  for (const item of packages) {
    if (item.presisi_peta === "RW" && item.unit_id) {
      const key = normalize(item.unit_id);
      const aggregate = rw.get(key) ?? { count: 0, budget: 0, packages: [], workCounts: emptyWorkCounts() };
      aggregate.count += 1;
      aggregate.budget += item.pagu;
      aggregate.packages.push(item);
      aggregate.workCounts[classifyRoadWork(item.nama)] += 1;
      rw.set(key, aggregate);
    }
    if (item.desa_resmi) {
      const key = normalize(item.desa_resmi);
      const aggregate = kel.get(key) ?? { count: 0, budget: 0, packages: [], workCounts: emptyWorkCounts() };
      aggregate.count += 1;
      aggregate.budget += item.pagu;
      aggregate.packages.push(item);
      aggregate.workCounts[classifyRoadWork(item.nama)] += 1;
      kel.set(key, aggregate);
    }
  }
  return { rw, kel };
}

function emptyWorkCounts(): WorkCounts {
  return { PERMUKAAN: 0, DRAINASE: 0, JEMBATAN: 0 };
}

function workTypeIcon(categories: SpecificRoadWorkCategory[]) {
  const html = renderToStaticMarkup(
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
  const width = categories.length * 12 + Math.max(0, categories.length - 1) * 3 + 10;
  return L.divIcon({
    html,
    className: "saksi-work-type-icon",
    iconSize: [width, 22],
    iconAnchor: [width / 2, 11],
  });
}

function budgetClassFor(budget: number, bands: ReturnType<typeof budgetBands>) {
  return bands.find((band) => budget <= band.max) ?? bands[bands.length - 1];
}

function areaKey(feature: BoundaryFeature, precision: "RW" | "Kelurahan") {
  const properties = feature.properties ?? {};
  return precision === "RW"
    ? normalize(`${properties.wadmkd}|${properties.rw}`)
    : normalize(properties.wadmkd);
}

function styleFor(
  feature: BoundaryFeature,
  precision: "RW" | "Kelurahan",
  counts: Map<string, AreaStats>,
  highlight: "exact" | "scope" | null,
  view: AreaView,
  bands: ReturnType<typeof budgetBands>,
) {
  const key = areaKey(feature, precision);
  const aggregate = counts.get(key);
  const count = aggregate?.count ?? 0;
  const bucket = view === "work"
    ? { fill: aggregate ? "#E8EDF3" : "#F1F5F9", stroke: aggregate ? "#AAB6C4" : "#94A3B8" }
    : view === "budget" && aggregate
      ? budgetClassFor(aggregate.budget, bands)
      : classFor(count);
  const selected = highlight === "exact";
  const inSelectedScope = highlight === "scope";
  const bucketStroke = "stroke" in bucket ? bucket.stroke : bucket.fill;

  return {
    color: selected ? "#0A192F" : inSelectedScope ? "#0058A3" : bucketStroke,
    weight: selected ? 4 : inSelectedScope ? 2.5 : count === 0 ? 0.5 : 0.8,
    opacity: selected || inSelectedScope ? 1 : 0.8,
    dashArray: inSelectedScope ? "5 3" : undefined,
    fillColor: bucket.fill,
    fillOpacity: count === 0 ? 0.18 : 0.72,
  } satisfies L.PathOptions;
}

function featureHighlight(
  feature: BoundaryFeature,
  precision: "RW" | "Kelurahan",
  selected: RoadPackageItem | null,
  selectedRegion: ReportAddress | null,
): "exact" | "scope" | null {
  const properties = feature.properties ?? {};
  const villageSlug = addressSlug(String(properties.wadmkd ?? ""));
  if (selectedRegion?.rwSlug) {
    const featureRw = `rw-${addressSlug(String(properties.rw ?? "").replace(/^rw-?/i, ""))}`;
    if (precision === "RW" && villageSlug === selectedRegion.villageSlug && featureRw === selectedRegion.rwSlug) return "exact";
    if (precision === "Kelurahan" && villageSlug === selectedRegion.villageSlug) return "scope";
  }
  if (selectedRegion?.villageSlug) {
    if (precision === "Kelurahan" && villageSlug === selectedRegion.villageSlug) return "exact";
    if (precision === "RW" && !selectedRegion.rwSlug && villageSlug === selectedRegion.villageSlug) return "scope";
  }
  if (!selected) return null;
  const key = areaKey(feature, precision);

  if (selected.presisi_peta === "RW" && selected.unit_id) {
    if (precision === "RW" && key === normalize(selected.unit_id)) return "exact";
    if (precision === "Kelurahan" && selected.desa_resmi && key === normalize(selected.desa_resmi)) return "scope";
    return null;
  }
  if (selected.presisi_peta === "Kelurahan" && precision === "Kelurahan" && selected.desa_resmi) {
    return key === normalize(selected.desa_resmi) ? "exact" : null;
  }
  return null;
}

function updateAreaLayer(
  layer: L.GeoJSON | null,
  precision: "RW" | "Kelurahan",
  counts: Map<string, AreaStats>,
  selectedPackage: RoadPackageItem | null,
  selectedRegion: ReportAddress | null,
  view: AreaView,
  bands: ReturnType<typeof budgetBands>,
) {
  if (!layer) return;
  layer.setStyle((feature) =>
    feature
      ? styleFor(feature as BoundaryFeature, precision, counts, featureHighlight(feature as BoundaryFeature, precision, selectedPackage, selectedRegion), view, bands)
      : {},
  );
  if (!selectedPackage) return;

  layer.eachLayer((featureLayer) => {
    const feature = (featureLayer as L.Layer & { feature?: BoundaryFeature }).feature;
    if (feature && featureHighlight(feature, precision, selectedPackage, selectedRegion) && featureLayer instanceof L.Path) {
      featureLayer.bringToFront();
    }
  });
}

function MapSizeRefresh() {
  const map = useMap();
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => map.invalidateSize());
    return () => window.cancelAnimationFrame(frame);
  }, [map]);
  return null;
}

function MapZoomPrecision({ onChange }: { onChange: (isRw: boolean) => void }) {
  const map = useMap();
  useEffect(() => {
    const syncPrecision = () => onChange(map.getZoom() >= RW_ZOOM);
    syncPrecision();
    map.on("zoomend", syncPrecision);
    return () => { map.off("zoomend", syncPrecision); };
  }, [map, onChange]);
  return null;
}

function BoundaryLayers({ packages, selectedPackage, selectedRegion, onSelectRegion, view, bands }: MapCanvasProps & { view: AreaView; bands: { rw: ReturnType<typeof budgetBands>; kel: ReturnType<typeof budgetBands> } }) {
  const map = useMap();
  const [rwBoundary, setRwBoundary] = useState<BoundaryCollection | null>(null);
  const [kelBoundary, setKelBoundary] = useState<BoundaryCollection | null>(null);
  const [loadError, setLoadError] = useState(false);
  const rwLayer = useRef<L.GeoJSON | null>(null);
  const kelLayer = useRef<L.GeoJSON | null>(null);
  const workIconLayer = useRef<L.LayerGroup | null>(null);
  const syncLayerRef = useRef<(() => void) | null>(null);
  const onSelectRegionRef = useRef(onSelectRegion);
  const statsRef = useRef<{ rw: Map<string, AreaStats>; kel: Map<string, AreaStats> }>({
    rw: new Map(),
    kel: new Map(),
  });
  const selectedRef = useRef(selectedPackage);
  const selectedRegionRef = useRef(selectedRegion);
  const viewRef = useRef(view);
  const bandsRef = useRef(bands);

  const areaStats = useMemo(() => statsByArea(packages), [packages]);

  useEffect(() => {
    onSelectRegionRef.current = onSelectRegion;
    selectedRef.current = selectedPackage;
    selectedRegionRef.current = selectedRegion;
    statsRef.current = areaStats;
    viewRef.current = view;
    bandsRef.current = bands;
  }, [areaStats, bands, onSelectRegion, selectedPackage, selectedRegion, view]);

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
    ])
      .then(([rw, kel]) => {
        setRwBoundary(rw);
        setKelBoundary(kel);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadError(true);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!rwBoundary || !kelBoundary) return;

    const makeLayer = (data: BoundaryCollection, precision: "RW" | "Kelurahan") =>
      L.geoJSON(data, {
        style: (feature) =>
          feature
              ? styleFor(
                feature as BoundaryFeature,
                precision,
                precision === "RW" ? statsRef.current.rw : statsRef.current.kel,
                featureHighlight(feature as BoundaryFeature, precision, selectedRef.current, selectedRegionRef.current),
                viewRef.current,
                bandsRef.current[precision === "RW" ? "rw" : "kel"],
              )
            : {},
        onEachFeature: (rawFeature, layer) => {
          const feature = rawFeature as BoundaryFeature;
          layer.bindTooltip(
            () => {
              const key = areaKey(feature, precision);
              const aggregate = (precision === "RW" ? statsRef.current.rw : statsRef.current.kel).get(key);
              const properties = feature.properties ?? {};
              const title = precision === "RW"
                ? `RW ${escapeHtml(properties.rw)} · ${escapeHtml(properties.wadmkd)}`
                : escapeHtml(properties.wadmkd);
              const district = escapeHtml(properties.wadmkc);
              const detail = aggregate && viewRef.current === "budget"
                ? `<strong>${formatRupiahFull(aggregate.budget)}</strong><br>${aggregate.count.toLocaleString("id-ID")} paket`
                : aggregate && viewRef.current === "work"
                  ? `${ROAD_WORK_TYPES.filter((category) => aggregate.workCounts[category] > 0).map((category) => `${ROAD_WORK_LABELS[category]}: ${aggregate.workCounts[category]}`).join("<br>")}<br><strong>${aggregate.count.toLocaleString("id-ID")} paket · ${formatRupiahFull(aggregate.budget)}</strong>`
                  : aggregate
                    ? `${aggregate.count.toLocaleString("id-ID")} paket · ${formatRupiahFull(aggregate.budget)}`
                    : "Tidak ada paket terhubung";
              return `<div style="line-height:1.45"><strong>${title}</strong><br><span>Kec. ${district}</span><br>${detail}<br><span style="opacity:.7">Batas wilayah, bukan titik pekerjaan</span></div>`;
            },
            { sticky: true, direction: "top", opacity: 0.96 },
          );
          layer.on("click", (event: L.LeafletMouseEvent) => {
            L.DomEvent.stopPropagation(event.originalEvent);
            const key = areaKey(feature, precision);
            const aggregate = (precision === "RW" ? statsRef.current.rw : statsRef.current.kel).get(key);
            const properties = feature.properties ?? {};
            const region: ClickedRegion = {
              district: typeof properties.wadmkc === "string" ? properties.wadmkc : null,
              village: typeof properties.wadmkd === "string" ? properties.wadmkd : null,
              rw: precision === "RW" && typeof properties.rw === "string" ? properties.rw : null,
              precision,
            };
            onSelectRegionRef.current(region, aggregate?.packages[0] ?? null);
          });
        },
      });

    rwLayer.current = makeLayer(rwBoundary, "RW");
    kelLayer.current = makeLayer(kelBoundary, "Kelurahan");
    workIconLayer.current = L.layerGroup();
    updateAreaLayer(rwLayer.current, "RW", statsRef.current.rw, selectedRef.current, selectedRegionRef.current, viewRef.current, bandsRef.current.rw);
    updateAreaLayer(kelLayer.current, "Kelurahan", statsRef.current.kel, selectedRef.current, selectedRegionRef.current, viewRef.current, bandsRef.current.kel);
    const syncLayer = () => {
      const isRw = map.getZoom() >= RW_ZOOM;
      const activeLayer = isRw ? rwLayer.current : kelLayer.current;
      for (const layer of [rwLayer.current, kelLayer.current]) {
        if (layer && map.hasLayer(layer) && layer !== activeLayer) map.removeLayer(layer);
      }
      if (activeLayer && !map.hasLayer(activeLayer)) activeLayer.addTo(map);

      const icons = workIconLayer.current;
      if (!icons) return;
      icons.clearLayers();
      if (viewRef.current !== "work" || !activeLayer) {
        if (map.hasLayer(icons)) map.removeLayer(icons);
        return;
      }

      const precision = isRw ? "RW" : "Kelurahan";
      const aggregates = isRw ? statsRef.current.rw : statsRef.current.kel;
      activeLayer.eachLayer((featureLayer) => {
        const feature = (featureLayer as L.Layer & { feature?: BoundaryFeature }).feature;
        if (!feature || !("getBounds" in featureLayer)) return;
        const aggregate = aggregates.get(areaKey(feature, precision));
        if (!aggregate) return;
        const categories = ROAD_WORK_TYPES.filter((category) => aggregate.workCounts[category] > 0);
        if (!categories.length) return;
        const bounds = (featureLayer as L.Polygon).getBounds();
        if (!bounds.isValid()) return;
        const center = bounds.getCenter();
        icons.addLayer(L.marker(center, {
          icon: workTypeIcon(categories),
          keyboard: false,
          interactive: false,
        }));
      });
      if (!map.hasLayer(icons)) icons.addTo(map);
    };

    syncLayerRef.current = syncLayer;
    const handleMapClick = (event: L.LeafletMouseEvent) => {
      const target = event.originalEvent.target;
      if (target instanceof Element && target.closest(".leaflet-control, .saksi-map-overlay")) return;
      onSelectRegionRef.current(null, null);
    };

    map.on("zoomend", syncLayer);
    map.on("click", handleMapClick);
    kelLayer.current.addTo(map);
    const bounds = kelLayer.current.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [18, 18] });
    syncLayer();

    return () => {
      map.off("zoomend", syncLayer);
      map.off("click", handleMapClick);
      syncLayerRef.current = null;
      if (rwLayer.current) map.removeLayer(rwLayer.current);
      if (kelLayer.current) map.removeLayer(kelLayer.current);
      if (workIconLayer.current) map.removeLayer(workIconLayer.current);
      rwLayer.current = null;
      kelLayer.current = null;
      workIconLayer.current = null;
    };
  }, [kelBoundary, map, rwBoundary]);

  useEffect(() => {
    updateAreaLayer(rwLayer.current, "RW", areaStats.rw, selectedPackage, selectedRegion, view, bands.rw);
    updateAreaLayer(kelLayer.current, "Kelurahan", areaStats.kel, selectedPackage, selectedRegion, view, bands.kel);
    syncLayerRef.current?.();
  }, [areaStats, bands, selectedPackage, selectedRegion, view]);

  useEffect(() => {
    if (
      !selectedPackage ||
      selectedRegion?.villageSlug ||
      (selectedPackage.presisi_peta !== "RW" && selectedPackage.presisi_peta !== "Kelurahan")
    ) return;
    if (selectedPackage.presisi_peta === "RW" && !selectedPackage.unit_id) return;
    if (selectedPackage.presisi_peta === "Kelurahan" && !selectedPackage.desa_resmi) return;
    const layer = selectedPackage.presisi_peta === "RW" ? rwLayer.current : kelLayer.current;
    if (!layer) return;
    const precision = selectedPackage.presisi_peta === "RW" ? "RW" : "Kelurahan";
    const key = precision === "RW" ? normalize(selectedPackage.unit_id ?? "") : normalize(selectedPackage.desa_resmi);
    if (!key) return;
    const matchingLayer = layer.getLayers().find((featureLayer) => {
      const feature = (featureLayer as L.Layer & { feature?: BoundaryFeature }).feature;
      return feature ? areaKey(feature, precision) === key : false;
    });
    if (matchingLayer && "getBounds" in matchingLayer) {
      const bounds = (matchingLayer as L.Polygon).getBounds();
      const maxZoom = selectedPackage.presisi_peta === "RW" ? 15 : RW_ZOOM - 0.5;
      if (bounds.isValid()) map.flyToBounds(bounds, { padding: [28, 28], maxZoom, duration: 0.7 });
    }
  }, [kelBoundary, map, rwBoundary, selectedPackage, selectedRegion]);

  useEffect(() => {
    if (!selectedRegion?.villageSlug) return;
    const precision = selectedRegion.rwSlug ? "RW" : "Kelurahan";
    const layer = precision === "RW" ? rwLayer.current : kelLayer.current;
    if (!layer) return;
    const featureLayer = layer.getLayers().find((candidate) => {
      const feature = (candidate as L.Layer & { feature?: BoundaryFeature }).feature;
      if (!feature) return false;
      const properties = feature.properties ?? {};
      if (addressSlug(String(properties.wadmkd ?? "")) !== selectedRegion.villageSlug) return false;
      if (precision === "RW") {
        return `rw-${addressSlug(String(properties.rw ?? "").replace(/^rw-?/i, ""))}` === selectedRegion.rwSlug;
      }
      return true;
    });
    if (featureLayer && "getBounds" in featureLayer) {
      const bounds = (featureLayer as L.Polygon).getBounds();
      if (bounds.isValid()) map.flyToBounds(bounds, { padding: [28, 28], maxZoom: precision === "RW" ? 15 : RW_ZOOM - 0.5, duration: 0.7 });
    }
  }, [kelBoundary, map, rwBoundary, selectedRegion]);

  return loadError ? (
    <div role="status" className="absolute top-3 left-1/2 z-[1000] -translate-x-1/2 border border-border bg-white/95 px-3 py-2 text-xs text-muted-foreground">
      Batas wilayah tidak dapat dimuat.
    </div>
  ) : null;
}

export default function MapCanvas(props: MapCanvasProps) {
  const [rwZoomed, setRwZoomed] = useState(false);
  const view: AreaView = props.viewMode;
  const areaStats = useMemo(() => statsByArea(props.packages), [props.packages]);
  const bands = useMemo(() => ({ rw: budgetBands(areaStats.rw), kel: budgetBands(areaStats.kel) }), [areaStats]);
  const activeBands = rwZoomed ? bands.rw : bands.kel;
  const handlePrecisionChange = useMemo(() => (isRw: boolean) => setRwZoomed(isRw), []);
  const legendItems = props.viewMode === "work"
    ? ROAD_WORK_TYPES.map((category) => ({ fill: "transparent", label: ROAD_WORK_LABELS[category], icon: WORK_ICONS[category] }))
    : props.viewMode === "budget"
      ? [{ fill: "#F1F5F9", label: "Tanpa paket" }, ...activeBands]
      : CLASSES;
  const hasSpecificRegion = Boolean(
    props.selectedPackage &&
      ((props.selectedPackage.presisi_peta === "RW" && props.selectedPackage.unit_id) ||
        (props.selectedPackage.presisi_peta === "Kelurahan" && props.selectedPackage.desa_resmi)),
  );

  return (
    <MapContainer
      center={[-6.178, 106.63]}
      zoom={11}
      minZoom={10}
      maxZoom={18}
      scrollWheelZoom
      preferCanvas
      className={`relative z-0 isolate w-full bg-muted/30 ${props.mapHeightClassName ?? "h-[580px]"}`}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapSizeRefresh />
      <MapZoomPrecision onChange={handlePrecisionChange} />
      <BoundaryLayers {...props} view={view} bands={bands} />
      <div className="saksi-map-overlay pointer-events-none absolute top-3 right-3 z-[1000] max-w-[min(23rem,calc(100%-1.5rem))] border border-border bg-white/95 px-3 py-2 text-xs leading-5 text-foreground shadow-sm">
        <p>
          {props.selectedPackage && !hasSpecificRegion
            ? `RUP ${props.selectedPackage.kode_rup} tidak memiliki kecocokan wilayah RW/kelurahan; peta tidak menandai area tertentu.`
            : props.viewMode === "budget"
              ? "Warna menunjukkan total pagu paket per wilayah; arahkan kursor untuk melihat jumlah paket."
              : props.viewMode === "work"
                ? "Ikon menandai jenis pekerjaan yang ada; arahkan kursor untuk melihat rinciannya."
                : "Peta menyoroti wilayah yang disebut dalam paket; lokasi pekerjaan di dalam batas tidak diketahui."}
        </p>
      </div>
      <div className="saksi-map-overlay pointer-events-none absolute right-3 bottom-3 z-[1000] border border-border bg-white/95 p-3 text-xs text-foreground shadow-sm">
        <p className="mb-2 font-bold">{props.viewMode === "budget" ? "Nilai anggaran per wilayah" : props.viewMode === "work" ? "Jenis pekerjaan" : "Paket per wilayah"}</p>
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
          <p>Perbesar untuk melihat RW. Paket yang hanya diketahui hingga kelurahan tidak dibagi ke RW.</p>
        </div>
      </div>
    </MapContainer>
  );
}
