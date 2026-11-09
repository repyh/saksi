import type { AuthorizationStrategy } from "../types";

export const analyticsAuthorizationStrategy: AuthorizationStrategy = {
  domain: "analytics",
  decide() {
    return { allowed: false, reason: "Analytics permissions are not enabled until their workflows are implemented." };
  },
};
