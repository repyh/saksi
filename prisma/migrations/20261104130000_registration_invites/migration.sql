CREATE TABLE "RegistrationInvite" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "redeemedByUserId" TEXT,
  "revokedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "redeemedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "RegistrationInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RegistrationInvite_tokenHash_key" ON "RegistrationInvite"("tokenHash");
CREATE INDEX "RegistrationInvite_email_expiresAt_idx" ON "RegistrationInvite"("email", "expiresAt");
CREATE INDEX "RegistrationInvite_createdByUserId_createdAt_idx" ON "RegistrationInvite"("createdByUserId", "createdAt");
CREATE INDEX "RegistrationInvite_redeemedByUserId_idx" ON "RegistrationInvite"("redeemedByUserId");
CREATE INDEX "RegistrationInvite_revokedByUserId_idx" ON "RegistrationInvite"("revokedByUserId");

ALTER TABLE "RegistrationInvite" ADD CONSTRAINT "RegistrationInvite_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegistrationInvite" ADD CONSTRAINT "RegistrationInvite_redeemedByUserId_fkey"
  FOREIGN KEY ("redeemedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RegistrationInvite" ADD CONSTRAINT "RegistrationInvite_revokedByUserId_fkey"
  FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
