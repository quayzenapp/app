import { ActionForm, ConfirmButton } from "@/components/admin-ui";
import { aiFetch } from "@/lib/ai";
import { requirePlatformAdmin } from "@/lib/tenant";
import { addModel, modelAction, reindexAll, saveProvider, testModel } from "../actions";

type M = { id: string; provider: string; model_id: string; label: string; purpose: string; is_default: boolean; enabled: boolean; fallback_order: number | null; dimensions: number | null };
type Data = { models: M[]; providers: Record<string, { has_secret: boolean; config: { region?: string } }>; chunks_needing_embedding: number };
type Free = { chat: { id: string; context: number | null }[]; embedding: { id: string }[] };

export default async function AiModels() {
  const ctx = await requirePlatformAdmin();
  let data: Data | null = null, free: Free | null = null;
  try {
    const [a, b] = await Promise.all([aiFetch(ctx, "/v1/models"), aiFetch(ctx, "/v1/providers/openrouter/free-models")]);
    if (a.ok) data = await a.json();
    if (b.ok) free = await b.json();
  } catch {}
  if (!data) return <div className="card"><p className="muted">The AI service isn't reachable right now.</p></div>;
  const op = (id: string, o: "default" | "enable" | "disable" | "delete", label: string) => <form action={modelAction.bind(null, id, o)}><button className="btn sm">{label}</button></form>;
  return (
    <>
      <div className="head"><div className="t"><h1>AI models</h1><p className="muted">Choose which models answer questions and read documents. See docs/AI-ARCHITECTURE.md for guidance.</p></div></div>
      <div className="banner warn"><b>Privacy:</b> free OpenRouter models may log what they receive, and passages from your documents are sent with each question. Use a paid, no-logging route or Bedrock before asking about confidential documents.</div>
      {data.chunks_needing_embedding > 0 && <div className="banner info">{data.chunks_needing_embedding} passages don't have vectors from the current embedding model yet.</div>}
      <div className="cols">
        <div className="card"><h3>OpenRouter</h3>
          <p className="small muted">{data.providers.openrouter?.has_secret ? "An API key is set." : "No API key yet. Create one at openrouter.ai/keys."}</p>
          <ActionForm action={saveProvider.bind(null, "openrouter")} submit="Save key"><div className="fld"><label htmlFor="or_key">API key</label><input id="or_key" name="api_key" type="password" autoComplete="off" /></div></ActionForm>
        </div>
        <div className="card"><h3>AWS Bedrock</h3>
          <p className="small muted">{data.providers.bedrock?.has_secret ? "Access keys are set." : "Leave the keys empty to use the server's IAM role, which is the safer option."}</p>
          <ActionForm action={saveProvider.bind(null, "bedrock")} submit="Save Bedrock settings">
            <div className="fld"><label htmlFor="b_r">Region</label><input id="b_r" name="region" defaultValue={data.providers.bedrock?.config?.region ?? "us-east-1"} /></div>
            <div className="fld"><label htmlFor="b_a">Access key ID (optional)</label><input id="b_a" name="access_key_id" autoComplete="off" /></div>
            <div className="fld"><label htmlFor="b_s">Secret access key (optional)</label><input id="b_s" name="secret_access_key" type="password" autoComplete="off" /></div>
          </ActionForm>
        </div>
      </div>
      <div className="card qz-scroll"><h3>Configured models</h3>
        <table className="qz-table">
          <thead><tr><th>Model</th><th>Used for</th><th>Provider</th><th>Fallback</th><th>Size</th><th>Status</th><th /></tr></thead>
          <tbody>{data.models.map((m) => (
            <tr key={m.id}>
              <td>{m.label}<div className="small muted">{m.model_id}</div></td><td>{m.purpose === "chat" ? "Answering" : "Reading documents"}</td><td>{m.provider}</td><td>{m.fallback_order ?? "—"}</td><td>{m.dimensions ?? "—"}</td>
              <td>{m.is_default ? <span className="badge ok">default</span> : <span className={`badge ${m.enabled ? "info" : "warn"}`}>{m.enabled ? "enabled" : "off"}</span>}</td>
              <td><div className="row" style={{ margin: 0 }}>
                <ActionForm action={testModel.bind(null, m.id)} submit="Test" />
                {!m.is_default && op(m.id, "default", "Make default")}
                {!m.is_default && op(m.id, m.enabled ? "disable" : "enable", m.enabled ? "Turn off" : "Turn on")}
                {!m.is_default && <ConfirmButton action={modelAction.bind(null, m.id, "delete")} label="Remove" ask={`Remove ${m.label}? Any vectors made with it are deleted too.`} />}
              </div></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="card"><h3>Add a model</h3>
        <ActionForm action={addModel} submit="Add model">
          <div className="grid2">
            <div className="fld"><label htmlFor="m_p">Provider</label><select id="m_p" name="provider"><option value="openrouter">OpenRouter</option><option value="bedrock">AWS Bedrock</option><option value="local">Local (embeddings only)</option></select></div>
            <div className="fld"><label htmlFor="m_u">Used for</label><select id="m_u" name="purpose"><option value="chat">Answering</option><option value="embedding">Reading documents</option></select></div>
            <div className="fld"><label htmlFor="m_i">Model ID</label><input id="m_i" name="model_id" required list="free-models" placeholder="e.g. openrouter/free" />
              <datalist id="free-models">{[...(free?.chat ?? []), ...(free?.embedding ?? [])].map((x) => <option key={x.id} value={x.id} />)}</datalist></div>
            <div className="fld"><label htmlFor="m_l">Display name</label><input id="m_l" name="label" /></div>
            <div className="fld"><label htmlFor="m_f">Fallback order (answering only)</label><input id="m_f" name="fallback_order" inputMode="numeric" placeholder="1 is tried first after the default" /></div>
            <div className="fld"><label htmlFor="m_d">Vector size (embeddings, optional)</label><input id="m_d" name="dimensions" inputMode="numeric" placeholder="Detected automatically if empty" /></div>
          </div>
        </ActionForm>
        {free && <p className="small muted">OpenRouter currently lists {free.chat.length} free answering models and {free.embedding.length} free embedding models. Suggestions appear as you type in Model ID.</p>}
      </div>
      <div className="card"><h3>After changing the embedding model</h3><p className="muted small">Vectors from different models can't be compared, so all documents must be processed again.</p><ActionForm action={reindexAll} submit="Process all documents again" confirm="Process every document again with the current embedding model?" /></div>
    </>
  );
}
