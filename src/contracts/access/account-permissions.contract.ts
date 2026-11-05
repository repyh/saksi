import { z } from "zod";

export const accountPermissionGrantSchema = z.object({
  id: z.string(),
  permissionCode: z.string(),
  description: z.string(),
  sensitive: z.boolean(),
  grantedAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
  reason: z.string(),
  grantedByName: z.string(),
});

export const accountPermissionGrantsResponseSchema = z.object({
  grants: z.array(accountPermissionGrantSchema),
});

export type AccountPermissionGrant = z.infer<typeof accountPermissionGrantSchema>;
