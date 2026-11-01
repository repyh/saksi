import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

dotenv.config({ path: [".env.local", ".env"] });

// Database hanya wajib untuk perintah `db:*` (migrate/status). `prisma generate` dan
// `next build` harus tetap jalan tanpa DATABASE_URL supaya repo bisa dibangun di mesin
// bersih sebelum Postgres disiapkan.
const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
});
