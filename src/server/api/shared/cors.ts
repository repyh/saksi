import "server-only";

function configuredOrigins() {
  const configured = (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const fallback = process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : [];
  return new Set([...configured, ...fallback].map((value) => {
    try { return new URL(value).origin; } catch { return ""; }
  }).filter(Boolean));
}

export function isAllowedCorsOrigin(origin: string | null) {
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    return parsed.origin === origin && configuredOrigins().has(parsed.origin);
  } catch {
    return false;
  }
}

export function withCors(response: Response, origin: string | null) {
  if (!origin || !isAllowedCorsOrigin(origin)) return response;
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Expose-Headers", "Retry-After, X-Request-Id");
  headers.append("Vary", "Origin");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function reportPreflight(origin: string | null) {
  if (!origin || !isAllowedCorsOrigin(origin)) return new Response(null, { status: 403 });
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Idempotency-Key",
      "Access-Control-Max-Age": "600",
      "Vary": "Origin",
    },
  });
}
