// @ts-nocheck
/* Reviewed port of the artifact's chart helpers (budget.js, insights.js). They return HTML for artifact CSS classes; all text passes through esc. */
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const r2 = (n: number) => Math.round(n * 100) / 100;
export const fmtNum = (v: number | null | undefined) => (v == null ? "—" : Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 }));
export const fmtK = (v: number | null | undefined) => { if (v == null) return "—"; const a = Math.abs(v); return a >= 1e6 ? (v / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M" : a >= 1e4 ? (v / 1e3).toFixed(1).replace(/\.0$/, "") + "k" : fmtNum(r2(v)); };
type Fmt = (v: any) => string;
export function lineChart(labels: string[], series: { name: string; dash?: boolean; values: (number | null)[] }[], fmt: Fmt, opts: { target?: number; label?: string } = {}) {
  const W = 640, H = 230, L = 64, R = 14, T = 14, B = 30, n = labels.length;
  const vals = series.flatMap(s => s.values.filter(v => v != null)).concat(opts.target ? [opts.target] : []);
  if (!n || !vals.length || !vals.some(v => v)) return '<p class="muted small">Nothing to show yet.</p>';
  const max = Math.max(...vals) * 1.08 || 1, x = i => L + (n === 1 ? (W - L - R) / 2 : i * (W - L - R) / (n - 1)), y = v => T + (H - T - B) * (1 - v / max);
  const grid = [0, .25, .5, .75, 1].map(f => `<line x1="${L}" x2="${W - R}" y1="${y(max * f)}" y2="${y(max * f)}" class="gl"/><text x="${L - 6}" y="${y(max * f) + 4}" text-anchor="end" class="ax">${esc(fmt(max * f))}</text>`).join("");
  const step = Math.ceil(n / 8), xl = labels.map((l, i) => i % step === 0 || i === n - 1 ? `<text x="${x(i)}" y="${H - 10}" text-anchor="middle" class="ax">${esc(l)}</text>` : "").join("");
  const tgt = opts.target ? `<line x1="${L}" x2="${W - R}" y1="${y(opts.target)}" y2="${y(opts.target)}" class="tg"/><text x="${W - R}" y="${y(opts.target) - 5}" text-anchor="end" class="ax">Target ${esc(fmt(opts.target))}</text>` : "";
  const paths = series.map((s, si) => { const pts = s.values.map((v, i) => v == null ? null : [x(i), y(v), v, i]).filter(Boolean);
    return `<path d="${pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ")}" class="ln" style="stroke:var(--c${si + 1})${s.dash ? ";stroke-dasharray:5 4" : ""}"/>`
      + pts.map(p => `<g class="pt"><circle cx="${p[0]}" cy="${p[1]}" r="9" class="hit"/><circle cx="${p[0]}" cy="${p[1]}" r="3.5" style="fill:var(--c${si + 1})"/><title>${esc(s.name)} · ${esc(labels[p[3]])}: ${esc(fmt(p[2]))}</title></g>`).join(""); }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" class="lc" role="img" aria-label="${esc(opts.label || series.map(s => s.name).join(", "))}">${grid}${tgt}${paths}${xl}</svg>
   <ul class="lg row">${series.map((s, i) => `<li><i style="background:var(--c${i + 1})${s.dash ? ";opacity:.6" : ""}"></i>${esc(s.name)}${s.dash ? " (dashed)" : ""}</li>`).join("")}${opts.target ? '<li><i class="tgk"></i>Target</li>' : ""}</ul>`;
}
export function pairCols(rows: { label: string; tip?: string; a: any; b: any; flag?: string }[], names: string[], fmt: Fmt) {
  if (!rows.length || !rows.some(r => r.a || r.b)) return '<p class="muted small">Nothing to show yet.</p>';
  const max = Math.max(...rows.flatMap(r => [Math.abs(r.a || 0), Math.abs(r.b || 0)]), 1);
  return `<div class="cc pc">${rows.map(r => `<div class="ccb" title="${esc(r.tip || r.label)}: ${esc(names[0])} ${esc(fmt(r.a))}, ${esc(names[1])} ${r.b == null ? "—" : esc(fmt(r.b))}"><span class="ccv">${r.flag ? `<span class="badge bad">${esc(r.flag)}</span>` : ""}</span><span class="cct two"><i style="height:${pct(Math.abs(r.a || 0), max)}%"></i><i class="b2" style="height:${r.b == null ? 0 : pct(Math.abs(r.b), max)}%"></i></span><span class="ccl">${esc(r.label)}</span></div>`).join("")}</div>
   <ul class="lg row"><li><i style="background:var(--c1)"></i>${esc(names[0])}</li><li><i style="background:var(--c2)"></i>${esc(names[1])}</li></ul>`;
}
export function pairBars(rows: { label: string; a: any; b: any }[], names: string[], fmt: Fmt) {
  rows = rows.filter(r => r.a || r.b); if (!rows.length) return '<p class="muted small">Nothing to show yet.</p>';
  const max = Math.max(...rows.flatMap(r => [Math.abs(r.a || 0), Math.abs(r.b || 0)]), 1);
  return `<div class="hb">${rows.map(r => `<div class="hbr two" title="${esc(r.label)}: ${esc(names[0])} ${esc(fmt(r.a))}, ${esc(names[1])} ${esc(fmt(r.b))}"><span class="hbl">${esc(r.label)}</span><span class="hbt2"><span class="hbt"><i style="width:${pct(Math.abs(r.a || 0), max)}%"></i></span><span class="hbt"><i style="width:${pct(Math.abs(r.b || 0), max)}%;background:var(--c2)"></i></span></span><span class="hbv">${esc(fmt(r.a))}<br>${esc(fmt(r.b))}</span></div>`).join("")}</div>
   <ul class="lg row"><li><i style="background:var(--c1)"></i>${esc(names[0])}</li><li><i style="background:var(--c2)"></i>${esc(names[1])}</li></ul>`;
}
