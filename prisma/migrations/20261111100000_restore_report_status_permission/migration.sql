BEGIN;

INSERT INTO "Permission" ("code", "description", "sensitive")
VALUES (
  'reports.change_status',
  'Publish or reject reports with a required moderation reason',
  TRUE
)
ON CONFLICT ("code") DO UPDATE
SET "description" = EXCLUDED."description",
    "sensitive" = EXCLUDED."sensitive";

-- Restore only grants that were active when the retirement migration revoked them.
-- Previously revoked grants have a different revokedAt timestamp and stay revoked.
INSERT INTO "UserPermissionGrant" (
  "id", "userId", "permissionCode", "grantedByUserId", "grantedAt", "grantBatchId",
  "expiresAt", "revokedAt", "revokedByUserId", "reason"
)
SELECT
  archive."sourceId",
  archive."recordSnapshot"->>'userId',
  'reports.change_status',
  archive."recordSnapshot"->>'grantedByUserId',
  (archive."recordSnapshot"->>'grantedAt')::TIMESTAMP(3),
  archive."recordSnapshot"->>'grantBatchId',
  (archive."recordSnapshot"->>'expiresAt')::TIMESTAMP(3),
  NULL,
  NULL,
  archive."recordSnapshot"->>'reason'
FROM "RetiredPermissionRecordArchive" AS archive
WHERE archive."sourceTable" = 'UserPermissionGrant'
  AND archive."permissionCode" = 'reports.change_status'
  AND archive."recordSnapshot"->>'revokedByUserId' IS NULL
  AND archive."recordSnapshot"->>'revokedAt' IS NOT NULL
  AND ABS(EXTRACT(EPOCH FROM (
    (archive."recordSnapshot"->>'revokedAt')::TIMESTAMP - archive."archivedAt"
  ))) < 1
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "AuthorizationAuditEvent" (
  "id", "action", "resourceType", "resourceId", "reason", "metadata", "createdAt"
)
VALUES (
  gen_random_uuid()::TEXT,
  'permission.catalog_restored',
  'permission_catalog',
  'reports.change_status',
  'Restored report moderation status permission and grants that were active when the permission was retired.',
  jsonb_build_object(
    'permissionCode', 'reports.change_status',
    'restoredActiveGrantCount', (
      SELECT count(*)
      FROM "RetiredPermissionRecordArchive" AS archive
      WHERE archive."sourceTable" = 'UserPermissionGrant'
        AND archive."permissionCode" = 'reports.change_status'
        AND archive."recordSnapshot"->>'revokedByUserId' IS NULL
        AND archive."recordSnapshot"->>'revokedAt' IS NOT NULL
        AND ABS(EXTRACT(EPOCH FROM (
          (archive."recordSnapshot"->>'revokedAt')::TIMESTAMP - archive."archivedAt"
        ))) < 1
    )
  ),
  CURRENT_TIMESTAMP
);

COMMIT;
