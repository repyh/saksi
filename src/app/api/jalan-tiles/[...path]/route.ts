import { readFile } from "node:fs/promises";
import path from "node:path";
import { getRegionOrNull } from "@/server/regions/region-registry";

export const runtime = "nodejs";

interface TileRouteProps {
  params: Promise<{ path: string[] }>;
}

export async function GET(_request: Request, { params }: TileRouteProps) {
  const { path: segmen } = await params;
  if (segmen.length !== 4) return new Response("Not found", { status: 404 });
  const [regionId, z, x, y] = segmen;
  if (!/^[a-z0-9][a-z0-9-]*$/.test(regionId) || !/^\d{1,2}$/.test(z) || !/^\d{1,7}$/.test(x) || !/^\d{1,7}$/.test(y)) {
    return new Response("Not found", { status: 404 });
  }
  const region = getRegionOrNull(regionId);
  if (!region?.jalan?.tiles) return new Response("Not found", { status: 404 });

  const berkas = path.resolve(process.cwd(), region.jalan.tiles, z, x, `${y}.pbf.gz`);
  try {
    const bytes = await readFile(berkas);
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/x-protobuf",
        "Content-Encoding": "gzip",
        "Cache-Control": "public, max-age=86400, immutable",
        "X-Content-Type-Options": "nosniff",
        Vary: "Accept-Encoding",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
