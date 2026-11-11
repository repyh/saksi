import type { MetadataRoute } from "next";
import { listRoadPackages, listVendors } from "@/server/packages/service";
import { getSiteOrigin } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = getSiteOrigin();
  const publicPaths = [
    "/",
    "/peta-pekerjaan",
    "/laporan",
    "/laporan/publik",
    "/penyedia",
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
      url: new URL(`/project/${encodeURIComponent(project.kode_rup)}`, origin).toString(),
    })),
  ];
}
