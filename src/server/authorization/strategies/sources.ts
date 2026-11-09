import type { AuthorizationStrategy } from "../types";

export const sourcesAuthorizationStrategy: AuthorizationStrategy = {
  domain: "sources",
  decide() {
    return { allowed: false, reason: "Source operation permissions are not enabled until their workflows are implemented." };
  },
};
