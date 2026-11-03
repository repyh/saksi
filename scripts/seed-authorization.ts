import { prisma } from "../src/lib/prisma";
import { PERMISSION_BUNDLES, PERMISSION_CATALOG } from "../src/server/authorization/catalog";

async function seedAuthorization() {
  await prisma.$transaction(async (tx) => {
    for (const permission of PERMISSION_CATALOG) {
      await tx.permission.upsert({
        where: { code: permission.code },
        create: permission,
        update: { description: permission.description, sensitive: permission.sensitive },
      });
    }

    for (const definition of PERMISSION_BUNDLES) {
      const bundle = await tx.permissionBundle.upsert({
        where: { code: definition.code },
        create: {
          code: definition.code,
          name: definition.name,
          description: definition.description,
        },
        update: {
          name: definition.name,
          description: definition.description,
          isSystem: true,
          isActive: true,
        },
      });

      await tx.permissionBundlePermission.deleteMany({ where: { bundleId: bundle.id } });
      await tx.permissionBundlePermission.createMany({
        data: definition.permissions.map((permissionCode) => ({
          bundleId: bundle.id,
          permissionCode,
        })),
      });
    }

    const bootstrapEmail = process.env.AUTHZ_BOOTSTRAP_ADMIN_EMAIL?.trim().toLocaleLowerCase("en-US");
    if (!bootstrapEmail) return;

    const admin = await tx.user.findUnique({ where: { email: bootstrapEmail } });
    if (!admin || !admin.emailVerified) {
      throw new Error("Bootstrap account must exist and have a verified email before seeding admin access.");
    }
    const adminBundle = await tx.permissionBundle.findUniqueOrThrow({ where: { code: "admin" } });
    const existingGrant = await tx.userBundleGrant.findFirst({
      where: {
        userId: admin.id,
        bundleId: adminBundle.id,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true },
    });
    if (!existingGrant) {
      await tx.userBundleGrant.create({
        data: {
          userId: admin.id,
          bundleId: adminBundle.id,
          grantedByUserId: admin.id,
          reason: "Initial administrator bootstrap",
        },
      });
      await tx.authorizationAuditEvent.create({
        data: {
          subjectUserId: admin.id,
          action: "bundle.bootstrapped",
          resourceType: "permission_bundle",
          resourceId: adminBundle.id,
          reason: "Initial administrator bootstrap",
          metadata: { bundleCode: "admin" },
        },
      });
    }
  });
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
