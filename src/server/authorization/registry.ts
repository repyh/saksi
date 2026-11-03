import type { PermissionCode } from "./catalog";
import { analyticsAuthorizationStrategy } from "./strategies/analytics";
import { accessAuthorizationStrategy } from "./strategies/access";
import { reportsAuthorizationStrategy } from "./strategies/reports";
import { sourcesAuthorizationStrategy } from "./strategies/sources";
import type { AuthorizationDomain, AuthorizationStrategy } from "./types";

const strategies = {
  reports: reportsAuthorizationStrategy,
  analytics: analyticsAuthorizationStrategy,
  access: accessAuthorizationStrategy,
  sources: sourcesAuthorizationStrategy,
} satisfies Record<AuthorizationDomain, AuthorizationStrategy>;

export function strategyForPermission(permission: PermissionCode): AuthorizationStrategy {
  const domain = permission.split(".")[0] as AuthorizationDomain;
  return strategies[domain];
}
