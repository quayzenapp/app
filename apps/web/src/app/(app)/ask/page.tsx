import { AskChat } from "@/components/ask-chat";
import { getTenantContext } from "@/lib/tenant";

export default async function AskPage() {
  await getTenantContext();
  return <AskChat />;
}
