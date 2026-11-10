import type { Geometry } from "geojson";

export type LngLat = { longitude: number; latitude: number };

export function pointInRing(longitude: number, latitude: number, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const crosses = (yi > latitude) !== (yj > latitude)
      && longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

/** Titik di dalam Polygon/MultiPolygon, memperhitungkan lubang. */
export function pointInGeometry(point: LngLat, geometry: Geometry): boolean {
  if (geometry.type === "Polygon") {
    const [outer, ...holes] = geometry.coordinates;
    return pointInRing(point.longitude, point.latitude, outer)
      && !holes.some((hole) => pointInRing(point.longitude, point.latitude, hole));
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some(([outer, ...holes]) => (
      pointInRing(point.longitude, point.latitude, outer)
      && !holes.some((hole) => pointInRing(point.longitude, point.latitude, hole))
    ));
  }
  return false;
}

function meterLokal(origin: LngLat, lon: number, lat: number) {
  const rad = Math.PI / 180;
  const x = (lon - origin.longitude) * Math.cos(origin.latitude * rad) * 111_320;
  const y = (lat - origin.latitude) * 110_540;
  return [x, y] as const;
}

function distancePointSegmentMeters(point: LngLat, a: number[], b: number[]) {
  const [px, py] = [0, 0];
  const [ax, ay] = meterLokal(point, a[0], a[1]);
  const [bx, by] = meterLokal(point, b[0], b[1]);
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function roadDistanceMeters(point: LngLat, geometry: Geometry): number {
  const lines = geometry.type === "LineString"
    ? [geometry.coordinates]
    : geometry.type === "MultiLineString"
      ? geometry.coordinates
      : [];
  let minimum = Number.POSITIVE_INFINITY;
  for (const line of lines) {
    if (line.length === 1) {
      const [x, y] = meterLokal(point, line[0][0], line[0][1]);
      minimum = Math.min(minimum, Math.hypot(x, y));
    }
    for (let i = 1; i < line.length; i += 1) {
      minimum = Math.min(minimum, distancePointSegmentMeters(point, line[i - 1], line[i]));
    }
  }
  return minimum;
}

export function isPointNearRoad(point: LngLat, geometry: Geometry | null, thresholdM = 60) {
  if (!geometry) return true;
  return roadDistanceMeters(point, geometry) <= thresholdM;
}
