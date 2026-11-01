-- Install PostGIS in Supabase's dedicated extensions schema.
-- If PostGIS is already enabled in this schema, this migration is a no-op.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
