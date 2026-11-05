import "server-only";
import { prisma } from "@/lib/prisma";
import { requireRequestPermission } from "@/server/authorization/authority";
import { recordAuthorizationEvent } from "@/server/authorization/audit";
import { createRegistrationInviteSchema, updateAccountProfileSchema } from "./access-schema";
import { ApiError } from "../shared/api-error";
import { ApiController } from "../shared/api-controller";
import { createRegistrationToken, hashRegistrationToken } from "@/server/registration/token";

const INVITE_TTL_MS_PER_DAY = 24 * 60 * 60 * 1000;

export class AccessApi extends ApiController {
  private noStore(response: Response): Response {
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "private, no-store, max-age=0");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }

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

  async listAccounts(request: Request): Promise<Response> {
    const response = await this.respond(async () => {
      if (!process.env.DATABASE_URL) {
        throw new ApiError(503, "ACCOUNT_DIRECTORY_UNAVAILABLE", "Daftar akun belum tersedia.");
      }
      await requireRequestPermission(request.headers, "access.users.read");

      const now = new Date();
      const accounts = await prisma.user.findMany({
        orderBy: [{ createdAt: "desc" }, { email: "asc" }],
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          createdAt: true,
          bundleGrants: {
            where: {
              revokedAt: null,
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
              bundle: { isActive: true },
            },
            orderBy: { grantedAt: "desc" },
            select: { bundle: { select: { code: true, name: true } } },
          },
        },
      });

      return {
        accounts: accounts.map((account) => ({
          id: account.id,
          name: account.name,
          email: account.email,
          emailVerified: account.emailVerified,
          createdAt: account.createdAt.toISOString(),
          accessBundles: [...new Map(account.bundleGrants.map(({ bundle }) => [bundle.code, bundle])).values()],
        })),
      };
    }, { code: "ACCOUNT_DIRECTORY_UNAVAILABLE", message: "Daftar akun belum dapat dimuat." });
    return this.noStore(response);
  }

  async updateAccountProfile(request: Request, accountId: string): Promise<Response> {
    const response = await this.respond(async () => {
      if (!process.env.DATABASE_URL) {
        throw new ApiError(503, "ACCOUNT_DIRECTORY_UNAVAILABLE", "Layanan akun belum tersedia.");
      }
      this.assertInviteRequestOrigin(request);
      const actor = await requireRequestPermission(request.headers, "access.users.edit");

      let payload: unknown;
      try {
        payload = await request.json();
      } catch {
        throw new ApiError(400, "INVALID_REQUEST", "Permintaan perubahan akun tidak valid.");
      }
      const parsed = updateAccountProfileSchema.safeParse(payload);
      if (!parsed.success) {
        throw new ApiError(400, "INVALID_REQUEST", "Nama akun harus diisi dan maksimal 100 karakter.");
      }

      const targetId = accountId.trim();
      if (!targetId) throw new ApiError(400, "INVALID_ACCOUNT", "ID akun tidak valid.");

      const updated = await prisma.$transaction(async (tx) => {
        const target = await tx.user.findUnique({ where: { id: targetId }, select: { id: true } });
        if (!target) throw new ApiError(404, "ACCOUNT_NOT_FOUND", "Akun tidak ditemukan.");

        const account = await tx.user.update({
          where: { id: targetId },
          data: { name: parsed.data.name },
          select: { id: true, name: true },
        });
        await recordAuthorizationEvent(tx, {
          actorUserId: actor.id,
          subjectUserId: targetId,
          action: "account.profile_updated",
          resourceType: "user",
          resourceId: targetId,
          reason: "Display name updated from account management.",
          metadata: { fields: ["name"] },
        });
        return account;
      });

      return updated;
    }, { code: "ACCOUNT_UPDATE_FAILED", message: "Nama akun belum dapat diperbarui." });
    return this.noStore(response);
  }

  async createInvite(request: Request): Promise<Response> {
    const response = await this.respond(async () => {
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
    return this.noStore(response);
  }

  async revokeInvite(request: Request, inviteId: string): Promise<Response> {
    const response = await this.respond(async () => {
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
    return this.noStore(response);
  }
}

export const accessApi = new AccessApi();
