import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

type AreaFeatureCollection = {
  features?: Array<{
    geometry?: unknown;
    properties?: { wadmkc?: unknown; wadmkd?: unknown; rw?: unknown };
  }>;
};

export type ReportAreaSnapshot = {
  stableKey: string;
  districtName: string;
  villageName: string;
  rwCode: string;
  datasetVersion: string;
};

function titleCase(value: string) {
  return value.toLocaleLowerCase("id-ID").replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase("id-ID"));
}

let areaMapPromise: Promise<Map<string, ReportAreaSnapshot>> | undefined;

async function loadAreaMap() {
  const filePath = path.join(process.cwd(), "public", "data", "rw.geojson");
  const content = JSON.parse(await readFile(filePath, "utf8")) as AreaFeatureCollection;
  const areas = new Map<string, ReportAreaSnapshot>();
  for (const feature of content.features ?? []) {
    const district = typeof feature.properties?.wadmkc === "string" ? feature.properties.wadmkc.trim() : "";
    const village = typeof feature.properties?.wadmkd === "string" ? feature.properties.wadmkd.trim() : "";
    const rw = typeof feature.properties?.rw === "string" ? feature.properties.rw.trim() : "";
    if (!district || !village || !rw || !feature.geometry) continue;
    const stableKey = `${district.toLocaleLowerCase("id-ID")}|${village.toLocaleLowerCase("id-ID")}|${rw}`;
    areas.set(stableKey, {
      stableKey,
      districtName: titleCase(district),
      villageName: titleCase(village),
      rwCode: rw.replace(/^0+/, "") || "0",
      datasetVersion: "rw-2021",
    });
  }
  return areas;
}

export async function findReportAreaSnapshot(stableKey: string) {
  areaMapPromise ??= loadAreaMap();
  return (await areaMapPromise).get(stableKey) ?? null;
}
