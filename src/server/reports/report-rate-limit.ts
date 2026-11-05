import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/server/api/shared/api-error";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_REPORTS_PER_WINDOW = 3;

export async function enforceReportSubmissionRateLimit(request: Request) {
  const secret = process.env.REPORT_RATE_LIMIT_SECRET || process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new ApiError(503, "REPORT_RATE_LIMIT_UNAVAILABLE", "Pengiriman laporan belum dapat diproses.");

  const forwarded = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  const address = request.headers.get("x-real-ip")?.trim() || forwarded || "unknown-client";
  const fingerprint = createHmac("sha256", secret).update(address).digest("hex");
  const key = `report-submit:${fingerprint}`;
  const now = BigInt(Date.now());

  await prisma.$executeRaw`
    INSERT INTO "rateLimit" ("id", "key", "count", "lastRequest")
    VALUES (${randomUUID()}, ${key}, 1, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN ${now} - "rateLimit"."lastRequest" >= ${BigInt(WINDOW_MS)} THEN 1
        ELSE "rateLimit"."count" + 1
      END,
      "lastRequest" = ${now}
  `;
  const counter = await prisma.rateLimit.findUnique({ where: { key }, select: { count: true, lastRequest: true } });
  if (!counter) throw new ApiError(503, "REPORT_RATE_LIMIT_UNAVAILABLE", "Pengiriman laporan belum dapat diproses.");
  if (counter.count > MAX_REPORTS_PER_WINDOW) {
    const remainingMs = Math.max(1, WINDOW_MS - (Date.now() - Number(counter.lastRequest)));
    const retryMinutes = Math.ceil(remainingMs / 60_000);
    throw new ApiError(429, "REPORT_RATE_LIMITED", `Batas laporan tercapai. Coba lagi sekitar ${retryMinutes} menit.`);
  }
}
