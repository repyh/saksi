import "server-only";
import { z } from "zod";

export const createRegistrationInviteSchema = z.object({
  email: z.email().max(254),
  expiresInDays: z.number().int().min(1).max(30).default(7),
  reason: z.string().trim().min(8).max(500),
});

export const updateAccountProfileSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export type CreateRegistrationInviteInput = z.infer<typeof createRegistrationInviteSchema>;
