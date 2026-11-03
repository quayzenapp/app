import type { Tx } from "@/lib/db";
import { parseDateFormats } from "@/lib/lic/date-formats";

/** The caller is inside withTenant, using the organization from getTenantContext. */
export async function loadDateFormats(tx: Tx, organizationId: string) {
  const org = await tx.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { settings: true } });
  const settings = org.settings as { officialDateFormats?: unknown };
  return parseDateFormats(settings.officialDateFormats);
}
/** Atomic JSON-key updates preserve unrelated controls under concurrent saves. */
export async function setOrgControl(tx: Tx, organizationId: string, key: "officialDateFormats" | "separateReviewer", value: unknown) {
  await tx.$executeRaw`UPDATE organizations SET settings = jsonb_set(settings, ARRAY[${key}]::text[], ${JSON.stringify(value)}::jsonb, true), "updatedAt" = now() WHERE id = ${organizationId}`;
}
