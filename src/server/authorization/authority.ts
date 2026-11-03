import "server-only";
import { auth } from "@/lib/auth";
import { isPermissionCode, type PermissionCode } from "./catalog";
import { AuthorizationError } from "./errors";
import { permissionsForUser } from "./permissions";
import { strategyForPermission } from "./registry";
import type { AuthorizationContext, AuthorizationDecision } from "./types";

export { AuthorizationError } from "./errors";
export { grantPermissionBundle, revokePermissionBundle } from "./strategies/access";

/** The single policy decision entry point used by routes, actions, and server use cases. */
export async function authorizePermission(
  userId: string | null | undefined,
  permission: string,
  context?: AuthorizationContext,
): Promise<AuthorizationDecision> {
  if (!userId) return { allowed: false, reason: "Authentication is required." };
  if (!isPermissionCode(permission)) return { allowed: false, reason: "Unknown permission." };

  const grantedPermissions = await permissionsForUser(userId);
  return strategyForPermission(permission).decide({ permission, grantedPermissions, context });
}

export async function hasPermission(userId: string, permission: string): Promise<boolean> {
  const decision = await authorizePermission(userId, permission);
  return decision.allowed;
}

export async function listUserPermissions(userId: string): Promise<PermissionCode[]> {
  if (!userId) return [];
  return [...await permissionsForUser(userId)].sort();
}

export async function requirePermission(
  userId: string | null | undefined,
  permission: string,
  context?: AuthorizationContext,
): Promise<void> {
  if (!userId) throw new AuthorizationError(401, "Authentication is required.");
  const decision = await authorizePermission(userId, permission, context);
  if (!decision.allowed) {
    throw new AuthorizationError(403, "You do not have permission to perform this action.");
  }
}

export async function requireRequestPermission(
  headers: Headers,
  permission: string,
  context?: AuthorizationContext,
) {
  const session = await auth.api.getSession({ headers });
  const user = session?.user;
  if (!user) throw new AuthorizationError(401, "Authentication is required.");
  await requirePermission(user.id, permission, context);
  return user;
}

export function authorizationResponse(error: unknown): Response | null {
  if (!(error instanceof AuthorizationError)) return null;
  return Response.json(
    {
      data: null,
      error: {
        code: error.status === 401 ? "AUTHENTICATION_REQUIRED" : "PERMISSION_DENIED",
        message: error.message,
      },
    },
    { status: error.status },
  );
}
