"use client";
import { useActionState, useRef, useState } from "react";
import { useFormKeepingInput } from "@/components/admin-ui";
import type { State } from "@/app/(app)/budget/actions";

type M = { p: string; label: string };
const num = (s: string) => Number(String(s ?? "").replace(/,/g, "")) || 0;
const r2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

/** The artifact's budget entry grid: type an annual figure and Spread it, or type each month. */
export function BudgetGrid({ action, rows, months, initial }: { action: (s: State, f: FormData) => Promise<State>; rows: string[]; months: M[]; initial: Record<string, number[]> }) {
  const [state, run, pending] = useActionState(action, {});
  const [vals, setVals] = useState<string[][]>(() => rows.map((c) => Array.from({ length: 12 }, (_, i) => { const v = initial[c]?.[i]; return v ? String(v) : ""; })));
  const { ref, onSubmit } = useFormKeepingInput(run, null);
  const annual = useRef<Record<number, string>>({});
  const [, force] = useState(0);
  const set = (r: number, i: number, v: string) => setVals((a) => a.map((row, x) => (x === r ? row.map((c, y) => (y === i ? v : c)) : row)));
  const rowTotal = (r: number) => vals[r].reduce((t, v) => t + num(v), 0);
  const spread = (r: number) => {
    const a = num(annual.current[r] ?? String(rowTotal(r)));
    const each = Math.floor((a / 12) * 100) / 100; // the last month takes the rounding, so the year still adds up exactly
    setVals((all) => all.map((row, x) => (x === r ? row.map((_, i) => (a ? String(i < 11 ? each : r2(a - each * 11)) : "")) : row)));
    delete annual.current[r];
  };
  const spendMonth = (i: number) => rows.reduce((t, c, r) => (c === "Revenue" ? t : t + num(vals[r][i])), 0);
  const spendAll = months.reduce((t, _, i) => t + spendMonth(i), 0);
  return (
    <form ref={ref} action={run} onSubmit={onSubmit} className="f">
      {state.error && <div className="banner bad" role="alert">{state.error}</div>}
      <div className="tw bgrid qz-scroll"><table className="qz-table">
        <thead><tr><th>Category</th><th>Annual</th><th />{months.map((m) => <th key={m.p}>{m.p}<div className="help">{m.label}</div></th>)}</tr></thead>
        <tbody>
          {rows.map((c, r) => (
            <tr key={c}>
              <td style={{ minWidth: 190 }}>{c}</td>
              <td style={{ minWidth: 110 }}><input key={rowTotal(r)} defaultValue={rowTotal(r) ? r2(rowTotal(r)) : ""} inputMode="decimal" aria-label={`${c} annual`} onChange={(e) => { annual.current[r] = e.target.value; force((n) => n + 1); }} /></td>
              <td><button type="button" className="btn sm" onClick={() => spread(r)} aria-label={`Spread ${c}`}>Spread</button></td>
              {months.map((m, i) => <td key={m.p} style={{ minWidth: 90 }}><input name={`m_${r}_${i}`} value={vals[r][i]} inputMode="decimal" aria-label={`${c} ${m.label}`} onChange={(e) => set(r, i, e.target.value)} /></td>)}
            </tr>
          ))}
          <tr><td><b>Total spending</b></td><td id="bud-tot"><b>{fmt(spendAll)}</b></td><td />{months.map((m, i) => <td key={m.p}>{fmt(spendMonth(i))}</td>)}</tr>
        </tbody>
      </table></div>
      <div className="row"><button className="btn p" disabled={pending}>{pending ? "Saving…" : "Save budget"}</button></div>
    </form>
  );
}
