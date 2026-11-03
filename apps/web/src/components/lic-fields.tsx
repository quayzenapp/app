"use client";
import { useState } from "react";
import { ActionForm } from "@/components/admin-ui";
import { createLic } from "@/lib/lic/core";
import type { State } from "@/app/(app)/apply/actions";

const L = createLic();
type Spec = { k: string; l: string; t: string; ref?: string; ch?: string[] | ((a: unknown) => string[]); help?: string; need?: boolean; when?: (a: unknown) => boolean; g?: string; sens?: string };
type Rec = Record<string, unknown> & { marks?: Record<string, string> };

function Field({ f, rec, v, mark, disabled, onChange }: { f: Spec; rec: Rec; v: unknown; mark?: string; disabled: boolean; onChange: (x: unknown) => void }) {
  const id = `f_${f.k.replace(/\W/g, "_")}`;
  const ch = typeof f.ch === "function" ? f.ch(rec) : f.ch ?? [];
  const off = disabled || !!mark;
  let input;
  if (f.t === "area") input = <textarea id={id} name={f.k} rows={3} defaultValue={String(v ?? "")} disabled={off} />;
  else if (f.t === "choice" || f.t === "yn") { const opts = f.t === "yn" ? ["Yes", "No"] : ch; input = <select id={id} name={f.k} value={String(v ?? "")} disabled={off} onChange={(e) => onChange(e.target.value || null)}><option value="">—</option>{opts.map((o) => <option key={o}>{o}</option>)}{!!v && !opts.includes(String(v)) && <option>{String(v)}</option>}</select>; }
  else if (f.t === "multi") input = <div className="mchk" id={id}>{ch.map((o) => <label key={o} style={{ display: "block" }}><input type="checkbox" name={f.k} value={o} checked={((v as string[]) ?? []).includes(o)} disabled={off} onChange={(e) => { const cur = (v as string[]) ?? []; onChange(e.target.checked ? [...cur, o] : cur.filter((x) => x !== o)); }} /> {o}</label>)}</div>;
  else if (f.t === "check") input = <label className="radio"><input type="checkbox" id={id} name={f.k} value="1" checked={!!v} disabled={off} onChange={(e) => onChange(e.target.checked)} /> Yes</label>;
  else if (f.t === "date") input = <input type="date" id={id} name={f.k} defaultValue={String(v ?? "")} disabled={off} />;
  else input = <input id={id} name={f.k} defaultValue={String(v ?? "")} disabled={off} inputMode={f.t === "num" ? "decimal" : undefined} />;
  return (
    <div className={`fld${f.t === "area" || f.t === "multi" ? " wide" : ""}`}>
      <label htmlFor={id}>{f.l}{f.need !== false && <span className="req"> *</span>}{f.sens && <span className="badge warn"> restricted</span>}</label>
      {input}
      <input type="hidden" name="__seen" value={f.k} />
      {f.ref && <span className="help">{f.ref}</span>}{f.help && <span className="help">{f.help}</span>}
      {!disabled && f.need !== false && <select name={`mark:${f.k}`} defaultValue={mark ?? ""} aria-label={`Mark ${f.l}`} className="small" style={{ maxWidth: 170, marginTop: 4 }}><option value="">Has a value</option>{(L.MARKS as string[]).map((m) => <option key={m}>{m}</option>)}</select>}
    </div>
  );
}

/** Fields come from the artifact's specs. `when` is re-checked as the person types, so only what applies is shown. */
export function SpecFields({ specKeys, kind, initial, action, disabled, submit, hidden = [], extra }: { specKeys: string; kind: "app" | "person"; initial: Rec; action: (s: State, f: FormData) => Promise<State>; disabled: boolean; submit: string; hidden?: string[]; extra?: React.ReactNode }) {
  const [a, setA] = useState<Rec>(initial);
  const specs: Spec[] = kind === "app" ? L.APP_SPEC.filter((f: { step: string }) => f.step === specKeys) : L.PERSON_SPEC.filter((f: Spec) => !hidden.includes(f.k));
  const groups = kind === "person" ? (L.personGroups(a, initial.__app) as string[]) : [""];
  const body = groups.map((g) => (
    <fieldset key={g}>
      {kind === "person" && <><legend>{L.PERSON_GROUP_LABELS[g]?.[0]}</legend><p className="help">{L.PERSON_GROUP_LABELS[g]?.[1]}</p></>}
      <div className="grid2">
        {specs.filter((f) => (kind === "app" || f.g === g) && (!f.when || f.when(a))).map((f) => <Field key={f.k} f={f} rec={a} v={kind === "app" ? L.getPath(a, f.k) : a[f.k]} mark={a.marks?.[f.k]} disabled={disabled} onChange={(x) => setA((p) => { const n = JSON.parse(JSON.stringify(p)); if (kind === "app") L.setPath(n, f.k, x); else n[f.k] = x; return n; })} />)}
      </div>
    </fieldset>
  ));
  if (disabled) return <div className="f">{body}{extra}</div>;
  return <ActionForm action={action} submit={submit} className="f">{body}{extra}</ActionForm>;
}
