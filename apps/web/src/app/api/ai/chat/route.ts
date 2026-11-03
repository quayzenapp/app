import { NextResponse } from "next/server";
import { aiFetch } from "@/lib/ai";
import { getCurrentUser, getTenantContext } from "@/lib/tenant";

export async function POST(req: Request) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const ctx = await getTenantContext();
  const body = await req.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim().slice(0, 4000) : "";
  if (!question) return NextResponse.json({ error: "Please enter a question." }, { status: 400 });
  const conversation_id = typeof body?.conversation_id === "string" ? body.conversation_id : null;
  let r: Response;
  try {
    r = await aiFetch(ctx, "/v1/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, conversation_id }), signal: req.signal });
  } catch {
    return NextResponse.json({ error: "The assistant isn't available right now." }, { status: 503 });
  }
  if (!r.ok || !r.body) return NextResponse.json({ error: "The assistant couldn't answer." }, { status: 502 });
  return new Response(r.body, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" } });
}
