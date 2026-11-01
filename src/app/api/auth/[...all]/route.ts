import type { NextRequest } from "next/server";

/**
 * Autentikasi hanya aktif kalau DATABASE_URL diset. Tanpa database, modul better-auth
 * tidak diimpor sama sekali sehingga `next build` (collect page data) tetap bersih dan
 * endpoint menjawab 503, bukan error 500 yang membingungkan.
 */
async function penangan(): Promise<{
  GET: (request: NextRequest) => Promise<Response>;
  POST: (request: NextRequest) => Promise<Response>;
} | null> {
  if (!process.env.DATABASE_URL) return null;
  const [{ toNextJsHandler }, { auth }] = await Promise.all([
    import("better-auth/next-js"),
    import("@/lib/auth"),
  ]);
  return toNextJsHandler(auth);
}

function tidakTersedia(): Response {
  return Response.json(
    {
      data: null,
      error: {
        code: "AUTH_UNAVAILABLE",
        message: "Autentikasi belum aktif: DATABASE_URL belum diset.",
      },
    },
    { status: 503 },
  );
}

export async function GET(request: NextRequest) {
  const handler = await penangan();
  return handler ? handler.GET(request) : tidakTersedia();
}

export async function POST(request: NextRequest) {
  const handler = await penangan();
  return handler ? handler.POST(request) : tidakTersedia();
}
