import "server-only";
import { z } from "zod";

export const createRegistrationInviteSchema = z.object({
  email: z.email().max(254),
  expiresInDays: z.number().int().min(1).max(30).default(7),
  reason: z.string().trim().min(8).max(500),
  permissionPresetCode: z.enum(["analyst", "moderator", "admin"]).nullable().default(null),
  permissionCodes: z.array(z.string().min(1).max(100)).max(24).default([]),
}).superRefine((value, context) => {
  if (value.permissionPresetCode && value.permissionCodes.length > 0) {
    context.addIssue({ code: "custom", path: ["permissionCodes"], message: "Choose a permission preset or individual permissions, not both." });
  }
  if (new Set(value.permissionCodes).size !== value.permissionCodes.length) {
    context.addIssue({ code: "custom", path: ["permissionCodes"], message: "Individual permissions must be unique." });
  }
});

export const updateAccountProfileSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export const grantAccountPermissionsSchema = z.object({
  permissionCodes: z.array(z.string().min(1).max(100)).min(1).max(24),
  reason: z.string().trim().min(8).max(500),
  expiresAt: z.string().datetime().nullable().optional(),
}).superRefine((value, context) => {
  if (new Set(value.permissionCodes).size !== value.permissionCodes.length) {
    context.addIssue({ code: "custom", path: ["permissionCodes"], message: "Permission codes must be unique." });
  }
});

export const revokeAccountPermissionSchema = z.object({
  reason: z.string().trim().min(8).max(500),
});

export type CreateRegistrationInviteInput = z.infer<typeof createRegistrationInviteSchema>;
