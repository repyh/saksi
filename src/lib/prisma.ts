import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function buatKlien(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL belum diset. Fitur database (autentikasi, simpan laporan) belum aktif; " +
        "data paket jalan tetap tersedia dari snapshot.",
    );
  }

  const poolMax = Number(process.env.DATABASE_POOL_MAX ?? "5");
  if (!Number.isSafeInteger(poolMax) || poolMax < 1) {
    throw new Error("DATABASE_POOL_MAX must be a positive integer.");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl, max: poolMax }),
  });
}

function ambilKlien(): PrismaClient {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = buatKlien();
  return globalForPrisma.prisma;
}

/**
 * Klien Prisma yang baru dibuat saat pertama kali dipakai, bukan saat modul diimpor.
 * Dengan begitu `next build` dan `prisma generate` tidak menuntut DATABASE_URL.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, properti) {
    const klien = ambilKlien();
    const nilai = Reflect.get(klien, properti, klien);
    return typeof nilai === "function" ? nilai.bind(klien) : nilai;
  },
  has(_target, properti) {
    return properti in ambilKlien();
  },
});
