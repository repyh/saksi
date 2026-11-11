import type { MetadataRoute } from "next";
import { listRoadPackages, listVendors } from "@/server/packages/service";

function getSiteOrigin(): string {
  const configuredUrl = process.env.SITE_URL ?? process.env.BETTER_AUTH_URL;
  const siteUrl = new URL(configuredUrl ?? "http://localhost:3000");

  if (siteUrl.protocol !== "https:" && siteUrl.protocol !== "http:") {
    throw new Error("SITE_URL must use HTTP or HTTPS.");
  }

  return siteUrl.origin;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = getSiteOrigin();
  const publicPaths = [
    "/",
    "/peta-pekerjaan",
    "/laporan",
    "/laporan/publik",
    "/penyedia",
    "/paket",
    "/project",
    "/metode",
    "/kebijakan-privasi",
    "/syarat-ketentuan",
  ];
  const [vendors, projects] = await Promise.all([listVendors(), listRoadPackages()]);

  return [
    ...publicPaths.map((path) => ({ url: new URL(path, origin).toString() })),
    ...vendors.map((vendor) => ({
      url: new URL(`/penyedia/${encodeURIComponent(vendor.slug)}`, origin).toString(),
    })),
    ...projects.map((project) => ({
      url: new URL(`/paket/${encodeURIComponent(project.kode_rup)}`, origin).toString(),
    })),
    ...projects.map((project) => ({
      url: new URL(`/project/${encodeURIComponent(project.kode_rup)}`, origin).toString(),
    })),
  ];
}
