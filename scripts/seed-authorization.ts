import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { PERMISSION_CATALOG, PERMISSION_PRESETS } from "../src/server/authorization/catalog";

async function seedAuthorization() {
  await prisma.$transaction(async (tx) => {
    for (const permission of PERMISSION_CATALOG) {
      await tx.permission.upsert({
        where: { code: permission.code },
        create: permission,
        update: { description: permission.description, sensitive: permission.sensitive },
      });
    }

    const bootstrapEmail = process.env.AUTHZ_BOOTSTRAP_ADMIN_EMAIL?.trim().toLocaleLowerCase("en-US");
    if (!bootstrapEmail) return;

    const admin = await tx.user.findUnique({ where: { email: bootstrapEmail } });
    if (!admin || !admin.emailVerified) {
      throw new Error("Bootstrap account must exist and have a verified email before seeding admin access.");
    }
    const adminPreset = PERMISSION_PRESETS.find(({ code }) => code === "admin");
    if (!adminPreset) throw new Error("The source-controlled admin permission preset is missing.");
    const existingGrants = await tx.userPermissionGrant.findMany({
      where: {
        userId: admin.id,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { permissionCode: true },
    });
    const activeCodes = new Set(existingGrants.map(({ permissionCode }) => permissionCode));
    const missingPermissionCodes = adminPreset.permissions.filter((code) => !activeCodes.has(code));
    if (missingPermissionCodes.length > 0) {
      const grantBatchId = randomUUID();
      await tx.userPermissionGrant.createMany({
        data: missingPermissionCodes.map((permissionCode) => ({
          userId: admin.id,
          permissionCode,
          grantedByUserId: admin.id,
          reason: "Initial administrator bootstrap",
          grantBatchId,
        })),
      });
      await tx.authorizationAuditEvent.create({
        data: {
          actorUserId: admin.id,
          subjectUserId: admin.id,
          action: "permission.preset_bootstrapped",
          resourceType: "permission_set",
          reason: "Initial administrator bootstrap",
          metadata: { presetCode: "admin", permissionCodes: missingPermissionCodes, grantBatchId },
        },
      });
    }
  }, { timeout: 30_000 });
}

try {
  await seedAuthorization();
  process.stdout.write("Authorization catalog seeded.\n");
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "Authorization seed failed."}\n`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
