import "server-only";
import { prisma } from "@/lib/prisma";
import { requireRequestPermission } from "@/server/authorization/authority";
import { recordAuthorizationEvent } from "@/server/authorization/audit";
import { createRegistrationInviteSchema } from "./access-schema";
import { ApiError } from "../shared/api-error";
import { ApiController } from "../shared/api-controller";
import { createRegistrationToken, hashRegistrationToken } from "@/server/registration/token";

const INVITE_TTL_MS_PER_DAY = 24 * 60 * 60 * 1000;

export class AccessApi extends ApiController {
  private assertInviteRequestOrigin(request: Request): void {
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Permintaan harus menggunakan JSON.");
    }

    const origin = request.headers.get("origin");
    if (!origin) return;
    const baseUrl = process.env.BETTER_AUTH_URL;
    try {
      if (!baseUrl || new URL(origin).origin !== new URL(baseUrl).origin) {
        throw new ApiError(403, "ORIGIN_NOT_ALLOWED", "Sumber permintaan tidak diizinkan.");
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(503, "AUTH_UNAVAILABLE", "Konfigurasi autentikasi belum tersedia.");
    }
  }

  createInvite(request: Request): Promise<Response> {
    return this.respond(async () => {
      if (!process.env.DATABASE_URL) {
        throw new ApiError(503, "AUTH_UNAVAILABLE", "Layanan autentikasi belum tersedia.");
      }
      this.assertInviteRequestOrigin(request);
      const actor = await requireRequestPermission(request.headers, "access.users.invite");
      let payload: unknown;
      try {
        payload = await request.json();
      } catch {
        throw new ApiError(400, "INVALID_REQUEST", "Permintaan undangan tidak valid.");
      }

      const parsed = createRegistrationInviteSchema.safeParse(payload);
      if (!parsed.success) {
        throw new ApiError(400, "INVALID_REQUEST", "Isi email, masa berlaku, dan alasan undangan dengan benar.");
      }

      const email = parsed.data.email.trim().toLowerCase();
      const token = createRegistrationToken();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + parsed.data.expiresInDays * INVITE_TTL_MS_PER_DAY);
      const configuredBaseUrl = process.env.BETTER_AUTH_URL;
      let inviteBaseUrl: URL;
      try {
        if (!configuredBaseUrl) throw new Error("Missing base URL");
        inviteBaseUrl = new URL(configuredBaseUrl);
        if (inviteBaseUrl.username || inviteBaseUrl.password) throw new Error("Invalid base URL");
      } catch {
        throw new ApiError(503, "AUTH_UNAVAILABLE", "Konfigurasi autentikasi belum tersedia.");
      }
      if (inviteBaseUrl.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(inviteBaseUrl.hostname)) {
        throw new ApiError(503, "AUTH_UNAVAILABLE", "Tautan undangan membutuhkan alamat HTTPS.");
      }

      const invite = await prisma.$transaction(async (tx) => {
        const activeInviteCount = await tx.registrationInvite.count({
          where: { email, redeemedAt: null, revokedAt: null, expiresAt: { gt: now } },
        });
        if (activeInviteCount >= 3) {
          throw new ApiError(409, "INVITE_LIMIT_REACHED", "Email ini sudah memiliki beberapa undangan aktif.");
        }
        const created = await tx.registrationInvite.create({
          data: {
            tokenHash: hashRegistrationToken(token),
            email,
            createdByUserId: actor.id,
            expiresAt,
          },
          select: { id: true, expiresAt: true },
        });
        await recordAuthorizationEvent(tx, {
          actorUserId: actor.id,
          action: "registration_invite.created",
          resourceType: "registration_invite",
          resourceId: created.id,
          reason: parsed.data.reason,
          metadata: { expiresAt: created.expiresAt.toISOString() },
        });
        return created;
      }, { isolationLevel: "Serializable" });

      const inviteUrl = new URL("/register", inviteBaseUrl.origin);
      inviteUrl.hash = new URLSearchParams({ invite: token }).toString();

      return {
        id: invite.id,
        email,
        expiresAt: invite.expiresAt.toISOString(),
        inviteUrl: inviteUrl.toString(),
      };
    }, {
      code: "INVITE_UNAVAILABLE",
      message: "Undangan belum dapat dibuat.",
    });
  }

  revokeInvite(request: Request, inviteId: string): Promise<Response> {
    return this.respond(async () => {
      if (!process.env.DATABASE_URL) {
        throw new ApiError(503, "AUTH_UNAVAILABLE", "Layanan autentikasi belum tersedia.");
      }
      this.assertInviteRequestOrigin(request);
      const actor = await requireRequestPermission(request.headers, "access.users.invite");
      const id = inviteId.trim();
      if (!id) throw new ApiError(400, "INVALID_REQUEST", "ID undangan tidak valid.");

      const invite = await prisma.$transaction(async (tx) => {
        const current = await tx.registrationInvite.findUnique({
          where: { id },
          select: { id: true, redeemedAt: true, revokedAt: true },
        });
        if (!current || current.redeemedAt || current.revokedAt) {
          throw new ApiError(404, "INVITE_UNAVAILABLE", "Undangan tidak tersedia.");
        }
        const revokedAt = new Date();
        const result = await tx.registrationInvite.updateMany({
          where: { id, redeemedAt: null, revokedAt: null },
          data: { revokedAt, revokedByUserId: actor.id },
        });
        if (result.count !== 1) throw new ApiError(404, "INVITE_UNAVAILABLE", "Undangan tidak tersedia.");
        await recordAuthorizationEvent(tx, {
          actorUserId: actor.id,
          action: "registration_invite.revoked",
          resourceType: "registration_invite",
          resourceId: id,
        });
        return { id, revokedAt: revokedAt.toISOString() };
      });

      return invite;
    }, {
      code: "INVITE_UNAVAILABLE",
      message: "Undangan belum dapat dicabut.",
    });
  }
}

export const accessApi = new AccessApi();
