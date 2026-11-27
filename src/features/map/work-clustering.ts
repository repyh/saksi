import { ROAD_WORK_TYPES } from "@/contracts/packages/road-work";
import type { WorkCounts } from "./work-encoding";

export type WorkBadgeBounds = [[number, number], [number, number]];

export interface WorkBadgePoint {
  key: string;
  center: [number, number];
  bounds?: WorkBadgeBounds | null;
  workCounts: WorkCounts;
  total: number;
  x: number;
  y: number;
}

export interface WorkBadgeCluster {
  center: [number, number];
  bounds: WorkBadgeBounds;
  workCounts: WorkCounts;
  total: number;
  areaCount: number;
  x: number;
  y: number;
}

export const CLUSTER_RADIUS_PX = 54;

function pointBounds(point: WorkBadgePoint): WorkBadgeBounds {
  return point.bounds
    ? [
        [point.bounds[0][0], point.bounds[0][1]],
        [point.bounds[1][0], point.bounds[1][1]],
      ]
    : [
        [point.center[0], point.center[1]],
        [point.center[0], point.center[1]],
      ];
}

function mergeClusters(target: WorkBadgeCluster, incoming: WorkBadgeCluster) {
  const combinedTotal = target.total + incoming.total;
  const weightA = target.total || target.areaCount;
  const weightB = incoming.total || incoming.areaCount;
  const weightSum = weightA + weightB || 1;

  for (const category of ROAD_WORK_TYPES) {
    target.workCounts[category] += incoming.workCounts[category];
  }
  target.total = combinedTotal;
  target.areaCount += incoming.areaCount;
  target.center = [
    (target.center[0] * weightA + incoming.center[0] * weightB) / weightSum,
    (target.center[1] * weightA + incoming.center[1] * weightB) / weightSum,
  ];
  target.x = (target.x * weightA + incoming.x * weightB) / weightSum;
  target.y = (target.y * weightA + incoming.y * weightB) / weightSum;
  target.bounds = [
    [
      Math.min(target.bounds[0][0], incoming.bounds[0][0]),
      Math.min(target.bounds[0][1], incoming.bounds[0][1]),
    ],
    [
      Math.max(target.bounds[1][0], incoming.bounds[1][0]),
      Math.max(target.bounds[1][1], incoming.bounds[1][1]),
    ],
  ];
}

function toCluster(point: WorkBadgePoint): WorkBadgeCluster {
  return {
    center: [point.center[0], point.center[1]],
    bounds: pointBounds(point),
    workCounts: {
      PERMUKAAN: point.workCounts.PERMUKAAN,
      DRAINASE: point.workCounts.DRAINASE,
      JEMBATAN: point.workCounts.JEMBATAN,
    },
    total: point.total,
    areaCount: 1,
    x: point.x,
    y: point.y,
  };
}

/**
 * Mengelompokkan penanda jenis pekerjaan yang berdekatan di ruang piksel layar agar
 * saat peta diperkecil penanda tidak saling bertumpuk.
 */
export function clusterWorkBadges(
  points: ReadonlyArray<WorkBadgePoint>,
  radiusPx = CLUSTER_RADIUS_PX,
): WorkBadgeCluster[] {
  if (!points.length) return [];

  const sorted = [...points].sort(
    (a, b) => b.total - a.total || a.key.localeCompare(b.key),
  );

  const clusters: WorkBadgeCluster[] = [];
  for (const point of sorted) {
    let nearest: WorkBadgeCluster | null = null;
    let nearestDistance = radiusPx;

    for (const candidate of clusters) {
      const distance = Math.hypot(point.x - candidate.x, point.y - candidate.y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = candidate;
      }
    }

    const singleton = toCluster(point);
    if (nearest) mergeClusters(nearest, singleton);
    else clusters.push(singleton);
  }

  // Pastikan pusat klaster hasil penggabungan juga tidak lebih dekat dari radiusPx.
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < clusters.length && !merged; i += 1) {
      for (let j = i + 1; j < clusters.length; j += 1) {
        const a = clusters[i];
        const b = clusters[j];
        if (Math.hypot(a.x - b.x, a.y - b.y) < radiusPx) {
          if (a.total >= b.total) {
            mergeClusters(a, b);
            clusters.splice(j, 1);
          } else {
            mergeClusters(b, a);
            clusters.splice(i, 1);
          }
          merged = true;
          break;
        }
      }
    }
  }

  return clusters;
}
