import type { RoadWorkCategory } from "./road-package.contract";

export type SpecificRoadWorkCategory = Exclude<RoadWorkCategory, "SEMUA">;

export const ROAD_WORK_TYPES: readonly SpecificRoadWorkCategory[] = [
  "PERMUKAAN",
  "DRAINASE",
  "JEMBATAN",
];

export const ROAD_WORK_LABELS: Record<SpecificRoadWorkCategory, string> = {
  PERMUKAAN: "Permukaan jalan",
  DRAINASE: "Drainase / penahan",
  JEMBATAN: "Jembatan",
};

export function classifyRoadWork(name: string): SpecificRoadWorkCategory {
  const lower = name.toLocaleLowerCase("id-ID");
  if (["drainase", "saluran", "u-ditch", "uditch", "spal", "turap", "talud", "tpt", "bronjong", "gorong", "culvert"].some((term) => lower.includes(term))) {
    return "DRAINASE";
  }
  if (lower.includes("jembatan")) return "JEMBATAN";
  return "PERMUKAAN";
}
