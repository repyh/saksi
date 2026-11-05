import "server-only";
import { prisma } from "@/lib/prisma";
import { BUNDLE_ASSIGNMENT_POLICY, type PermissionCode } from "../catalog";
import { recordAuthorizationEvent } from "../audit";
import { AuthorizationError } from "../errors";
import { activeGrantWhere, permissionsForUser } from "../permissions";
import type { AuthorizationStrategy } from "../types";

const accessPermissions = [
  "access.users.read",
  "access.users.edit",
  "access.users.invite",
  "access.users.disable",
  "access.bundles.assign",
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

function assertCanAssignBundles(permissions: ReadonlySet<PermissionCode>): void {
  const assignment = accessAuthorizationStrategy.decide({
    permission: "access.bundles.assign",
    grantedPermissions: permissions,
  });
  if (!assignment.allowed) throw new AuthorizationError(403, "You do not have permission to assign access bundles.");
}

function assertBundleIsGrantable(bundleCode: string): void {
  const grantableBundles = BUNDLE_ASSIGNMENT_POLICY["access.bundles.assign"];
  if (!grantableBundles.includes(bundleCode as (typeof grantableBundles)[number])) {
    throw new AuthorizationError(403, "This permission bundle is not in the approved assignment policy.");
  }
}

export async function grantPermissionBundle(input: {
  actorUserId: string;
  targetUserId: string;
  bundleCode: string;
  reason: string;
  expiresAt?: Date;
  requestId?: string;
}) {
  const reason = input.reason.trim();
  if (!reason) throw new AuthorizationError(403, "A reason is required for access grants.");
  if (input.actorUserId === input.targetUserId) {
    throw new AuthorizationError(403, "You cannot grant a bundle to yourself.");
  }
  if (input.expiresAt && input.expiresAt <= new Date()) {
    throw new AuthorizationError(403, "Grant expiry must be in the future.");
  }

  return prisma.$transaction(async (tx) => {
    const [actorPermissions, target, bundle] = await Promise.all([
      permissionsForUser(input.actorUserId, tx),
      tx.user.findUnique({ where: { id: input.targetUserId }, select: { id: true } }),
      tx.permissionBundle.findUnique({ where: { code: input.bundleCode } }),
    ]);
    assertCanAssignBundles(actorPermissions);
    assertBundleIsGrantable(input.bundleCode);
    if (!target) throw new AuthorizationError(403, "Target account was not found.");
    if (!bundle?.isActive) throw new AuthorizationError(403, "Permission bundle is unavailable.");

    const existing = await tx.userBundleGrant.findFirst({
      where: {
        userId: input.targetUserId,
        bundleId: bundle.id,
        ...activeGrantWhere(new Date()),
      },
      select: { id: true },
    });
    if (existing) throw new AuthorizationError(403, "This account already has the active bundle.");

    const grant = await tx.userBundleGrant.create({
      data: {
        userId: input.targetUserId,
        bundleId: bundle.id,
        grantedByUserId: input.actorUserId,
        reason,
        expiresAt: input.expiresAt,
      },
    });
    await recordAuthorizationEvent(tx, {
      actorUserId: input.actorUserId,
      subjectUserId: input.targetUserId,
      action: "bundle.granted",
      resourceType: "permission_bundle",
      resourceId: bundle.id,
      reason,
      requestId: input.requestId,
      metadata: { bundleCode: bundle.code, expiresAt: input.expiresAt?.toISOString() ?? null },
    });
    return grant;
  }, { isolationLevel: "Serializable" });
}

export async function revokePermissionBundle(input: {
  actorUserId: string;
  grantId: string;
  reason: string;
  requestId?: string;
}) {
  const reason = input.reason.trim();
  if (!reason) throw new AuthorizationError(403, "A reason is required for access revocation.");

  return prisma.$transaction(async (tx) => {
    const actorPermissions = await permissionsForUser(input.actorUserId, tx);
    assertCanAssignBundles(actorPermissions);

    const grant = await tx.userBundleGrant.findFirst({
      where: { id: input.grantId, ...activeGrantWhere(new Date()) },
      include: { bundle: { select: { code: true, permissions: { select: { permissionCode: true } } } } },
    });
    if (!grant) throw new AuthorizationError(403, "Active permission grant was not found.");

    const subjectPermissions = await permissionsForUser(grant.userId, tx, grant.id);
    const removesLastAssignmentAuthority = grant.bundle.permissions.some(
      ({ permissionCode }) => permissionCode === "access.bundles.assign",
    ) && !subjectPermissions.has("access.bundles.assign");
    if (removesLastAssignmentAuthority) {
      throw new AuthorizationError(403, "Assign the access bundle to another administrator before revoking this grant.");
    }

    const revokedAt = new Date();
    const updated = await tx.userBundleGrant.update({
      where: { id: grant.id },
      data: { revokedAt, revokedByUserId: input.actorUserId },
    });
    await recordAuthorizationEvent(tx, {
      actorUserId: input.actorUserId,
      subjectUserId: grant.userId,
      action: "bundle.revoked",
      resourceType: "permission_bundle",
      resourceId: grant.bundleId,
      reason,
      requestId: input.requestId,
      metadata: { bundleCode: grant.bundle.code, grantId: grant.id },
    });
    return updated;
  }, { isolationLevel: "Serializable" });
}
