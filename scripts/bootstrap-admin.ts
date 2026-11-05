import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { auth } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";
import { PERMISSION_CATALOG, PERMISSION_PRESETS } from "../src/server/authorization/catalog";

const emailInput = process.argv[2]?.trim().toLowerCase();
const emailResult = z.email().max(254).safeParse(emailInput);

if (!emailResult.success) {
  process.stderr.write("Usage: bun scripts/bootstrap-admin.ts <email>\n");
  process.exitCode = 1;
} else {
  const email = emailResult.data;

  try {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) throw new Error("That email already has an account. No changes were made.");

    const password = randomBytes(24).toString("base64url");
    const passwordContext = await auth.$context;
    const passwordHash = await passwordContext.password.hash(password);
    const passwordVerified = await passwordContext.password.verify({ hash: passwordHash, password });
    if (!passwordVerified) throw new Error("The new credential hash did not verify.");
    const now = new Date();
    const userId = randomUUID();
    const adminPreset = PERMISSION_PRESETS.find((preset) => preset.code === "admin");
    if (!adminPreset) throw new Error("The source-controlled admin permission preset is missing.");

    const permissionCount = await prisma.$transaction(async (tx) => {
      const concurrentExisting = await tx.user.findUnique({ where: { email }, select: { id: true } });
      if (concurrentExisting) throw new Error("That email already has an account. No changes were made.");

      const seededPermissions = await tx.permission.findMany({ select: { code: true } });
      const seededCodes = new Set(seededPermissions.map(({ code }) => code));
      if (PERMISSION_CATALOG.some(({ code }) => !seededCodes.has(code))) {
        throw new Error("The permission catalog is not synchronized. Run db:seed:authorization first.");
      }

      const user = await tx.user.create({
        data: {
          id: userId,
          name: "SAKSI Admin",
          email,
          emailVerified: false,
          createdAt: now,
          updatedAt: now,
        },
      });

      await tx.account.create({
        data: {
          id: randomUUID(),
          accountId: user.id,
          providerId: "credential",
          userId: user.id,
          password: passwordHash,
          createdAt: now,
          updatedAt: now,
        },
      });

      const grantBatchId = randomUUID();
      await tx.userPermissionGrant.createMany({
        data: adminPreset.permissions.map((permissionCode) => ({
          userId: user.id,
          permissionCode,
          grantedByUserId: user.id,
          reason: "Initial administrator bootstrap",
          grantBatchId,
        })),
      });
      await tx.authorizationAuditEvent.create({
        data: {
          actorUserId: user.id,
          subjectUserId: user.id,
          action: "permission.preset_bootstrapped",
          resourceType: "permission_set",
          reason: "Initial administrator bootstrap",
          metadata: { presetCode: "admin", permissionCodes: adminPreset.permissions, grantBatchId },
        },
      });

      return adminPreset.permissions.length;
    }, { isolationLevel: "Serializable" });

    process.stdout.write(`Admin account created for ${email}.\n`);
    process.stdout.write(`Admin permissions granted: ${permissionCount}.\n`);
    process.stdout.write(`Temporary password (shown once): ${password}\n`);
    process.stdout.write("Email remains unverified; verify the mailbox before using this account outside testing.\n");
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "Admin bootstrap failed."}\n`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
