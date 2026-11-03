import "server-only";
import type { Prisma } from "@/generated/prisma/client";

export function recordAuthorizationEvent(
  tx: Prisma.TransactionClient,
  data: Prisma.AuthorizationAuditEventUncheckedCreateInput,
) {
  return tx.authorizationAuditEvent.create({ data });
}
