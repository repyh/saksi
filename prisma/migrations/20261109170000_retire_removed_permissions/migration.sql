BEGIN;

CREATE TABLE "RetiredPermissionRecordArchive" (
  "sourceTable" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "permissionCode" TEXT NOT NULL,
  "recordSnapshot" JSONB NOT NULL,
  "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "retirementReason" TEXT NOT NULL,
  CONSTRAINT "RetiredPermissionRecordArchive_pkey"
    PRIMARY KEY ("sourceTable", "sourceId", "permissionCode")
);

CREATE INDEX "RetiredPermissionRecordArchive_permissionCode_archivedAt_idx"
  ON "RetiredPermissionRecordArchive"("permissionCode", "archivedAt");

CREATE TEMPORARY TABLE "_retiredPermissionCodes" ("code" TEXT PRIMARY KEY) ON COMMIT DROP;
INSERT INTO "_retiredPermissionCodes" ("code") VALUES
  ('reports.read_precise_location'),
  ('reports.assign'),
  ('reports.change_status'),
  ('reports.add_internal_note'),
  ('reports.redact'),
  ('reports.export'),
  ('analytics.read'),
  ('analytics.export'),
  ('access.users.disable'),
  ('access.audit.read'),
  ('sources.read'),
  ('sources.review_import'),
  ('sources.publish_snapshot');

-- Record the removed definitions before deleting them from the live catalog.
INSERT INTO "RetiredPermissionRecordArchive" (
  "sourceTable", "sourceId", "permissionCode", "recordSnapshot", "archivedAt", "retirementReason"
)
SELECT
  'Permission', permission."code", permission."code", to_jsonb(permission), CURRENT_TIMESTAMP,
  'Permission removed from the active catalog; definition archived by migration.'
FROM "Permission" AS permission
JOIN "_retiredPermissionCodes" AS retired ON retired."code" = permission."code";

-- Revoke effective legacy grants before archiving them, then remove their live rows.
UPDATE "UserPermissionGrant" AS grant_row
SET "revokedAt" = CURRENT_TIMESTAMP,
    "revokedByUserId" = NULL
FROM "_retiredPermissionCodes" AS retired
WHERE grant_row."permissionCode" = retired."code"
  AND grant_row."revokedAt" IS NULL
  AND (grant_row."expiresAt" IS NULL OR grant_row."expiresAt" > CURRENT_TIMESTAMP);

INSERT INTO "RetiredPermissionRecordArchive" (
  "sourceTable", "sourceId", "permissionCode", "recordSnapshot", "archivedAt", "retirementReason"
)
SELECT
  'UserPermissionGrant', grant_row."id", grant_row."permissionCode", to_jsonb(grant_row), CURRENT_TIMESTAMP,
  'Retired permission grant revoked if effective, then archived and removed from the live grant table.'
FROM "UserPermissionGrant" AS grant_row
JOIN "_retiredPermissionCodes" AS retired ON retired."code" = grant_row."permissionCode";

-- Preserve invite history, but strip retired codes from all live invite snapshots so they cannot
-- be redeemed into permissions that no longer exist in the catalog.
INSERT INTO "RetiredPermissionRecordArchive" (
  "sourceTable", "sourceId", "permissionCode", "recordSnapshot", "archivedAt", "retirementReason"
)
SELECT DISTINCT
  'RegistrationInvite', invite."id", retired."code", to_jsonb(invite), CURRENT_TIMESTAMP,
  'Retired permission removed from the live invitation snapshot; original invite archived.'
FROM "RegistrationInvite" AS invite
CROSS JOIN LATERAL unnest(invite."permissionCodes") AS invite_code("code")
JOIN "_retiredPermissionCodes" AS retired ON retired."code" = invite_code."code";

UPDATE "RegistrationInvite" AS invite
SET "permissionCodes" = ARRAY(
  SELECT invite_code."code"
  FROM unnest(invite."permissionCodes") WITH ORDINALITY AS invite_code("code", "ordinal")
  WHERE NOT EXISTS (
    SELECT 1 FROM "_retiredPermissionCodes" AS retired WHERE retired."code" = invite_code."code"
  )
  ORDER BY invite_code."ordinal"
)
WHERE invite."permissionCodes" && ARRAY(SELECT "code" FROM "_retiredPermissionCodes");

DELETE FROM "UserPermissionGrant" AS grant_row
USING "_retiredPermissionCodes" AS retired
WHERE grant_row."permissionCode" = retired."code";

DELETE FROM "Permission" AS permission
USING "_retiredPermissionCodes" AS retired
WHERE permission."code" = retired."code";

INSERT INTO "AuthorizationAuditEvent" (
  "id", "action", "resourceType", "reason", "metadata", "createdAt"
)
VALUES (
  gen_random_uuid()::TEXT,
  'permission.retired_catalog_purged',
  'permission_catalog',
  'Retired permission grants were revoked when effective, archived, and purged from live permission, grant, and invite records.',
  jsonb_build_object(
    'permissionCodes', (SELECT jsonb_agg("code" ORDER BY "code") FROM "_retiredPermissionCodes"),
    'archivedDefinitions', (SELECT count(*) FROM "RetiredPermissionRecordArchive" WHERE "sourceTable" = 'Permission'),
    'archivedGrants', (SELECT count(*) FROM "RetiredPermissionRecordArchive" WHERE "sourceTable" = 'UserPermissionGrant'),
    'archivedInviteReferences', (SELECT count(*) FROM "RetiredPermissionRecordArchive" WHERE "sourceTable" = 'RegistrationInvite')
  ),
  CURRENT_TIMESTAMP
);

COMMIT;
