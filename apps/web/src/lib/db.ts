import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";

const g = globalThis as unknown as { qzDb?: PrismaClient };

/** Connects as the restricted quayzen_app role. Tenant tables return nothing unless used through withTenant. */
export const db =
  g.qzDb ?? new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
if (process.env.NODE_ENV !== "production") g.qzDb = db;

export type Tx = Prisma.TransactionClient;

/** Runs fn in a transaction where row level security only exposes this organization's rows. */
export function withTenant<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!organizationId) throw new Error("withTenant requires an organization");
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.org_id', ${organizationId}, true)`;
    return fn(tx);
  });
}

export async function audit(
  tx: Tx,
  e: { organizationId: string; actorId?: string; actorEmail?: string; action: string; entityType: string; entityId?: string; summary?: string; before?: unknown; after?: unknown },
) {
  await tx.auditLog.create({
    data: {
      organizationId: e.organizationId,
      actorId: e.actorId,
      actorEmail: e.actorEmail,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId,
      summary: e.summary,
      before: e.before === undefined ? undefined : (e.before as Prisma.InputJsonValue),
      after: e.after === undefined ? undefined : (e.after as Prisma.InputJsonValue),
    },
  });
}
