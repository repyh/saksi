import "server-only";

export type ApiRequestContext = {
  requestId: string;
  actor: { userId: string } | null;
};

/** Context shape for domain APIs that need request tracing or an authenticated actor. */
export function createApiRequestContext(actor: ApiRequestContext["actor"] = null): ApiRequestContext {
  return {
    requestId: crypto.randomUUID(),
    actor,
  };
}
