import type { PermissionCode } from "./catalog";

export type AuthorizationDomain = "reports" | "analytics" | "access" | "sources";

export type AuthorizationContext = {
  resource?: { type: string; id?: string };
  requestId?: string;
};

export type AuthorizationDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

export type AuthorizationStrategyInput = {
  permission: PermissionCode;
  grantedPermissions: ReadonlySet<PermissionCode>;
  context?: AuthorizationContext;
};

export interface AuthorizationStrategy {
  readonly domain: AuthorizationDomain;
  decide(input: AuthorizationStrategyInput): AuthorizationDecision;
}
