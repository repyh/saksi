import "server-only";
import { ApiError } from "@/server/api/shared/api-error";
import { prisma } from "@/lib/prisma";
import { removePrivateReportImage } from "@/server/storage/supabase-storage.client";

const KEY_TTL_MS = 24 * 60 * 60 * 1000;
const LEASE_MS = 5 * 60 * 1000;

export type IdempotencyClaim =
  | { kind: "claimed"; id: string; attemptId: string }
  | { kind: "completed"; responseCode: string }
  | { kind: "processing" };

function isUniqueConflict(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function claimReportIdempotency(input: { keyHash: string; requestHash: string; attemptId: string }): Promise<IdempotencyClaim> {
  const now = new Date();
  try {
    const row = await prisma.reportIdempotencyKey.create({
      data: {
        ...input,
        status: "PROCESSING",
        leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
        expiresAt: new Date(now.getTime() + KEY_TTL_MS),
      },
    });
    return { kind: "claimed", id: row.id, attemptId: input.attemptId };
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
  }

  const existing = await prisma.reportIdempotencyKey.findUnique({ where: { keyHash: input.keyHash } });
  if (!existing) throw new ApiError(503, "IDEMPOTENCY_RETRY", "Permintaan belum dapat dipastikan. Kirim ulang dengan kunci yang sama.");
  if (existing.expiresAt > now && existing.requestHash !== input.requestHash) {
    throw new ApiError(409, "IDEMPOTENCY_KEY_REUSED", "Kunci pengiriman sudah dipakai untuk isi laporan yang berbeda.");
  }
  if (existing.expiresAt > now && existing.status === "COMPLETED" && existing.responseCode) {
    return { kind: "completed", responseCode: existing.responseCode };
  }
  if (existing.expiresAt > now && existing.status === "PROCESSING" && existing.leaseExpiresAt > now) {
    return { kind: "processing" };
  }

  const updated = await prisma.reportIdempotencyKey.updateMany({
    where: {
      id: existing.id,
      attemptId: existing.attemptId,
      OR: [
        { expiresAt: { lte: now } },
        { status: "PROCESSING", leaseExpiresAt: { lte: now } },
      ],
    },
    data: {
      requestHash: input.requestHash,
      attemptId: input.attemptId,
      status: "PROCESSING",
      reportId: null,
      responseCode: null,
      completedAt: null,
      leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
      expiresAt: new Date(now.getTime() + KEY_TTL_MS),
    },
  });
  if (updated.count === 1) {
    if (existing.stagedObjectPath) {
      try {
        await removePrivateReportImage(existing.stagedObjectPath);
        await prisma.reportIdempotencyKey.updateMany({
          where: { id: existing.id, attemptId: input.attemptId, status: "PROCESSING" },
          data: { stagedObjectPath: null },
        });
      } catch {
        await prisma.reportIdempotencyKey.updateMany({
          where: { id: existing.id, attemptId: input.attemptId, status: "PROCESSING" },
          data: { leaseExpiresAt: new Date(0) },
        }).catch(() => undefined);
        throw new ApiError(503, "REPORT_IMAGE_CLEANUP_FAILED", "Pengiriman belum dapat dilanjutkan. Coba kirim ulang dengan kunci yang sama.");
      }
    }
    return { kind: "claimed", id: existing.id, attemptId: input.attemptId };
  }

  const latest = await prisma.reportIdempotencyKey.findUnique({ where: { keyHash: input.keyHash } });
  if (latest?.status === "COMPLETED" && latest.responseCode) return { kind: "completed", responseCode: latest.responseCode };
  return { kind: "processing" };
}

export async function setReportIdempotencyStagedPath(id: string, attemptId: string, stagedObjectPath: string) {
  const result = await prisma.reportIdempotencyKey.updateMany({
    where: { id, attemptId, status: "PROCESSING" },
    data: { stagedObjectPath },
  });
  if (result.count !== 1) throw new ApiError(409, "IDEMPOTENCY_LEASE_LOST", "Pengiriman ini sudah kedaluwarsa. Coba kirim ulang.");
}

export const reportIdempotencyKeyTtlMs = KEY_TTL_MS;
