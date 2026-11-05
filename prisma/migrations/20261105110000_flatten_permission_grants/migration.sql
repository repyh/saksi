-- Permission packages are source-controlled presets. Persist their expanded
-- permission grants, then remove package-backed storage.
BEGIN;

-- Seed the new delegation bit before FK-backed grant rows reference it.
INSERT INTO "Permission" ("code", "description", "sensitive")
VALUES (
  'access.presets.apply',
  'Apply approved permission presets to individual grants',
  true
)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "Permission" ("code", "description", "sensitive")
VALUES (
  'access.permissions.assign',
  'Grant or revoke approved individual permissions',
  true
)
ON CONFLICT ("code") DO NOTHING;

-- Rename the legacy authority bit in existing direct grants before dropping
-- its catalog row. It now means applying a source-controlled preset.
UPDATE "UserPermissionGrant"
SET "permissionCode" = 'access.presets.apply'
WHERE "permissionCode" = 'access.bundles.assign';

ALTER TABLE "UserPermissionGrant"
  ADD COLUMN "grantBatchId" TEXT;
CREATE INDEX "UserPermissionGrant_grantBatchId_idx"
  ON "UserPermissionGrant"("grantBatchId");

ALTER TABLE "RegistrationInvite"
  ADD COLUMN "permissionCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "RegistrationInvite" AS invite
SET "permissionCodes" = array_replace(COALESCE(
  (
    SELECT array_agg(DISTINCT expanded."permissionCode" ORDER BY expanded."permissionCode")
    FROM (
      SELECT unnest(invite."directPermissionCodes") AS "permissionCode"
      UNION
      SELECT mapping."permissionCode"
      FROM "PermissionBundlePermission" AS mapping
      JOIN "PermissionBundle" AS bundle ON bundle."id" = mapping."bundleId"
      WHERE bundle."code" = invite."permissionBundleCode"
        AND bundle."isActive" = true
    ) AS expanded
  ),
  ARRAY[]::TEXT[]
), 'access.bundles.assign', 'access.presets.apply');

-- Do not let an invite redeem against a package that was deactivated after it
-- was issued. This preserves the old package trigger's rejection behavior.
UPDATE "RegistrationInvite" AS invite
SET "revokedAt" = CURRENT_TIMESTAMP
FROM "PermissionBundle" AS bundle
WHERE invite."permissionBundleCode" = bundle."code"
  AND bundle."isActive" = false
  AND invite."redeemedAt" IS NULL
  AND invite."revokedAt" IS NULL;

-- Expand every historical bundle grant into one auditable row per permission.
-- Grants from inactive bundles are retained as revoked so they cannot regain
-- access after the bundle tables are removed.
WITH expanded_grants AS (
  SELECT
    grant_row."id" AS "sourceGrantId",
    grant_row."bundleId",
    grant_row."userId",
    mapping."permissionCode",
    grant_row."grantedByUserId",
    grant_row."grantedAt",
    grant_row."expiresAt",
    CASE
      WHEN bundle."isActive" THEN grant_row."revokedAt"
      ELSE COALESCE(grant_row."revokedAt", CURRENT_TIMESTAMP)
    END AS "revokedAt",
    grant_row."revokedByUserId",
    grant_row."reason",
    bundle."code" AS "bundleCode",
    bundle."isActive"
  FROM "UserBundleGrant" AS grant_row
  JOIN "PermissionBundle" AS bundle ON bundle."id" = grant_row."bundleId"
  JOIN "PermissionBundlePermission" AS mapping ON mapping."bundleId" = bundle."id"
), permission_grants AS (
  SELECT
    gen_random_uuid()::TEXT AS "grantId",
    expanded."sourceGrantId",
    expanded."bundleId",
    expanded."sourceGrantId" AS "grantBatchId",
    expanded."userId",
    CASE expanded."permissionCode"
      WHEN 'access.bundles.assign' THEN 'access.presets.apply'
      ELSE expanded."permissionCode"
    END AS "permissionCode",
    expanded."grantedByUserId",
    expanded."grantedAt",
    expanded."expiresAt",
    expanded."revokedAt",
    expanded."revokedByUserId",
    expanded."reason",
    expanded."bundleCode",
    expanded."isActive" AS "bundleWasActive",
    NULL::TEXT AS "mappedFromPermission"
  FROM expanded_grants AS expanded

  UNION ALL

  SELECT
    gen_random_uuid()::TEXT AS "grantId",
    expanded."sourceGrantId",
    expanded."bundleId",
    expanded."sourceGrantId" AS "grantBatchId",
    expanded."userId",
    'access.permissions.assign' AS "permissionCode",
    expanded."grantedByUserId",
    expanded."grantedAt",
    expanded."expiresAt",
    expanded."revokedAt",
    expanded."revokedByUserId",
    expanded."reason",
    expanded."bundleCode",
    expanded."isActive" AS "bundleWasActive",
    'access.bundles.assign'::TEXT AS "mappedFromPermission"
  FROM expanded_grants AS expanded
  WHERE expanded."permissionCode" = 'access.bundles.assign'
    AND expanded."isActive" = true
    AND expanded."revokedAt" IS NULL
    AND (expanded."expiresAt" IS NULL OR expanded."expiresAt" > CURRENT_TIMESTAMP)
    AND NOT EXISTS (
      SELECT 1
      FROM "PermissionBundlePermission" AS existing_mapping
      WHERE existing_mapping."bundleId" = expanded."bundleId"
        AND existing_mapping."permissionCode" = 'access.permissions.assign'
    )
), inserted_grants AS (
  INSERT INTO "UserPermissionGrant" (
    "id", "userId", "permissionCode", "grantedByUserId", "grantedAt",
    "grantBatchId", "expiresAt", "revokedAt", "revokedByUserId", "reason"
  )
  SELECT
    "grantId",
    "userId",
    "permissionCode",
    "grantedByUserId",
    "grantedAt",
    "grantBatchId",
    "expiresAt",
    "revokedAt",
    "revokedByUserId",
    "reason"
  FROM permission_grants
  RETURNING "id", "userId", "permissionCode", "grantedByUserId", "grantedAt", "reason"
)
INSERT INTO "AuthorizationAuditEvent" (
  "id", "actorUserId", "subjectUserId", "action", "resourceType", "resourceId", "reason", "metadata", "createdAt"
)
SELECT
  gen_random_uuid()::TEXT,
  inserted."grantedByUserId",
  inserted."userId",
  'permission.grant_migrated',
  'permission',
  inserted."permissionCode",
  inserted."reason",
  jsonb_build_object(
    'source', 'permission_bundle_migration',
    'sourceGrantId', expanded."sourceGrantId",
    'bundleCode', expanded."bundleCode",
    'bundleWasActive', expanded."bundleWasActive",
    'mappedFromPermission', expanded."mappedFromPermission"
  ),
  inserted."grantedAt"
FROM inserted_grants AS inserted
JOIN permission_grants AS expanded
  ON expanded."grantId" = inserted."id";

-- The invite redemption hook now reads the flattened permission list.
CREATE OR REPLACE FUNCTION "apply_registration_invite_access"()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  redeemed_invite public."RegistrationInvite"%ROWTYPE;
  selected_permission public."Permission"%ROWTYPE;
  permission_code TEXT;
  grant_reason TEXT;
  grant_batch_id TEXT := gen_random_uuid()::TEXT;
BEGIN
  SELECT * INTO redeemed_invite
  FROM public."RegistrationInvite"
  WHERE "redeemedByUserId" = NEW."id"
    AND lower("email") = lower(NEW."email")
    AND "redeemedAt" IS NOT NULL
    AND "revokedAt" IS NULL
    AND "expiresAt" > CURRENT_TIMESTAMP
  ORDER BY "redeemedAt" DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  grant_reason := COALESCE(NULLIF(btrim(redeemed_invite."permissionGrantReason"), ''), 'Access assigned through registration invite.');

  INSERT INTO public."AuthorizationAuditEvent" (
    "id", "actorUserId", "subjectUserId", "action", "resourceType", "resourceId", "reason", "metadata"
  ) VALUES (
    gen_random_uuid()::TEXT,
    redeemed_invite."createdByUserId",
    NEW."id",
    'registration_invite.redeemed',
    'registration_invite',
    redeemed_invite."id",
    redeemed_invite."permissionGrantReason",
    jsonb_build_object('permissionCodes', redeemed_invite."permissionCodes")
  );

  FOREACH permission_code IN ARRAY redeemed_invite."permissionCodes" LOOP
    SELECT * INTO selected_permission
    FROM public."Permission"
    WHERE "code" = permission_code;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'A permission attached to this invite is unavailable';
    END IF;

    INSERT INTO public."UserPermissionGrant" (
      "id", "userId", "permissionCode", "grantedByUserId", "grantBatchId", "reason"
    ) VALUES (
      gen_random_uuid()::TEXT,
      NEW."id",
      selected_permission."code",
      redeemed_invite."createdByUserId",
      grant_batch_id,
      grant_reason
    );

    INSERT INTO public."AuthorizationAuditEvent" (
      "id", "actorUserId", "subjectUserId", "action", "resourceType", "resourceId", "reason", "metadata"
    ) VALUES (
      gen_random_uuid()::TEXT,
      redeemed_invite."createdByUserId",
      NEW."id",
      'permission.granted',
      'permission',
      selected_permission."code",
      grant_reason,
      jsonb_build_object(
        'permissionCode', selected_permission."code",
        'source', 'registration_invite',
        'inviteId', redeemed_invite."id"
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Allow Better Auth to claim the invite with the pre-generated user ID inside
-- the same transaction that inserts the User, then let this trigger run.
ALTER TABLE "RegistrationInvite"
  DROP CONSTRAINT "RegistrationInvite_redeemedByUserId_fkey",
  ADD CONSTRAINT "RegistrationInvite_redeemedByUserId_fkey"
    FOREIGN KEY ("redeemedByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;

DROP INDEX "RegistrationInvite_permissionBundleCode_idx";
ALTER TABLE "RegistrationInvite"
  DROP CONSTRAINT "RegistrationInvite_singleAccessSelection_check",
  DROP CONSTRAINT "RegistrationInvite_permissionBundleCode_fkey",
  DROP COLUMN "permissionBundleCode",
  DROP COLUMN "directPermissionCodes";

DROP TABLE "UserBundleGrant";
DROP TABLE "PermissionBundlePermission";
DROP TABLE "PermissionBundle";

DELETE FROM "Permission" WHERE "code" = 'access.bundles.assign';

COMMIT;
