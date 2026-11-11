BEGIN;

ALTER TABLE "User"
  ADD COLUMN "disabled_at" TIMESTAMPTZ(6);

ALTER TABLE "UserPermissionGrant"
  DROP CONSTRAINT "UserPermissionGrant_grantedByUserId_fkey",
  ALTER COLUMN "grantedByUserId" DROP NOT NULL,
  ADD CONSTRAINT "UserPermissionGrant_grantedByUserId_fkey"
    FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RegistrationInvite"
  DROP CONSTRAINT "RegistrationInvite_createdByUserId_fkey",
  ALTER COLUMN "createdByUserId" DROP NOT NULL,
  ADD CONSTRAINT "RegistrationInvite_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "Permission" ("code", "description", "sensitive")
VALUES
  ('access.users.disable', 'Disable or restore staff accounts and revoke sessions', TRUE),
  ('access.users.delete', 'Permanently remove a disabled staff account', TRUE)
ON CONFLICT ("code") DO UPDATE
SET "description" = EXCLUDED."description", "sensitive" = EXCLUDED."sensitive";

-- Existing holders of the controlled Admin delegation bit receive the two
-- new Admin preset permissions. Individual grants cannot delegate these bits.
WITH admin_accounts AS (
  SELECT DISTINCT grant_row."userId"
  FROM "UserPermissionGrant" AS grant_row
  JOIN "User" AS account ON account."id" = grant_row."userId"
  WHERE grant_row."permissionCode" = 'access.presets.apply'
    AND grant_row."revokedAt" IS NULL
    AND (grant_row."expiresAt" IS NULL OR grant_row."expiresAt" > CURRENT_TIMESTAMP)
    AND account."disabled_at" IS NULL
)
INSERT INTO "UserPermissionGrant" (
  "id", "userId", "permissionCode", "grantedByUserId", "grantedAt", "reason"
)
SELECT gen_random_uuid()::TEXT, admins."userId", permission."code", admins."userId", CURRENT_TIMESTAMP,
  'Added to the controlled Admin preset when account lifecycle controls were enabled.'
FROM admin_accounts AS admins
CROSS JOIN (VALUES ('access.users.disable'), ('access.users.delete')) AS permission("code")
WHERE NOT EXISTS (
  SELECT 1
  FROM "UserPermissionGrant" AS existing
  WHERE existing."userId" = admins."userId"
    AND existing."permissionCode" = permission."code"
    AND existing."revokedAt" IS NULL
    AND (existing."expiresAt" IS NULL OR existing."expiresAt" > CURRENT_TIMESTAMP)
);

INSERT INTO "AuthorizationAuditEvent" (
  "id", "action", "resourceType", "reason", "metadata", "createdAt"
)
VALUES (
  gen_random_uuid()::TEXT,
  'permission.catalog_extended',
  'permission_catalog',
  'Enabled audited account lifecycle controls for the controlled Admin preset.',
  jsonb_build_object('permissionCodes', ARRAY['access.users.disable', 'access.users.delete']),
  CURRENT_TIMESTAMP
);

COMMIT;