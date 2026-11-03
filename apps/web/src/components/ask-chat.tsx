"use client";
import { useRef, useState } from "react";
import { ASSISTANT_NAME } from "@/lib/sections";

type Source = { id: string; ref: string; page?: number; excerpt: string };
type Msg = { role: "user" | "assistant"; content: string; sources?: Source[]; pending?: boolean; error?: string; model?: string };
const SUGGEST = ["When is the AP licence renewal fee due?", "What does the annual return ask about office space?", "Which visas are available for Port City employees?", "What can a company do with Sri Lankan rupee payments?", "What must every Authorised Person do about tax returns?", "What happened to designated locations outside Port City?"];

export function AskChat() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Source | null>(null);
  const ctl = useRef<AbortController | null>(null);
  const conv = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const patch = (fn: (m: Msg) => Msg) => setMsgs((a) => a.map((m, i) => (i === a.length - 1 ? fn(m) : m)));

  async function ask(question: string) {
    question = question.trim();
    if (!question || busy) return;
    setQ(""); setBusy(true);
    setMsgs((a) => [...a, { role: "user", content: question }, { role: "assistant", content: "", pending: true }]);
    ctl.current = new AbortController();
    try {
      const r = await fetch("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, conversation_id: conv.current }), signal: ctl.current.signal });
      if (!r.ok || !r.body) throw new Error((await r.json().catch(() => null))?.error ?? "The assistant isn't available right now.");
      const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const p of parts) {
          const ev = /^event: (.*)$/m.exec(p)?.[1], raw = /^data: (.*)$/m.exec(p)?.[1];
          if (!ev || !raw) continue;
          const d = JSON.parse(raw);
          if (ev === "start") conv.current = d.conversation_id;
          if (ev === "sources") patch((m) => ({ ...m, sources: d.sources }));
          if (ev === "delta") patch((m) => ({ ...m, content: m.content + d.text }));
          if (ev === "done") patch((m) => ({ ...m, model: d.model ?? undefined }));
          if (ev === "error") patch((m) => ({ ...m, error: d.message }));
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") patch((m) => ({ ...m, error: (e as Error).message }));
    } finally {
      patch((m) => ({ ...m, pending: false }));
      setBusy(false);
    }
  }

  return (
    <div className="chatwrap">
      <div className="chat" aria-live="polite">
        {!msgs.length && (
          <div className="chat-empty">
            <h3>Ask about Port City rules</h3>
            <p className="muted">Answers come only from the documents in the library, with the source shown for each point. They are a starting point, not legal advice.</p>
            <div className="sugg">{SUGGEST.map((s) => <button key={s} type="button" className="chip-btn" onClick={() => ask(s)}>{s}</button>)}</div>
          </div>
        )}
        {msgs.map((m, i) => m.role === "user" ? <div key={i} className="msg me">{m.content}</div> : (
          <div key={i} className={`msg ai${m.error ? " err" : ""}`}>
            {m.pending && !m.content ? <span className="typing">Looking through the documents…</span> : <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>}
            {m.error && <div className="help">{m.error}{m.sources?.length ? " The passages found are listed below, so you can read them directly." : ""}</div>}
            {!!m.sources?.length && !m.pending && <div className="srcs"><span className="small muted">Sources:</span>{m.sources.map((s) => <button key={s.id} type="button" className="cite" onClick={() => setOpen(s)}>{s.id} · {s.ref}</button>)}</div>}
          </div>
        ))}
      </div>
      {open && <div className="card" role="dialog" aria-label={open.ref}><h3>{open.ref}</h3><p style={{ whiteSpace: "pre-wrap" }}>{open.excerpt}…</p><div className="row"><button type="button" className="btn sm" onClick={() => setOpen(null)}>Close</button></div></div>}
      <form className="askbar" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
        <textarea rows={2} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask a question, e.g. How long is an AP licence valid?" aria-label="Your question" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(q); } }} />
        <div className="row" style={{ margin: 0 }}>
          {busy ? <button type="button" className="btn bad" onClick={() => ctl.current?.abort()}>Stop</button> : <button className="btn p">Ask</button>}
          {!!msgs.length && !busy && <button type="button" className="btn" onClick={() => { setMsgs([]); conv.current = null; }}>New conversation</button>}
        </div>
      </form>
      <p className="small muted">{ASSISTANT_NAME} can make mistakes, and documents may have been amended since they were added. Check important points against the source and with the Commission.</p>
    </div>
  );
}
