import "server-only";
import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { getCurrentAdapter } from "@better-auth/core/context";
import { prisma } from "@/lib/prisma";
import { hashRegistrationToken } from "@/server/registration/token";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
    transaction: true,
  }),
  // Register the invite fields used by the transactional adapter in the signup hook.
  plugins: [{
    id: "registration-invites",
    schema: {
      registrationInvite: {
        disableMigration: true,
        fields: {
          tokenHash: { type: "string", returned: false },
          email: { type: "string", returned: false },
          expiresAt: { type: "date", returned: false },
          redeemedAt: { type: "date", required: false, returned: false },
          revokedAt: { type: "date", required: false, returned: false },
          redeemedByUserId: { type: "string", required: false, returned: false },
        },
      },
    },
  }],
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    minPasswordLength: 12,
    maxPasswordLength: 128,
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user, endpoint) => {
          if (endpoint?.path !== "/sign-up/email") return false;
          if (!user.name.trim() || user.name.trim().length > 100) return false;

          const token = endpoint.request?.headers.get("x-saksi-invite-token");
          if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return false;

          const adapter = await getCurrentAdapter(endpoint.context.adapter);
          const now = new Date();
          const userId = randomUUID();
          const redeemed = await adapter.updateMany({
            model: "registrationInvite",
            where: [
              { field: "tokenHash", value: hashRegistrationToken(token) },
              { field: "email", value: user.email.trim().toLowerCase() },
              { field: "redeemedAt", value: null },
              { field: "revokedAt", value: null },
              { field: "expiresAt", value: now, operator: "gt" },
            ],
            update: {
              redeemedAt: now,
              redeemedByUserId: userId,
            },
          });

          return redeemed === 1 ? { data: { id: userId } } : false;
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { disabledAt: true },
          });
          return user !== null && user.disabledAt === null;
        },
      },
    },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    customRules: {
      "/sign-in/email": {
        window: 60,
        max: 5,
      },
      "/sign-up/email": {
        window: 60,
        max: 5,
      },
    },
  },
});
