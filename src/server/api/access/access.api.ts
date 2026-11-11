import "server-only";
import { prisma } from "@/lib/prisma";
import { grantIndividualPermissions, requireRequestPermission, revokePermissionGrant } from "@/server/authorization/authority";
import { describeAuthorities } from "@/server/authorization/last-authority";
import { strandedAuthoritiesForAccount } from "@/server/authorization/permissions";
import { recordAuthorizationEvent } from "@/server/authorization/audit";
import { changeAccountStatusSchema, createRegistrationInviteSchema, deleteAccountSchema, grantAccountPermissionsSchema, revokeAccountPermissionSchema, updateAccountProfileSchema } from "./access-schema";
import { PERMISSION_ASSIGNMENT_POLICY, PERMISSION_CATALOG, PERMISSION_PRESETS, PRESET_ASSIGNMENT_POLICY, isPermissionCode, isPermissionPresetCode } from "@/server/authorization/catalog";
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
      const actor = await requireRequestPermission(request.headers, "access.users.read");

      const now = new Date();
      const accounts = await prisma.user.findMany({
        orderBy: [{ createdAt: "desc" }, { email: "asc" }],
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          createdAt: true,
          disabledAt: true,
          permissionGrants: {
            where: { revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
            orderBy: { grantedAt: "desc" },
            select: { permissionCode: true },
          },
        },
      });

      return {
        accounts: accounts.map((account) => ({
          id: account.id,
          isCurrentUser: account.id === actor.id,
          name: account.name,
          email: account.email,
          emailVerified: account.emailVerified,
          createdAt: account.createdAt.toISOString(),
          disabledAt: account.disabledAt?.toISOString() ?? null,
          permissionCodes: [...new Set(account.permissionGrants.map(({ permissionCode }) => permissionCode))].sort(),
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

  async changeAccountStatus(request: Request, accountId: string): Promise<Response> {
    const response = await this.respond(async () => {
      if (!process.env.DATABASE_URL) {
        throw new ApiError(503, "ACCOUNT_DIRECTORY_UNAVAILABLE", "Layanan akun belum tersedia.");
      }
      this.assertInviteRequestOrigin(request);
      const actor = await requireRequestPermission(request.headers, "access.users.disable");
      let payload: unknown;
      try { payload = await request.json(); } catch { throw new ApiError(400, "INVALID_REQUEST", "Status akun tidak valid."); }
      const parsed = changeAccountStatusSchema.safeParse(payload);
      if (!parsed.success) throw new ApiError(400, "INVALID_REQUEST", "Status akun dan alasan minimal 8 karakter wajib diisi.");

      const targetId = accountId.trim();
      if (!targetId) throw new ApiError(400, "INVALID_ACCOUNT", "ID akun tidak valid.");
      if (actor.id === targetId) throw new ApiError(403, "SELF_ACCOUNT_ACTION", "Anda tidak dapat mengubah status akun sendiri.");

      return prisma.$transaction(async (tx) => {
        const now = new Date();
        const target = await tx.user.findUnique({ where: { id: targetId }, select: { id: true, disabledAt: true } });
        if (!target) throw new ApiError(404, "ACCOUNT_NOT_FOUND", "Akun tidak ditemukan.");
        const currentlyDisabled = target.disabledAt !== null;
        if (currentlyDisabled === parsed.data.disabled) {
          return { id: target.id, disabledAt: target.disabledAt?.toISOString() ?? null };
        }

        if (parsed.data.disabled) {
          const stranded = await strandedAuthoritiesForAccount(targetId, tx, now);
          if (stranded.length > 0) {
            throw new ApiError(
              409,
              "LAST_PROTECTED_AUTHORITY",
              `Akun ini satu-satunya pemegang otoritas ${describeAuthorities(stranded)}. Alihkan otoritas tersebut ke akun aktif lain sebelum menonaktifkannya.`,
            );
          }
        }

        const disabledAt = parsed.data.disabled ? now : null;
        await tx.user.update({ where: { id: targetId }, data: { disabledAt } });
        if (parsed.data.disabled) {
          await tx.session.deleteMany({ where: { userId: targetId } });
          await tx.registrationInvite.updateMany({
            where: { createdByUserId: targetId, redeemedAt: null, revokedAt: null },
            data: { revokedAt: now, revokedByUserId: actor.id },
          });
        }
        await recordAuthorizationEvent(tx, {
          actorUserId: actor.id,
          subjectUserId: targetId,
          action: parsed.data.disabled ? "account.disabled" : "account.enabled",
          resourceType: "user",
          resourceId: targetId,
          reason: parsed.data.reason,
          metadata: { disabledAt: disabledAt?.toISOString() ?? null },
        });
        return { id: target.id, disabledAt: disabledAt?.toISOString() ?? null };
      }, { isolationLevel: "Serializable" });
    }, { code: "ACCOUNT_STATUS_UPDATE_FAILED", message: "Status akun belum dapat diperbarui." });
    return this.noStore(response);
  }

  async deleteAccount(request: Request, accountId: string): Promise<Response> {
    const response = await this.respond(async () => {
      if (!process.env.DATABASE_URL) {
        throw new ApiError(503, "ACCOUNT_DIRECTORY_UNAVAILABLE", "Layanan akun belum tersedia.");
      }
      this.assertInviteRequestOrigin(request);
      const actor = await requireRequestPermission(request.headers, "access.users.delete");
      let payload: unknown;
      try { payload = await request.json(); } catch { throw new ApiError(400, "INVALID_REQUEST", "Konfirmasi penghapusan akun tidak valid."); }
      const parsed = deleteAccountSchema.safeParse(payload);
      if (!parsed.success) throw new ApiError(400, "INVALID_REQUEST", "Masukkan email akun secara tepat dan alasan minimal 8 karakter.");

      const targetId = accountId.trim();
      if (!targetId) throw new ApiError(400, "INVALID_ACCOUNT", "ID akun tidak valid.");
      if (actor.id === targetId) throw new ApiError(403, "SELF_ACCOUNT_ACTION", "Anda tidak dapat menghapus akun sendiri.");

      await prisma.$transaction(async (tx) => {
        const target = await tx.user.findUnique({ where: { id: targetId }, select: { id: true, name: true, email: true, disabledAt: true } });
        if (!target) throw new ApiError(404, "ACCOUNT_NOT_FOUND", "Akun tidak ditemukan.");
        if (!target.disabledAt) throw new ApiError(409, "ACCOUNT_MUST_BE_DISABLED", "Nonaktifkan akun terlebih dahulu sebelum menghapusnya.");
        if (target.email.trim().toLocaleLowerCase("en-US") !== parsed.data.confirmationEmail.trim().toLocaleLowerCase("en-US")) {
          throw new ApiError(400, "ACCOUNT_CONFIRMATION_MISMATCH", "Email konfirmasi tidak cocok dengan akun yang dipilih.");
        }

        const stranded = await strandedAuthoritiesForAccount(targetId, tx);
        if (stranded.length > 0) {
          throw new ApiError(
            409,
            "LAST_PROTECTED_AUTHORITY",
            `Akun ini satu-satunya pemegang otoritas ${describeAuthorities(stranded)}. Alihkan otoritas tersebut ke akun aktif lain sebelum menghapusnya.`,
          );
        }

        await recordAuthorizationEvent(tx, {
          actorUserId: actor.id,
          subjectUserId: targetId,
          action: "account.deleted",
          resourceType: "user",
          resourceId: targetId,
          reason: parsed.data.reason,
          metadata: {
            disabledAt: target.disabledAt.toISOString(),
            deletedAccountName: target.name,
            deletedAccountEmail: target.email,
          },
        });
        await tx.user.delete({ where: { id: targetId } });
      }, { isolationLevel: "Serializable" });

      return { id: targetId, deleted: true };
    }, { code: "ACCOUNT_DELETE_FAILED", message: "Akun belum dapat dihapus." });
    return this.noStore(response);
  }

  async listAccountPermissionGrants(request: Request, accountId: string): Promise<Response> {
    const response = await this.respond(async () => {
      if (!process.env.DATABASE_URL) {
        throw new ApiError(503, "ACCOUNT_DIRECTORY_UNAVAILABLE", "Layanan akun belum tersedia.");
      }
      const targetId = accountId.trim();
      if (!targetId) throw new ApiError(400, "INVALID_ACCOUNT", "ID akun tidak valid.");
      await requireRequestPermission(request.headers, "access.users.read");

      const grants = await prisma.userPermissionGrant.findMany({
        where: {
          userId: targetId,
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: [{ permissionCode: "asc" }, { grantedAt: "desc" }],
        select: {
          id: true,
          permissionCode: true,
          grantedAt: true,
          expiresAt: true,
          reason: true,
          grantedBy: { select: { name: true } },
        },
      });
      const descriptions = new Map<string, { description: string; sensitive: boolean }>(PERMISSION_CATALOG.map(({ code, description, sensitive }) => [code, { description, sensitive }]));
      return {
        grants: grants.map((grant) => ({
          id: grant.id,
          permissionCode: grant.permissionCode,
          description: descriptions.get(grant.permissionCode)?.description ?? grant.permissionCode,
          sensitive: descriptions.get(grant.permissionCode)?.sensitive ?? false,
          grantedAt: grant.grantedAt.toISOString(),
          expiresAt: grant.expiresAt?.toISOString() ?? null,
          reason: grant.reason,
          grantedByName: grant.grantedBy?.name ?? "Akun dihapus",
        })),
      };
    }, { code: "ACCOUNT_PERMISSIONS_UNAVAILABLE", message: "Izin akun belum dapat dimuat." });
    return this.noStore(response);
  }

  async grantAccountPermissions(request: Request, accountId: string): Promise<Response> {
    const response = await this.respond(async () => {
      if (!process.env.DATABASE_URL) {
        throw new ApiError(503, "ACCOUNT_DIRECTORY_UNAVAILABLE", "Layanan akun belum tersedia.");
      }
      this.assertInviteRequestOrigin(request);
      const targetId = accountId.trim();
      if (!targetId) throw new ApiError(400, "INVALID_ACCOUNT", "ID akun tidak valid.");
      const actor = await requireRequestPermission(request.headers, "access.users.read");
      await requireRequestPermission(request.headers, "access.permissions.assign");

      let payload: unknown;
      try { payload = await request.json(); } catch { throw new ApiError(400, "INVALID_REQUEST", "Permintaan izin tidak valid."); }
      const parsed = grantAccountPermissionsSchema.safeParse(payload);
      if (!parsed.success) throw new ApiError(400, "INVALID_REQUEST", "Pilih izin dan isi alasan minimal 8 karakter.");

      const grant = await grantIndividualPermissions({
        actorUserId: actor.id,
        targetUserId: targetId,
        permissionCodes: parsed.data.permissionCodes,
        reason: parsed.data.reason,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
      });
      return grant;
    }, { code: "ACCOUNT_PERMISSION_GRANT_FAILED", message: "Izin akun belum dapat diberikan." });
    return this.noStore(response);
  }

  async revokeAccountPermission(request: Request, accountId: string, grantId: string): Promise<Response> {
    const response = await this.respond(async () => {
      if (!process.env.DATABASE_URL) {
        throw new ApiError(503, "ACCOUNT_DIRECTORY_UNAVAILABLE", "Layanan akun belum tersedia.");
      }
      this.assertInviteRequestOrigin(request);
      const targetId = accountId.trim();
      const id = grantId.trim();
      if (!targetId || !id) throw new ApiError(400, "INVALID_REQUEST", "ID akun atau izin tidak valid.");
      const actor = await requireRequestPermission(request.headers, "access.users.read");

      let payload: unknown;
      try { payload = await request.json(); } catch { throw new ApiError(400, "INVALID_REQUEST", "Permintaan pencabutan izin tidak valid."); }
      const parsed = revokeAccountPermissionSchema.safeParse(payload);
      if (!parsed.success) throw new ApiError(400, "INVALID_REQUEST", "Alasan pencabutan minimal 8 karakter.");

      const grant = await revokePermissionGrant({
        actorUserId: actor.id,
        targetUserId: targetId,
        grantId: id,
        reason: parsed.data.reason,
      });
      return { id: grant.id, revokedAt: grant.revokedAt?.toISOString() ?? null };
    }, { code: "ACCOUNT_PERMISSION_REVOKE_FAILED", message: "Izin akun belum dapat dicabut." });
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

      const permissionPresetCode = parsed.data.permissionPresetCode;
      const requestedPermissionCodes = parsed.data.permissionCodes;
      if (permissionPresetCode) {
        await requireRequestPermission(request.headers, "access.presets.apply");
        const grantablePresets = PRESET_ASSIGNMENT_POLICY["access.presets.apply"];
        if (!grantablePresets.includes(permissionPresetCode as (typeof grantablePresets)[number])) {
          throw new ApiError(403, "PRESET_NOT_ASSIGNABLE", "Paket izin ini tidak dapat diberikan melalui undangan.");
        }
      }
      if (requestedPermissionCodes.length > 0) {
        await requireRequestPermission(request.headers, "access.permissions.assign");
        const grantablePermissions = PERMISSION_ASSIGNMENT_POLICY["access.permissions.assign"];
        const allowed = new Set<string>(grantablePermissions);
        if (requestedPermissionCodes.some((code) => !isPermissionCode(code) || !allowed.has(code))) {
          throw new ApiError(403, "PERMISSION_NOT_ASSIGNABLE", "Satu atau beberapa izin tidak dapat diberikan secara langsung.");
        }
      }

      const selectedPreset = permissionPresetCode && isPermissionPresetCode(permissionPresetCode)
        ? PERMISSION_PRESETS.find(({ code }) => code === permissionPresetCode)
        : undefined;
      const permissionCodes = [...new Set(selectedPreset?.permissions ?? requestedPermissionCodes)];
      if (permissionCodes.length > 0) {
        const availablePermissions = await prisma.permission.findMany({
          where: { code: { in: permissionCodes } },
          select: { code: true },
        });
        if (availablePermissions.length !== permissionCodes.length) {
          throw new ApiError(503, "PERMISSION_CATALOG_UNAVAILABLE", "Katalog izin belum tersedia. Coba lagi setelah disinkronkan.");
        }
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
            permissionCodes,
            permissionGrantReason: permissionCodes.length > 0 ? parsed.data.reason : null,
          },
          select: { id: true, expiresAt: true, permissionCodes: true },
        });
        await recordAuthorizationEvent(tx, {
          actorUserId: actor.id,
          action: "registration_invite.created",
          resourceType: "registration_invite",
          resourceId: created.id,
          reason: parsed.data.reason,
          metadata: {
            expiresAt: created.expiresAt.toISOString(),
            permissionPresetCode,
            permissionCodes: created.permissionCodes,
          },
        });
        return created;
      }, { isolationLevel: "Serializable" });

      const inviteUrl = new URL("/register", inviteBaseUrl.origin);
      inviteUrl.hash = new URLSearchParams({ invite: token }).toString();

      return {
        id: invite.id,
        email,
        expiresAt: invite.expiresAt.toISOString(),
        permissionPresetCode,
        permissionCodes: invite.permissionCodes,
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
