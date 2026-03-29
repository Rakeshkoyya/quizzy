import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function buildDatabaseUrl() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url || url.includes("pgbouncer=true")) return url;
  return url.includes("?") ? `${url}&pgbouncer=true` : `${url}?pgbouncer=true`;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: {
      db: {
        url: buildDatabaseUrl(),
      },
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
