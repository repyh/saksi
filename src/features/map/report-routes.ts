import type { RoadPackageItem, RoadWorkCategory } from "@/contracts/packages/road-package.contract";

export type ReportViewMode = "packages" | "budget" | "work";

export interface ReportAddress {
  districtSlug?: string;
  villageSlug?: string;
  rwSlug?: string;
}

export interface ReportRouteSelection extends ReportAddress {
  rupCode?: string;
}

export interface ReportFilters {
  year: "SEMUA" | "2025" | "2026";
  work: RoadWorkCategory;
  view: ReportViewMode;
  query: string;
}

export function addressSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("id-ID")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 96)
    .replace(/-+$/g, "");
}

export function districtSlug(value: string) {
  return addressSlug(value.replace(/^(kecamatan|kec\.?)[\s-]*/iu, ""));
}

export function routeForAddress(address: ReportAddress) {
  const segments = ["kota-tangerang"];
  if (address.districtSlug) segments.push(address.districtSlug);
  else if (address.villageSlug || address.rwSlug) segments.push("lokasi-umum");
  if (address.villageSlug) segments.push(address.villageSlug);
  if (address.rwSlug) segments.push(`rw-${addressSlug(address.rwSlug.replace(/^rw-?/i, ""))}`);
  return segments.length === 1 && !address.districtSlug ? "/project" : `/project/${segments.join("/")}`;
}

export function routeForPackage(item: RoadPackageItem) {
  const segments = ["kota-tangerang"];
  const district = item.kecamatan_resmi ? districtSlug(item.kecamatan_resmi) : "";
  const village = item.desa_resmi ? addressSlug(item.desa_resmi) : "";

  if (item.presisi_peta === "RW" && district && village) {
    segments.push(district, village);
    if (item.rw) segments.push(`rw-${addressSlug(item.rw.replace(/^rw-?/i, ""))}`);
  } else if (item.presisi_peta === "Kelurahan" && village) {
    if (district) segments.push(district);
    else segments.push("lokasi-umum");
    segments.push(village);
  } else if (item.presisi_peta === "Kecamatan" && district) {
    segments.push(district, "lokasi-umum");
  } else {
    segments.push("lokasi-umum");
  }

  segments.push(`rup-${item.kode_rup}`, addressSlug(item.nama) || "paket");
  return `/project/${segments.join("/")}`;
}

export function addressForPackage(item: RoadPackageItem): ReportAddress | null {
  const address: ReportAddress = {};
  if (item.kecamatan_resmi) address.districtSlug = districtSlug(item.kecamatan_resmi);
  if ((item.presisi_peta === "Kelurahan" || item.presisi_peta === "RW") && item.desa_resmi) {
    address.villageSlug = addressSlug(item.desa_resmi);
  }
  if (item.presisi_peta === "RW" && item.rw) {
    address.rwSlug = `rw-${addressSlug(item.rw.replace(/^rw-?/i, ""))}`;
  }
  return Object.keys(address).length ? address : null;
}

export function parseReportSegments(segments: string[] = []): ReportRouteSelection {
  const normalized = segments.map((segment) => segment.toLocaleLowerCase("id-ID"));
  if (normalized[0] === "kota-tangerang") normalized.shift();
  const rupIndex = normalized.findIndex((segment) => /^rup-\d+$/.test(segment));
  const addressSegments = rupIndex < 0 ? normalized : normalized.slice(0, rupIndex);
  const result: ReportRouteSelection = {};
  const first = addressSegments[0];
  let index = 0;

  if (first && first !== "lokasi-umum") {
    result.districtSlug = first;
    index = 1;
  } else if (first === "lokasi-umum") {
    index = 1;
  }

  const second = addressSegments[index];
  if (second && second !== "lokasi-umum" && !second.startsWith("rw-")) {
    result.villageSlug = second;
    index += 1;
  }
  const rw = addressSegments[index];
  if (rw?.startsWith("rw-")) result.rwSlug = rw;

  if (rupIndex >= 0) result.rupCode = normalized[rupIndex].slice("rup-".length);
  return result;
}

export function routeForSelection(selection: ReportRouteSelection) {
  if (selection.rupCode) return `/project/${[
    "kota-tangerang",
    ...(selection.districtSlug ? [selection.districtSlug] : ["lokasi-umum"]),
    ...(selection.villageSlug ? [selection.villageSlug] : []),
    ...(selection.rwSlug ? [selection.rwSlug] : []),
    `rup-${selection.rupCode}`,
  ].join("/")}`;
  return routeForAddress(selection);
}

export function routeForFilters(pathname: string, filters: ReportFilters) {
  const url = new URL(pathname, "https://saksi.invalid");
  url.search = "";
  if (filters.year !== "SEMUA") url.searchParams.set("tahun", filters.year);
  if (filters.work !== "SEMUA") url.searchParams.set("jenis", filters.work.toLocaleLowerCase("id-ID"));
  if (filters.view !== "packages") url.searchParams.set("tampilan", filters.view);
  if (filters.query.trim()) url.searchParams.set("q", filters.query.trim());
  return `${url.pathname}${url.search}`;
}
