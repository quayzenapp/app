"use client";
import { useActionState } from "react";
import type { SaveState } from "@/app/(app)/actions";
import type { Field } from "@/lib/forms";

type Opt = { value: string; label: string };
type Props = { action: (s: SaveState, f: FormData) => Promise<SaveState>; fields: Field[]; values: Record<string, unknown>; choices: Record<string, string[]>; refs: Record<string, Opt[]>; users: Opt[]; readOnly: boolean };

function Input({ f, v, p }: { f: Field; v: unknown; p: Props }) {
  const common = { id: `f_${f.name}`, name: f.name, disabled: p.readOnly || f.readonly, defaultValue: v == null ? "" : String(v) };
  if (f.type === "textarea") return <textarea rows={3} {...common} />;
  const opts: Opt[] | null = f.type === "choice" ? (p.choices[f.name] ?? []).map((c) => ({ value: c, label: c })) : f.type === "ref" ? p.refs[f.name] ?? [] : f.type === "user" ? p.users : null;
  if (opts) return <select {...common}><option value="">—</option>{opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>;
  if (f.type === "date") return <input type="date" {...common} />;
  if (f.type === "currency") return <input maxLength={3} placeholder="USD" style={{ textTransform: "uppercase" }} {...common} />;
  return <input inputMode={["int", "decimal", "money", "rate"].includes(f.type) ? "decimal" : undefined} {...common} />;
}

export function RecordForm(p: Props) {
  const [state, action, pending] = useActionState(p.action, {});
  const groups = new Map<string, Field[]>();
  for (const f of p.fields) { const g = f.group ?? "Details"; groups.set(g, [...(groups.get(g) ?? []), f]); }
  return (
    <form className="f" action={action} noValidate>
      {state.errors?.length ? <div className="banner bad" role="alert"><ul>{state.errors.map((e) => <li key={e}>{e}</li>)}</ul></div> : null}
      {state.notes?.length ? <div className="banner info" role="status"><ul>{state.notes.map((e) => <li key={e}>{e}</li>)}</ul></div> : null}
      {[...groups].map(([g, fs]) => (
        <fieldset key={g}>
          <legend>{g}</legend>
          <div className="grid2">
            {fs.map((f) => (
              <div key={f.name} className={`fld${f.type === "textarea" ? " wide" : ""}`}>
                <label htmlFor={`f_${f.name}`}>{f.label}{f.required && <span className="req"> *</span>}{f.sensitive && <span className="badge warn"> restricted</span>}</label>
                <Input f={f} v={p.values[f.name]} p={p} />
                {f.help && <div className="help">{f.help}</div>}
              </div>
            ))}
          </div>
        </fieldset>
      ))}
      {!p.readOnly && <div className="row"><button className="btn p" disabled={pending}>{pending ? "Saving…" : "Save"}</button></div>}
    </form>
  );
}
