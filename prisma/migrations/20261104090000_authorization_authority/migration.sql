CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  "image" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Session" (
  "id" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "token" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Account" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" TIMESTAMP(3),
  "refreshTokenExpiresAt" TIMESTAMP(3),
  "scope" TEXT,
  "password" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Verification" (
  "id" TEXT NOT NULL,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "Session_token_key" ON "Session"("token");
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");
CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON "Account"("userId");
CREATE INDEX IF NOT EXISTS "Verification_identifier_idx" ON "Verification"("identifier");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Session_userId_fkey') THEN
    ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Account_userId_fkey') THEN
    ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE "Permission" (
  "code" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "sensitive" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Permission_pkey" PRIMARY KEY ("code")
);

CREATE TABLE "PermissionBundle" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "isSystem" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PermissionBundle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PermissionBundlePermission" (
  "bundleId" TEXT NOT NULL,
  "permissionCode" TEXT NOT NULL,
  CONSTRAINT "PermissionBundlePermission_pkey" PRIMARY KEY ("bundleId", "permissionCode")
);

CREATE TABLE "UserBundleGrant" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "bundleId" TEXT NOT NULL,
  "grantedByUserId" TEXT NOT NULL,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "revokedByUserId" TEXT,
  "reason" TEXT NOT NULL,
  CONSTRAINT "UserBundleGrant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthorizationAuditEvent" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT,
  "subjectUserId" TEXT,
  "action" TEXT NOT NULL,
  "resourceType" TEXT,
  "resourceId" TEXT,
  "reason" TEXT,
  "requestId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthorizationAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PermissionBundle_code_key" ON "PermissionBundle"("code");
CREATE INDEX "PermissionBundle_isActive_idx" ON "PermissionBundle"("isActive");
CREATE INDEX "PermissionBundlePermission_permissionCode_idx" ON "PermissionBundlePermission"("permissionCode");
CREATE INDEX "UserBundleGrant_userId_revokedAt_expiresAt_idx" ON "UserBundleGrant"("userId", "revokedAt", "expiresAt");
CREATE INDEX "UserBundleGrant_bundleId_revokedAt_idx" ON "UserBundleGrant"("bundleId", "revokedAt");
CREATE INDEX "UserBundleGrant_grantedByUserId_idx" ON "UserBundleGrant"("grantedByUserId");
CREATE INDEX "AuthorizationAuditEvent_actorUserId_createdAt_idx" ON "AuthorizationAuditEvent"("actorUserId", "createdAt");
CREATE INDEX "AuthorizationAuditEvent_subjectUserId_createdAt_idx" ON "AuthorizationAuditEvent"("subjectUserId", "createdAt");
CREATE INDEX "AuthorizationAuditEvent_resourceType_resourceId_createdAt_idx" ON "AuthorizationAuditEvent"("resourceType", "resourceId", "createdAt");
CREATE INDEX "AuthorizationAuditEvent_action_createdAt_idx" ON "AuthorizationAuditEvent"("action", "createdAt");

ALTER TABLE "PermissionBundlePermission"
  ADD CONSTRAINT "PermissionBundlePermission_bundleId_fkey"
  FOREIGN KEY ("bundleId") REFERENCES "PermissionBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PermissionBundlePermission"
  ADD CONSTRAINT "PermissionBundlePermission_permissionCode_fkey"
  FOREIGN KEY ("permissionCode") REFERENCES "Permission"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserBundleGrant"
  ADD CONSTRAINT "UserBundleGrant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserBundleGrant"
  ADD CONSTRAINT "UserBundleGrant_bundleId_fkey"
  FOREIGN KEY ("bundleId") REFERENCES "PermissionBundle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserBundleGrant"
  ADD CONSTRAINT "UserBundleGrant_grantedByUserId_fkey"
  FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserBundleGrant"
  ADD CONSTRAINT "UserBundleGrant_revokedByUserId_fkey"
  FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuthorizationAuditEvent"
  ADD CONSTRAINT "AuthorizationAuditEvent_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuthorizationAuditEvent"
  ADD CONSTRAINT "AuthorizationAuditEvent_subjectUserId_fkey"
  FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
