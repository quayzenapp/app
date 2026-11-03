"use client";
import { useActionState } from "react";
import { useFormKeepingInput } from "@/components/admin-ui";
import type { ImportState } from "@/app/(app)/r/[form]/import/actions";

export function ImportForm({ action, templateHref }: { action: (s: ImportState, f: FormData) => Promise<ImportState>; templateHref: string }) {
  const [s, run, pending] = useActionState(action, {});
  const { ref, onSubmit } = useFormKeepingInput(run, s);
  return (
    <details className="card"><summary>Import from Excel</summary>
      <form ref={ref} action={run} onSubmit={onSubmit} className="row"><input type="file" name="file" accept=".xlsx" aria-label="Excel file" /><button className="btn sm" disabled={pending}>{pending ? "Importing…" : "Import"}</button><a className="btn sm" href={templateHref}>Download the template</a></form>
      {s.ok && <div className="banner info" role="status">{s.ok}</div>}
      {s.error && <div className="banner bad" role="alert">{s.error}{s.errors && <ul>{s.errors.map((e) => <li key={e}>{e}</li>)}</ul>}</div>}
    </details>
  );
}
