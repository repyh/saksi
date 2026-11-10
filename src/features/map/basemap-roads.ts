import type { AddLayerObject, GeoJSONSource, Map as MapLibreMap, MapGeoJSONFeature } from "maplibre-gl";
import type { Feature, FeatureCollection, Geometry } from "geojson";

/**
 * Jaringan jalan di peta datang dari style peta dasar, jadi SAKSI tidak menggambar ulang garisnya.
 * Sorot ruas memakai satu layer GeoJSON di atas peta: geometrinya diambil dari ruas Overture yang
 * sedang ditunjuk (segaris dengan jalan peta dasar), sehingga tidak ada garis ganda dan tidak ada
 * ketergantungan pada `feature-state` peta dasar yang bisa melebar per tile.
 */
export const ROAD_HIGHLIGHT_SOURCE = "saksi-jalan-sorot";
export const ROAD_HIGHLIGHT_LAYER = "saksi-jalan-sorot-line";

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

/** Layer sorot sekali pasang; aman dipanggil berulang. */
export function ensureRoadHighlightLayer(map: MapLibreMap) {
  if (!map.getSource(ROAD_HIGHLIGHT_SOURCE)) {
    map.addSource(ROAD_HIGHLIGHT_SOURCE, { type: "geojson", data: EMPTY });
  }
  if (!map.getLayer(ROAD_HIGHLIGHT_LAYER)) {
    map.addLayer({
      id: ROAD_HIGHLIGHT_LAYER,
      type: "line",
      source: ROAD_HIGHLIGHT_SOURCE,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#B45309",
        "line-opacity": 0.95,
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 2.5, 13, 3.5, 16, 5, 18, 7],
      },
    } as unknown as AddLayerObject);
  }
  bringRoadHighlightToFront(map);
}

/** Sorot harus di atas poligon wilayah; layer batas dibuat ulang saat presisi berganti. */
export function bringRoadHighlightToFront(map: MapLibreMap) {
  if (map.getLayer(ROAD_HIGHLIGHT_LAYER)) map.moveLayer(ROAD_HIGHLIGHT_LAYER);
}

export function removeRoadHighlight(map: MapLibreMap) {
  if (map.getLayer(ROAD_HIGHLIGHT_LAYER)) map.removeLayer(ROAD_HIGHLIGHT_LAYER);
  if (map.getSource(ROAD_HIGHLIGHT_SOURCE)) map.removeSource(ROAD_HIGHLIGHT_SOURCE);
}

function roadName(feature: MapGeoJSONFeature, nameField: string) {
  const value = feature.properties?.[nameField];
  return typeof value === "string" && value.trim() ? value : null;
}

/** Kunci ringan untuk tahu kapan geometri sorot perlu dihitung ulang. */
export function roadHighlightKey(feature: MapGeoJSONFeature, nameField: string) {
  const name = roadName(feature, nameField);
  if (name) return `nama:${name}`;
  const id = feature.properties?.id;
  return `ruas:${typeof id === "string" || typeof id === "number" ? id : `${feature.id ?? ""}`}`;
}

function toFeature(feature: MapGeoJSONFeature): Feature<Geometry> {
  return { type: "Feature", properties: {}, geometry: feature.geometry };
}

/**
 * Geometri sorot untuk ruas yang ditunjuk. Ruas bernama disorot utuh (semua potongan tile yang
 * sedang dirender), ruas tanpa nama hanya potongan yang ditunjuk.
 */
export function collectRoadHighlight(
  map: MapLibreMap,
  layerId: string,
  feature: MapGeoJSONFeature,
  nameField: string,
): FeatureCollection {
  const name = roadName(feature, nameField);
  if (!name || !map.getLayer(layerId)) return { type: "FeatureCollection", features: [toFeature(feature)] };
  const matches = map
    .queryRenderedFeatures({ layers: [layerId] })
    .filter((candidate) => roadName(candidate, nameField) === name);
  return { type: "FeatureCollection", features: (matches.length ? matches : [feature]).map(toFeature) };
}

export function setRoadHighlight(map: MapLibreMap, data: FeatureCollection) {
  const source = map.getSource(ROAD_HIGHLIGHT_SOURCE) as GeoJSONSource | undefined;
  source?.setData(data);
}

export function clearRoadHighlight(map: MapLibreMap) {
  setRoadHighlight(map, EMPTY);
}
