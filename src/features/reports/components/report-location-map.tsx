"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { Geometry, LineString, MultiLineString } from "geojson";
import type { RegionRoadLayer, RegionSummary } from "@/contracts/regions/region.contract";
import { BASEMAP_URL, attributionBasemap } from "@/features/map/basemap";
import {
  bringRoadHighlightToFront,
  clearRoadHighlight,
  collectRoadHighlight,
  ensureRoadHighlightLayer,
  removeRoadHighlight,
  roadHighlightKey,
  setRoadHighlight,
} from "@/features/map/basemap-roads";

maplibregl.setWorkerUrl("/vendor/maplibre-gl-worker.mjs");

export type ReportMapPoint = { latitude: number; longitude: number; accuracyM?: number | null };

export type ReportMapFocus = {
  level?: "RW" | "KELURAHAN" | "KECAMATAN";
  district?: string | null;
  village?: string | null;
  rw?: string | null;
};

type BoundaryFeature = {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: Geometry;
};
type BoundaryCollection = { type: "FeatureCollection"; features: BoundaryFeature[] };

interface ReportLocationMapProps {
  region: RegionSummary;
  point: ReportMapPoint | null;
  onPointChange?: (point: { latitude: number; longitude: number }) => void;
  readOnly?: boolean;
  /** Muat layer jalan tanpa toggle; dipakai halaman publik. */
  roadsAlwaysVisible?: boolean;
  selectedRoad?: { id: string; name: string | null; geometry: LineString | MultiLineString } | null;
  focus?: ReportMapFocus | null;
  /** Label kecil di atas peta; mis. peringatan titik warga. */
  label?: string;
  className?: string;
}

const RW_SOURCE = "laporan-rw";
const KEL_SOURCE = "laporan-kel";
const ROAD_SOURCE = "laporan-jalan";
const SELECTED_SOURCE = "laporan-ruas-terpilih";
const ACCURACY_SOURCE = "laporan-akurasi";
const ACCURACY_STEPS = 64;

function circlePolygon(longitude: number, latitude: number, radiusM: number) {
  const coordinates: number[][] = [];
  const jarakLat = radiusM / 110_540;
  const jarakLon = radiusM / (111_320 * Math.cos((latitude * Math.PI) / 180));
  for (let i = 0; i <= ACCURACY_STEPS; i += 1) {
    const sudut = (i / ACCURACY_STEPS) * Math.PI * 2;
    coordinates.push([longitude + Math.cos(sudut) * jarakLon, latitude + Math.sin(sudut) * jarakLat]);
  }
  return coordinates;
}

function properti(properties: Record<string, unknown> | undefined, key: string | null) {
  return key && properties ? properties[key] : undefined;
}

function cocokFokus(
  properties: Record<string, unknown> | undefined,
  fields: RegionSummary["boundaryFields"],
  focus: ReportMapFocus,
) {
  const district = String(properti(properties, fields.kecamatan) ?? "").toLocaleLowerCase("id-ID");
  const village = String(properti(properties, fields.kelurahan) ?? "").toLocaleLowerCase("id-ID");
  const rw = String(properti(properties, fields.lingkungan) ?? "").toLocaleLowerCase("id-ID");
  if (focus.district && district !== focus.district.toLocaleLowerCase("id-ID")) return false;
  if (focus.village && village !== focus.village.toLocaleLowerCase("id-ID")) return false;
  if (focus.level === "RW" && !rw) return false;
  if (focus.level === "KELURAHAN" && (!village || rw)) return false;
  if (focus.level === "KECAMATAN" && village) return false;
  if (focus.rw) {
    const target = focus.rw.replace(/^rw-?/i, "").replace(/^0+/, "");
    if (rw.replace(/^0+/, "") !== target) return false;
  }
  return true;
}

function boundsOfGeometry(geometry: Geometry): [[number, number], [number, number]] | null {
  if (!geometry) return null;
  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;
  const visit = ([lon, lat]: number[]) => {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
    west = Math.min(west, lon);
    south = Math.min(south, lat);
    east = Math.max(east, lon);
    north = Math.max(north, lat);
  };
  if (geometry.type === "Polygon") {
    for (const ring of geometry.coordinates) for (const point of ring) visit(point);
  } else if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates) for (const ring of polygon) for (const point of ring) visit(point);
  } else if (geometry.type === "LineString") {
    for (const point of geometry.coordinates) visit(point);
  } else if (geometry.type === "MultiLineString") {
    for (const line of geometry.coordinates) for (const point of line) visit(point);
  } else if (geometry.type === "GeometryCollection") {
    for (const child of geometry.geometries) {
      const bounds = boundsOfGeometry(child);
      if (!bounds) continue;
      visit(bounds[0]);
      visit(bounds[1]);
    }
  }
  if (![west, south, east, north].every(Number.isFinite)) return null;
  return [[west, south], [east, north]];
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>\"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  })[character] ?? character);
}

function roadPopup(properties: Record<string, unknown>, fields: RegionRoadLayer["fields"]) {
  const value = (key: string) => escapeHtml(properties[key] ?? "");
  const name = value(fields.nama) || "Ruas tanpa nama";
  const kelas = value(fields.kelas);
  const panjang = value(fields.panjang);
  const lebar = value(fields.lebar);
  const detail = [
    kelas ? `kelas ${kelas}` : null,
    panjang ? `${panjang} m` : null,
    lebar ? `lebar ${lebar} m` : null,
  ].filter(Boolean).join(" · ");
  return `<div style="line-height:1.45"><strong>${name}</strong>${detail ? `<br>${detail}` : ""}<br><span style="opacity:.7">Referensi ruas, bukan lokasi paket</span></div>`;
}

export default function ReportLocationMap({
  region,
  point,
  onPointChange,
  readOnly = false,
  roadsAlwaysVisible = false,
  selectedRoad = null,
  focus = null,
  label,
  className = "h-[360px]",
}: ReportLocationMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const onPointChangeRef = useRef(onPointChange);
  const boundariesRef = useRef<BoundaryCollection | null>(null);
  const initialFitRef = useRef(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [boundaries, setBoundaries] = useState<BoundaryCollection | null>(null);
  const [roadsVisible, setRoadsVisible] = useState(roadsAlwaysVisible);
  const [roadError, setRoadError] = useState(false);
  const roadLayer = region.roadLayer;

  useEffect(() => {
    onPointChangeRef.current = onPointChange;
  }, [onPointChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const map = new maplibregl.Map({
      container,
      style: BASEMAP_URL,
      center: region.center,
      zoom: region.zoom + 1,
      minZoom: 9,
      maxZoom: 19,
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
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container);
    const frame = window.requestAnimationFrame(() => map.resize());
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      map.off("load", handleLoad);
      popup.remove();
      popupRef.current = null;
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current = null;
      initialFitRef.current = false;
      setMapLoaded(false);
      map.remove();
    };
  }, [region.center, region.zoom]);

  useEffect(() => {
    const controller = new AbortController();
    const ambil = (url: string | null) => url
      ? fetch(url, { signal: controller.signal }).then((response) => {
        if (!response.ok) throw new Error("Batas wilayah tidak tersedia.");
        return response.json() as Promise<BoundaryCollection>;
      })
      : Promise.resolve<BoundaryCollection>({ type: "FeatureCollection", features: [] });
    Promise.all([ambil(region.boundaries.lingkungan), ambil(region.boundaries.kelurahan)])
      .then(([rw, kel]) => setBoundaries({
        type: "FeatureCollection",
        features: [...rw.features, ...kel.features].filter((feature) => Boolean(feature.geometry && feature.properties)),
      }))
      .catch(() => {
        if (!controller.signal.aborted) setBoundaries({ type: "FeatureCollection", features: [] });
      });
    return () => controller.abort();
  }, [region.boundaries.kelurahan, region.boundaries.lingkungan]);

  useEffect(() => {
    boundariesRef.current = boundaries;
  }, [boundaries]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !boundaries) return;

    const sources: Array<[string, BoundaryCollection]> = [
      [RW_SOURCE, { type: "FeatureCollection", features: boundaries.features.filter((feature) => String(properti(feature.properties, region.boundaryFields.lingkungan) ?? "").length > 0) }],
      [KEL_SOURCE, { type: "FeatureCollection", features: boundaries.features.filter((feature) => String(properti(feature.properties, region.boundaryFields.kelurahan) ?? "").length > 0 && !String(properti(feature.properties, region.boundaryFields.lingkungan) ?? "").length) }],
    ];
    for (const [id, data] of sources) {
      if (!map.getSource(id)) map.addSource(id, { type: "geojson", data });
      else (map.getSource(id) as maplibregl.GeoJSONSource).setData(data);
    }
    if (!map.getLayer(`${RW_SOURCE}-line`)) {
      map.addLayer({
        id: `${RW_SOURCE}-line`, type: "line", source: RW_SOURCE,
        paint: { "line-color": "#94A3B8", "line-width": 0.8, "line-opacity": 0.65 },
      } as unknown as maplibregl.AddLayerObject);
    }
    if (!map.getLayer(`${KEL_SOURCE}-line`)) {
      map.addLayer({
        id: `${KEL_SOURCE}-line`, type: "line", source: KEL_SOURCE,
        paint: { "line-color": "#475569", "line-width": 1.3, "line-opacity": 0.7 },
      } as unknown as maplibregl.AddLayerObject);
    }

    bringRoadHighlightToFront(map);

    if (!initialFitRef.current) {
      const kel = sources[1][1];
      const bounds = kel.features.length ? boundsOfGeometry({ type: "GeometryCollection", geometries: kel.features.map((feature) => feature.geometry) }) : null;
      if (bounds) {
        map.fitBounds(bounds, { padding: 24, animate: false });
        initialFitRef.current = true;
      }
    }
  }, [boundaries, mapLoaded, region.boundaryFields.kelurahan, region.boundaryFields.lingkungan]);

  // Jaringan jalan digambar oleh peta dasar; layer Overture tak terlihat hanya untuk hit-test
  // tooltip, sedangkan sorot memakai geometri ruas yang ditunjuk supaya tidak ada garis ganda.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !roadLayer) return;
    const lineId = `${ROAD_SOURCE}-line`;
    let hoverKey: string | null = null;
    const clearHover = () => {
      hoverKey = null;
      clearRoadHighlight(map);
    };
    const remove = () => {
      removeRoadHighlight(map);
      if (map.getLayer(lineId)) map.removeLayer(lineId);
      if (map.getSource(ROAD_SOURCE)) map.removeSource(ROAD_SOURCE);
      popupRef.current?.remove();
    };
    if (!roadsVisible) {
      remove();
      return;
    }
    ensureRoadHighlightLayer(map);
    if (!map.getSource(ROAD_SOURCE)) {
      map.addSource(ROAD_SOURCE, {
        type: "vector",
        tiles: [roadLayer.tiles],
        minzoom: roadLayer.minzoom,
        maxzoom: roadLayer.maxzoom,
      } as maplibregl.VectorSourceSpecification);
      map.addLayer({
        id: lineId, type: "line", source: ROAD_SOURCE,
        "source-layer": roadLayer.sourceLayer,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#6B7280",
          "line-opacity": 0,
          // Lebar hanya area tangkap kursor; garis tidak pernah terlihat.
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, 6, 14, 8, 18, 12],
        },
      } as unknown as maplibregl.AddLayerObject);
    }
    const hover = (event: maplibregl.MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature) return;
      map.getCanvas().style.cursor = "pointer";
      popupRef.current?.setLngLat(event.lngLat).setHTML(roadPopup((feature.properties ?? {}) as Record<string, unknown>, roadLayer.fields)).addTo(map);
      const key = roadHighlightKey(feature, roadLayer.fields.nama);
      if (key === hoverKey) return;
      hoverKey = key;
      setRoadHighlight(map, collectRoadHighlight(map, lineId, feature, roadLayer.fields.nama));
    };
    const leave = () => {
      clearHover();
      map.getCanvas().style.cursor = "";
      popupRef.current?.remove();
    };
    map.on("mousemove", lineId, hover);
    map.on("mouseleave", lineId, leave);
    map.on("click", lineId, hover);
    return () => {
      map.off("mousemove", lineId, hover);
      map.off("mouseleave", lineId, leave);
      map.off("click", lineId, hover);
      if (mapRef.current === map) remove();
    };
  }, [mapLoaded, roadLayer, roadsVisible]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    if (!map.getSource(SELECTED_SOURCE)) {
      map.addSource(SELECTED_SOURCE, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    }
    if (!map.getLayer(`${SELECTED_SOURCE}-casing`)) {
      map.addLayer({
        id: `${SELECTED_SOURCE}-casing`, type: "line", source: SELECTED_SOURCE,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#FFFFFF", "line-width": 7, "line-opacity": 0.9 },
      } as unknown as maplibregl.AddLayerObject);
    }
    if (!map.getLayer(`${SELECTED_SOURCE}-line`)) {
      map.addLayer({
        id: `${SELECTED_SOURCE}-line`, type: "line", source: SELECTED_SOURCE,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#B45309", "line-width": 4, "line-opacity": 1 },
      } as unknown as maplibregl.AddLayerObject);
    }
    const source = map.getSource(SELECTED_SOURCE) as maplibregl.GeoJSONSource;
    source.setData({
      type: "FeatureCollection",
      features: selectedRoad
        ? [{ type: "Feature", properties: { id: selectedRoad.id, nama: selectedRoad.name }, geometry: selectedRoad.geometry }]
        : [],
    });
  }, [mapLoaded, selectedRoad]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    if (!map.getSource(ACCURACY_SOURCE)) {
      map.addSource(ACCURACY_SOURCE, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    }
    if (!map.getLayer(`${ACCURACY_SOURCE}-fill`)) {
      map.addLayer({
        id: `${ACCURACY_SOURCE}-fill`, type: "fill", source: ACCURACY_SOURCE,
        paint: { "fill-color": "#0058A3", "fill-opacity": 0.12 },
      } as unknown as maplibregl.AddLayerObject);
      map.addLayer({
        id: `${ACCURACY_SOURCE}-line`, type: "line", source: ACCURACY_SOURCE,
        paint: { "line-color": "#0058A3", "line-width": 1, "line-opacity": 0.5 },
      } as unknown as maplibregl.AddLayerObject);
    }
    const source = map.getSource(ACCURACY_SOURCE) as maplibregl.GeoJSONSource;
    source.setData({
      type: "FeatureCollection",
      features: point && point.accuracyM && point.accuracyM > 0
        ? [{
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [circlePolygon(point.longitude, point.latitude, point.accuracyM)],
          },
        }]
        : [],
    });
  }, [mapLoaded, point]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    if (!point) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (!markerRef.current) {
      const marker = new maplibregl.Marker({ draggable: !readOnly, color: "#D97706" })
        .setLngLat([point.longitude, point.latitude])
        .addTo(map);
      marker.on("dragend", () => {
        const lngLat = marker.getLngLat();
        onPointChangeRef.current?.({ longitude: lngLat.lng, latitude: lngLat.lat });
      });
      markerRef.current = marker;
    } else {
      markerRef.current.setLngLat([point.longitude, point.latitude]);
      markerRef.current.setDraggable(!readOnly);
    }
  }, [mapLoaded, point, readOnly]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || readOnly) return;
    const click = (event: maplibregl.MapMouseEvent) => {
      onPointChangeRef.current?.({ longitude: event.lngLat.lng, latitude: event.lngLat.lat });
    };
    map.on("click", click);
    return () => {
      map.off("click", click);
    };
  }, [mapLoaded, readOnly]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    if (focus && boundaries) {
      const match = boundaries.features.find((feature) => cocokFokus(feature.properties, region.boundaryFields, focus));
      const bounds = match ? boundsOfGeometry(match.geometry) : null;
      if (bounds) {
        map.fitBounds(bounds, { padding: 28, maxZoom: focus.rw ? 16 : 14, duration: 600 });
        return;
      }
    }
    if (point) {
      map.easeTo({ center: [point.longitude, point.latitude], zoom: Math.max(map.getZoom(), 15), duration: 500 });
      return;
    }
    if (selectedRoad) {
      const bounds = boundsOfGeometry(selectedRoad.geometry);
      if (bounds) map.fitBounds(bounds, { padding: 40, maxZoom: 16, duration: 600 });
    }
  }, [boundaries, focus, mapLoaded, point, region.boundaryFields, selectedRoad]);

  return (
    <div className={`relative isolate w-full overflow-hidden border border-border bg-muted/30 ${className}`}>
      <div ref={containerRef} className="h-full w-full" role="region" aria-label="Peta lokasi laporan" />
      {roadLayer && !roadsAlwaysVisible ? (
        <button
          type="button"
          onClick={() => { setRoadError(false); setRoadsVisible((current) => !current); }}
          aria-pressed={roadsVisible}
          title={roadsVisible ? "Matikan sorot dan info ruas jalan" : "Aktifkan sorot dan info ruas jalan"}
          className={`absolute left-3 top-3 z-10 border border-border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] shadow-sm transition-colors ${roadsVisible ? "bg-[#334155] text-white" : "bg-white/95 text-foreground/70 hover:bg-muted"}`}
        >
          Jaringan jalan
        </button>
      ) : null}
      {roadError ? (
        <p role="status" className="absolute bottom-3 left-3 z-10 border border-border bg-white/95 px-3 py-2 text-xs text-muted-foreground">
          Layer jalan tidak dapat dimuat.
        </p>
      ) : null}
      {label ? (
        <p className="pointer-events-none absolute bottom-3 right-3 z-10 max-w-[min(20rem,calc(100%-1.5rem))] border border-border bg-white/95 px-3 py-2 text-[11px] leading-5 text-muted-foreground shadow-sm">
          {label}
        </p>
      ) : null}
      {roadsVisible && roadLayer ? (
        <p className="pointer-events-none absolute right-3 top-3 z-10 border border-border bg-white/95 px-2.5 py-1.5 text-[10px] leading-4 text-muted-foreground shadow-sm">
          Tooltip ruas: {roadLayer.attribution} · {roadLayer.license}
        </p>
      ) : null}
    </div>
  );
}
