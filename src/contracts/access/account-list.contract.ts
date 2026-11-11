import { z } from "zod";

export const accountListItemSchema = z.object({
  id: z.string(),
  isCurrentUser: z.boolean(),
  name: z.string(),
  email: z.email(),
  emailVerified: z.boolean(),
  createdAt: z.string().datetime(),
  disabledAt: z.string().datetime().nullable(),
  permissionCodes: z.array(z.string()),
});

export const accountListResponseSchema = z.object({
  accounts: z.array(accountListItemSchema),
});

export type AccountListItem = z.infer<typeof accountListItemSchema>;
export type AccountListResponse = z.infer<typeof accountListResponseSchema>;
