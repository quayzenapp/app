"use client";
import { useState, useTransition } from "react";
import type { ActionState } from "@/app/admin/actions";
import type { Field } from "@/lib/forms";

const TYPES = ["text", "textarea", "int", "decimal", "money", "rate", "date", "currency", "choice", "ref", "user"];
type Initial = { label: string; plural: string; module: string; intro: string; titleField: string; listFields: string[]; status: string; fields: Field[] };

export function FormBuilder({ save, initial, modules, lookups, sensitive }: { save: (p: unknown) => Promise<ActionState>; initial: Initial; modules: { value: string; label: string }[]; lookups: string[]; sensitive: Record<string, string> }) {
  const [v, setV] = useState(initial);
  const [msg, setMsg] = useState<ActionState>({});
  const [pending, start] = useTransition();
  const set = (patch: Partial<Initial>) => setV((x) => ({ ...x, ...patch }));
  const setField = (i: number, patch: Partial<Field>) => set({ fields: v.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) });
  const move = (i: number, d: number) => { const a = [...v.fields]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; set({ fields: a }); };
  const clean = (o?: string) => o || undefined;
  const submit = () => start(async () => setMsg(await save({ ...v, fields: v.fields.map((f) => ({ ...f, group: clean(f.group), help: clean(f.help), lookup: clean(f.lookup), ref: clean(f.ref), sensitive: clean(f.sensitive) })) })));
  return (
    <div className="card">
      <div className="grid2">
        <div className="fld"><label>Name (singular)<input value={v.label} onChange={(e) => set({ label: e.target.value })} /></label></div>
        <div className="fld"><label>Name (plural)<input value={v.plural} onChange={(e) => set({ plural: e.target.value })} /></label></div>
        <div className="fld"><label>Section<select value={v.module} onChange={(e) => set({ module: e.target.value })}>{modules.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></label></div>
        <div className="fld"><label>Status<select value={v.status} onChange={(e) => set({ status: e.target.value })}><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="ARCHIVED">Archived</option></select></label></div>
        <div className="fld"><label>Title field<select value={v.titleField} onChange={(e) => set({ titleField: e.target.value })}>{v.fields.map((f) => <option key={f.name} value={f.name}>{f.label}</option>)}</select></label></div>
        <div className="fld wide"><label>Introduction<textarea rows={2} value={v.intro} onChange={(e) => set({ intro: e.target.value })} /></label></div>
      </div>
      <h3>Fields</h3>
      <div className="qz-scroll"><table className="qz-table">
        <thead><tr><th /><th>Label</th><th>Name</th><th>Type</th><th>Options</th><th>Group</th><th>Restricted</th><th>Required</th><th>In list</th><th /></tr></thead>
        <tbody>{v.fields.map((f, i) => (
          <tr key={i}>
            <td><button type="button" className="btn sm" aria-label="Move up" onClick={() => move(i, -1)}>↑</button> <button type="button" className="btn sm" aria-label="Move down" onClick={() => move(i, 1)}>↓</button></td>
            <td><input value={f.label} aria-label="Label" onChange={(e) => setField(i, { label: e.target.value })} /></td>
            <td><input value={f.name} aria-label="Name" onChange={(e) => setField(i, { name: e.target.value })} /></td>
            <td><select value={f.type} aria-label="Type" onChange={(e) => setField(i, { type: e.target.value })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></td>
            <td>{f.type === "choice" && (
              <><select value={f.lookup ?? ""} aria-label="Shared list" onChange={(e) => setField(i, { lookup: e.target.value, choices: e.target.value ? undefined : f.choices ?? [] })}><option value="">Own list</option>{lookups.map((l) => <option key={l}>{l}</option>)}</select>
              {!f.lookup && <input placeholder="Comma separated" aria-label="Choices" value={(f.choices ?? []).join(", ")} onChange={(e) => setField(i, { choices: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />}</>
            )}{f.type === "ref" && <input placeholder="Form key" aria-label="Linked form" value={f.ref ?? ""} onChange={(e) => setField(i, { ref: e.target.value })} />}</td>
            <td><input value={f.group ?? ""} aria-label="Group" onChange={(e) => setField(i, { group: e.target.value })} /></td>
            <td><select value={f.sensitive ?? ""} aria-label="Restricted" onChange={(e) => setField(i, { sensitive: e.target.value })}><option value="">No</option>{Object.entries(sensitive).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></td>
            <td><input type="checkbox" aria-label="Required" checked={!!f.required} onChange={(e) => setField(i, { required: e.target.checked })} /></td>
            <td><input type="checkbox" aria-label="Show in list" checked={v.listFields.includes(f.name)} onChange={(e) => set({ listFields: e.target.checked ? [...v.listFields, f.name] : v.listFields.filter((n) => n !== f.name) })} /></td>
            <td><button type="button" className="btn sm" onClick={() => set({ fields: v.fields.filter((_, j) => j !== i), listFields: v.listFields.filter((n) => n !== f.name) })}>Remove</button></td>
          </tr>
        ))}</tbody>
      </table></div>
      <div className="row">
        <button type="button" className="btn" onClick={() => set({ fields: [...v.fields, { name: `field_${v.fields.length + 1}`, label: "New field", type: "text" }] })}>Add field</button>
        <button type="button" className="btn p" disabled={pending} onClick={submit}>{pending ? "Saving…" : "Save form"}</button>
      </div>
      {msg.error && <div className="banner bad" role="alert">{msg.error}</div>}
      {msg.ok && <div className="banner info" role="status">{msg.ok}</div>}
    </div>
  );
}
