import "server-only";
import { createHash, randomBytes } from "node:crypto";

export function createRegistrationToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashRegistrationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
