import "server-only";
import { timingSafeEqual } from "node:crypto";
import { revalidateCatalogCache } from "@/server/packages/catalog-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TOKEN_HEADER = "x-catalog-revalidate-token";

function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function failure(status: number, code: string, message: string): Response {
  return Response.json({ data: null, error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Dipanggil worker ingestion setelah satu run sukses: membuang Data Cache bertag
 * `catalog` dan indeks kontrak per proses supaya katalog baru langsung tampil.
 */
export async function POST(request: Request): Promise<Response> {
  const expected = process.env.CATALOG_REVALIDATE_TOKEN?.trim();
  if (!expected) {
    return failure(503, "CATALOG_REVALIDATE_DISABLED", "Penyegaran cache katalog belum dikonfigurasi.");
  }
  if (!tokenMatches(request.headers.get(TOKEN_HEADER)?.trim() ?? "", expected)) {
    return failure(401, "CATALOG_REVALIDATE_UNAUTHORIZED", "Token penyegaran cache katalog tidak valid.");
  }

  await revalidateCatalogCache();

  return Response.json(
    { data: { revalidated: true, at: new Date().toISOString() }, error: null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
