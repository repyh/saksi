import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  PERMISSION_ASSIGNMENT_POLICY,
  PERMISSION_PRESETS,
  PRESET_ASSIGNMENT_POLICY,
  isPermissionCode,
  isPermissionPresetCode,
  type PermissionCode,
} from "../catalog";
import { recordAuthorizationEvent } from "../audit";
import { AuthorizationError } from "../errors";
import { activeGrantWhere, permissionsForUser } from "../permissions";
import type { AuthorizationStrategy } from "../types";

const accessPermissions = [
  "access.users.read",
  "access.permissions.read_own",
  "access.users.edit",
  "access.users.invite",
  "access.users.disable",
  "access.presets.apply",
  "access.permissions.assign",
  "access.audit.read",
] as const satisfies readonly PermissionCode[];

export const accessAuthorizationStrategy: AuthorizationStrategy = {
  domain: "access",
  decide({ permission, grantedPermissions }) {
    if (!accessPermissions.includes(permission as (typeof accessPermissions)[number])) {
      return { allowed: false, reason: "Permission does not belong to the access domain." };
    }
    if (!grantedPermissions.has(permission)) {
      return { allowed: false, reason: "The required access permission is not granted." };
    }
    return { allowed: true };
  },
};

function assertCanAssignPreset(permissions: ReadonlySet<PermissionCode>, presetCode: string): void {
  if (!permissions.has("access.presets.apply")) {
    throw new AuthorizationError(403, "You do not have permission to apply access presets.");
  }
  const allowed = PRESET_ASSIGNMENT_POLICY["access.presets.apply"] as readonly string[];
  if (!allowed.includes(presetCode)) {
    throw new AuthorizationError(403, "This permission preset is not approved for assignment.");
  }
}

function assertCanAssignPermissionBits(permissions: ReadonlySet<PermissionCode>, codes: readonly string[]): asserts codes is readonly PermissionCode[] {
  if (!permissions.has("access.permissions.assign")) {
    throw new AuthorizationError(403, "You do not have permission to assign individual permission bits.");
  }
  const allowed = new Set<string>(PERMISSION_ASSIGNMENT_POLICY["access.permissions.assign"]);
  if (codes.some((code) => !isPermissionCode(code) || !allowed.has(code))) {
    throw new AuthorizationError(403, "One or more permission bits are not approved for direct assignment.");
  }
}

async function grantPermissionBits(input: {
  actorUserId: string;
  targetUserId: string;
  permissionCodes: readonly PermissionCode[];
  reason: string;
  expiresAt?: Date;
  requestId?: string;
  sourcePresetCode?: string;
}) {
  const reason = input.reason.trim();
  const permissionCodes = [...new Set(input.permissionCodes)];
  if (!reason) throw new AuthorizationError(400, "A reason is required for access grants.");
  if (permissionCodes.length === 0) throw new AuthorizationError(400, "At least one permission bit is required.");
  if (input.actorUserId === input.targetUserId) throw new AuthorizationError(403, "You cannot grant permissions to yourself.");
  if (input.expiresAt && input.expiresAt <= new Date()) throw new AuthorizationError(400, "Grant expiry must be in the future.");

  return prisma.$transaction(async (tx) => {
    const [actorPermissions, target, availablePermissions] = await Promise.all([
      permissionsForUser(input.actorUserId, tx),
      tx.user.findUnique({ where: { id: input.targetUserId }, select: { id: true } }),
      tx.permission.findMany({ where: { code: { in: permissionCodes } }, select: { code: true } }),
    ]);
    if (!target) throw new AuthorizationError(404, "Target account was not found.");
    if (availablePermissions.length !== permissionCodes.length) {
      throw new AuthorizationError(503, "The permission catalog is not synchronized.");
    }
    if (!input.sourcePresetCode) assertCanAssignPermissionBits(actorPermissions, permissionCodes);
    else assertCanAssignPreset(actorPermissions, input.sourcePresetCode);

    const grantBatchId = randomUUID();
    await tx.userPermissionGrant.createMany({
      data: permissionCodes.map((permissionCode) => ({
        userId: input.targetUserId,
        permissionCode,
        grantedByUserId: input.actorUserId,
        grantedAt: new Date(),
        expiresAt: input.expiresAt,
        reason,
        grantBatchId,
      })),
    });
    await recordAuthorizationEvent(tx, {
      actorUserId: input.actorUserId,
      subjectUserId: input.targetUserId,
      action: input.sourcePresetCode ? "permission.preset_applied" : "permission.bits_granted",
      resourceType: "permission_set",
      resourceId: grantBatchId,
      reason,
      requestId: input.requestId,
      metadata: {
        ...(input.sourcePresetCode ? { presetCode: input.sourcePresetCode } : {}),
        permissionCodes,
        expiresAt: input.expiresAt?.toISOString() ?? null,
      },
    });
    return { grantBatchId, permissionCodes };
  }, { isolationLevel: "Serializable" });
}

/** Apply a source-controlled preset by materializing one grant row per permission bit. */
export async function grantPermissionPreset(input: {
  actorUserId: string;
  targetUserId: string;
  presetCode: string;
  reason: string;
  expiresAt?: Date;
  requestId?: string;
}) {
  if (!isPermissionPresetCode(input.presetCode)) throw new AuthorizationError(400, "Unknown permission preset.");
  const preset = PERMISSION_PRESETS.find(({ code }) => code === input.presetCode);
  if (!preset) throw new AuthorizationError(400, "Unknown permission preset.");
  return grantPermissionBits({ ...input, permissionCodes: preset.permissions, sourcePresetCode: preset.code });
}

/** Assign individual permission bits without associating a persisted preset with the user. */
export async function grantIndividualPermissions(input: {
  actorUserId: string;
  targetUserId: string;
  permissionCodes: readonly string[];
  reason: string;
  expiresAt?: Date;
  requestId?: string;
}) {
  return grantPermissionBits({ ...input, permissionCodes: input.permissionCodes as readonly PermissionCode[] });
}

export async function revokePermissionGrant(input: {
  actorUserId: string;
  targetUserId: string;
  grantId: string;
  reason: string;
  requestId?: string;
}) {
  const reason = input.reason.trim();
  if (!reason) throw new AuthorizationError(400, "A reason is required for access revocation.");

  return prisma.$transaction(async (tx) => {
    const actorPermissions = await permissionsForUser(input.actorUserId, tx);
    if (!actorPermissions.has("access.permissions.assign")) {
      throw new AuthorizationError(403, "You do not have permission to revoke individual permission bits.");
    }
    const grant = await tx.userPermissionGrant.findFirst({
      where: { id: input.grantId, userId: input.targetUserId, ...activeGrantWhere(new Date()) },
      select: { id: true, userId: true, permissionCode: true },
    });
    if (!grant) throw new AuthorizationError(404, "Active permission grant was not found.");
    if (grant.userId === input.actorUserId) throw new AuthorizationError(403, "You cannot revoke permissions from your own account.");

    const otherPermissions = await permissionsForUser(grant.userId, tx, grant.id);
    const isDelegationAuthority = grant.permissionCode === "access.presets.apply" || grant.permissionCode === "access.permissions.assign";
    if (isDelegationAuthority) {
      if (!actorPermissions.has("access.presets.apply")) {
        throw new AuthorizationError(403, "Only an administrator may revoke a delegation authority.");
      }
      const authorityRemains = otherPermissions.has(grant.permissionCode as PermissionCode)
        || Boolean(await tx.userPermissionGrant.findFirst({
          where: {
            userId: { not: grant.userId },
            permissionCode: grant.permissionCode,
            ...activeGrantWhere(new Date()),
          },
          select: { id: true },
        }));
      if (!authorityRemains) {
        throw new AuthorizationError(403, "Grant this delegation authority to another administrator before revoking it.");
      }
    }

    const revokedAt = new Date();
    const updated = await tx.userPermissionGrant.update({
      where: { id: grant.id },
      data: { revokedAt, revokedByUserId: input.actorUserId },
    });
    await recordAuthorizationEvent(tx, {
      actorUserId: input.actorUserId,
      subjectUserId: grant.userId,
      action: "permission.revoked",
      resourceType: "permission",
      resourceId: grant.permissionCode,
      reason,
      requestId: input.requestId,
      metadata: { grantId: grant.id },
    });
    return updated;
  }, { isolationLevel: "Serializable" });
}
