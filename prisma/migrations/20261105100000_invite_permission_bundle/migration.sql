ALTER TABLE "RegistrationInvite"
  ADD COLUMN "permissionBundleCode" TEXT,
  ADD COLUMN "directPermissionCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "permissionGrantReason" TEXT;

CREATE INDEX "RegistrationInvite_permissionBundleCode_idx"
  ON "RegistrationInvite"("permissionBundleCode");

ALTER TABLE "RegistrationInvite"
  ADD CONSTRAINT "RegistrationInvite_permissionBundleCode_fkey"
  FOREIGN KEY ("permissionBundleCode") REFERENCES "PermissionBundle"("code")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RegistrationInvite"
  ADD CONSTRAINT "RegistrationInvite_singleAccessSelection_check"
  CHECK ("permissionBundleCode" IS NULL OR cardinality("directPermissionCodes") = 0);

CREATE TABLE "UserPermissionGrant" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "permissionCode" TEXT NOT NULL,
  "grantedByUserId" TEXT NOT NULL,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "revokedByUserId" TEXT,
  "reason" TEXT NOT NULL,
  CONSTRAINT "UserPermissionGrant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserPermissionGrant_userId_revokedAt_expiresAt_idx"
  ON "UserPermissionGrant"("userId", "revokedAt", "expiresAt");
CREATE INDEX "UserPermissionGrant_permissionCode_revokedAt_idx"
  ON "UserPermissionGrant"("permissionCode", "revokedAt");
CREATE INDEX "UserPermissionGrant_grantedByUserId_idx"
  ON "UserPermissionGrant"("grantedByUserId");

ALTER TABLE "UserPermissionGrant"
  ADD CONSTRAINT "UserPermissionGrant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "UserPermissionGrant_permissionCode_fkey"
  FOREIGN KEY ("permissionCode") REFERENCES "Permission"("code") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "UserPermissionGrant_grantedByUserId_fkey"
  FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "UserPermissionGrant_revokedByUserId_fkey"
  FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "apply_registration_invite_access"()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  redeemed_invite "RegistrationInvite"%ROWTYPE;
  selected_bundle "PermissionBundle"%ROWTYPE;
  selected_permission "Permission"%ROWTYPE;
  permission_code TEXT;
  grant_reason TEXT;
BEGIN
  SELECT * INTO redeemed_invite
  FROM "RegistrationInvite"
  WHERE "redeemedByUserId" = NEW."id"
    AND lower("email") = lower(NEW."email")
  ORDER BY "redeemedAt" DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  INSERT INTO "AuthorizationAuditEvent" (
    "id", "actorUserId", "subjectUserId", "action", "resourceType", "resourceId", "reason", "metadata"
  ) VALUES (
    gen_random_uuid()::TEXT,
    redeemed_invite."createdByUserId",
    NEW."id",
    'registration_invite.redeemed',
    'registration_invite',
    redeemed_invite."id",
    redeemed_invite."permissionGrantReason",
    jsonb_build_object(
      'permissionBundleCode', redeemed_invite."permissionBundleCode",
      'directPermissionCodes', redeemed_invite."directPermissionCodes"
    )
  );

  grant_reason := COALESCE(NULLIF(btrim(redeemed_invite."permissionGrantReason"), ''), 'Access assigned through registration invite.');

  IF redeemed_invite."permissionBundleCode" IS NOT NULL THEN
    SELECT * INTO selected_bundle
    FROM "PermissionBundle"
    WHERE "code" = redeemed_invite."permissionBundleCode"
      AND "isActive" = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'The permission bundle attached to this invite is no longer active';
    END IF;

    INSERT INTO "UserBundleGrant" (
      "id", "userId", "bundleId", "grantedByUserId", "reason"
    ) VALUES (
      gen_random_uuid()::TEXT,
      NEW."id",
      selected_bundle."id",
      redeemed_invite."createdByUserId",
      grant_reason
    );

    INSERT INTO "AuthorizationAuditEvent" (
      "id", "actorUserId", "subjectUserId", "action", "resourceType", "resourceId", "reason", "metadata"
    ) VALUES (
      gen_random_uuid()::TEXT,
      redeemed_invite."createdByUserId",
      NEW."id",
      'bundle.granted',
      'permission_bundle',
      selected_bundle."id",
      grant_reason,
      jsonb_build_object(
        'bundleCode', selected_bundle."code",
        'source', 'registration_invite',
        'inviteId', redeemed_invite."id"
      )
    );
  END IF;

  FOREACH permission_code IN ARRAY redeemed_invite."directPermissionCodes" LOOP
    SELECT * INTO selected_permission
    FROM "Permission"
    WHERE "code" = permission_code;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'An individual permission attached to this invite is unavailable';
    END IF;

    INSERT INTO "UserPermissionGrant" (
      "id", "userId", "permissionCode", "grantedByUserId", "reason"
    ) VALUES (
      gen_random_uuid()::TEXT,
      NEW."id",
      selected_permission."code",
      redeemed_invite."createdByUserId",
      grant_reason
    );

    INSERT INTO "AuthorizationAuditEvent" (
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

CREATE TRIGGER "User_applyRegistrationInviteAccess"
AFTER INSERT ON "User"
FOR EACH ROW
EXECUTE FUNCTION "apply_registration_invite_access"();
