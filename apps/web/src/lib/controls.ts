import { db } from "@/lib/db";

/** On unless an organization's administrator turned it off, which is meant for one-person teams and is audited. */
export async function secondPersonRequired(organizationId: string) {
  const o = await db.organization.findUnique({ where: { id: organizationId }, select: { settings: true } });
  return (o?.settings as { separateReviewer?: boolean } | null)?.separateReviewer !== false;
}
export function assertDifferentPerson(required: boolean, preparedBy: string | null | undefined, userId: string, what: string) {
  if (required && preparedBy && preparedBy === userId) throw new Error(`A different person must ${what}. You prepared or last changed it. An administrator can turn this control off in Admin > Controls for a one-person team.`);
}
