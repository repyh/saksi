-- Account deletion must not be blocked by grant rows the account revoked earlier.
-- Grants received by the deleted account are removed (ON DELETE CASCADE); grants they
-- issued or revoked stay with the account link cleared so the history survives.
BEGIN;

ALTER TABLE "UserPermissionGrant"
  DROP CONSTRAINT "UserPermissionGrant_revokedByUserId_fkey",
  ADD CONSTRAINT "UserPermissionGrant_revokedByUserId_fkey"
    FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
