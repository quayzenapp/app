/* ===== library_ui.js ===== */
/* Port City Library and "Ask" assistant.
   The built-in library (library.js) holds the supplied Acts, regulations, gazettes and Commission forms.
   Administrators can add circulars and other documents; they are shared by everyone using this page.
   Answers come from Claude, using only passages found in the library, with citations. */


const LIB_KINDS = ["Circular", "Act", "Regulations", "Rules", "Gazette notice", "Commission form", "Commission guidance", "Other"];
const LIB_STOP = new Set("the a an of and or to in for on by with is are be as at from that this which any such shall may under its it his her their than other into not no do does what when how who where can i we our us you your there been has have had was were will would should could about".split(" "));
const LIB_SYN = { fee: ["fees", "payable"], visa: ["visa", "residence", "immigration"], bsi: ["strategic", "importance"], tax: ["inland", "revenue", "tax"], renew: ["renewal", "renew"], office: ["premise", "office", "location"], staff: ["employ", "employee"], employee: ["employ", "staff"], designated: ["designat"], fdi: ["foreign", "direct", "investment"], ubo: ["beneficial", "owner"], penalty: ["penalt", "offence", "fine"], deadline: ["within", "day", "month"], renewal: ["renew"], valid: ["validity", "period", "expire"], rupee: ["rupees", "lkr"], lkr: ["rupee"] };

function libStem(w) {
  w = w.replace(/licens/, "licenc");
  if (w.length > 4) { if (/ie[sd]$/.test(w)) return w.slice(0, -3) + "y";
    for (const s of ["ations", "ation", "ments", "ment", "ities", "ity", "ings", "ing", "als", "al", "ed", "es", "s", "e"]) if (w.endsWith(s) && w.length - s.length >= 4 && !(s === "s" && w.endsWith("ss"))) return w.slice(0, -s.length); }
  return w;
}
function libToks(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter(w => w.length > 1 && !LIB_STOP.has(w)).map(libStem); }

/* All documents and passages: built-in plus added ones. Passage ids: b<n> for built-in, u<doc>:<n> for added. */
const LibIdx = { v: -1, docs: [], chunks: [], df: new Map(), avg: 0 };
/* The built-in library text is large, so it is loaded only when first needed. */
let LIB_STATE = "idle", LIB_PROMISE = null;
function libLoad() {
  if (window.LIBRARY) { LIB_STATE = "ready"; return Promise.resolve(); }
  if (LIB_PROMISE) return LIB_PROMISE;
  LIB_STATE = "loading";
  LIB_PROMISE = fetch("js/library.json").then(r => { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
    .catch(() => loadScript("js/library.js").then(() => window.LIBRARY))
    .then(d => { if (!d || !d.docs) throw new Error("empty"); window.LIBRARY = d; LIB_STATE = "ready"; LibIdx.v = -1; render(); })
    .catch(e => { console.warn("library", e); LIB_STATE = "failed"; LIB_PROMISE = null; render(); });
  return LIB_PROMISE;
}
function libData() {
  const LIBRARY = window.LIBRARY || { docs: [], chunks: [] };
  if (LibIdx.v === (Store._libv || 0) && LibIdx.docs.length && LibIdx.built === !!window.LIBRARY) return LibIdx;
  LibIdx.built = !!window.LIBRARY;
  const sup = new Set(((Store.lib.libsettings.get("main") || {}).superseded) || []);
  const docs = LIBRARY.docs.map(d => Object.assign({}, d, { builtin: true, status: sup.has(d.id) ? "Superseded" : "Current" }));
  const chunks = LIBRARY.chunks.map((c, i) => ({ id: "b" + i, doc: docs[c[0]], page: c[1], sec: c[2], text: c[3] }));
  [...Store.lib.library.values()].filter(d => !d.deleted).sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).forEach(d => {
    const doc = Object.assign({}, d, { builtin: false, status: d.status || "Current" }); docs.push(doc);
    for (let p = 0; p < (d.parts || 0); p++) { const t = Store.lib.libtext.get(`${d.id}_${p}`); (t && t.chunks || []).forEach((c, j) => chunks.push({ id: `u${d.id}:${p}.${j}`, doc, page: c[0], sec: c[1] || "", text: c[2] })); }
  });
  const df = new Map(); let tot = 0;
  chunks.forEach(c => { c.toks = libToks(c.text + " " + c.sec); c.tf = new Map(); c.toks.forEach(t => c.tf.set(t, (c.tf.get(t) || 0) + 1)); tot += c.toks.length; c.tf.forEach((_, t) => df.set(t, (df.get(t) || 0) + 1)); c.dtoks = new Set(libToks(c.doc.title + " " + c.doc.short + " " + c.doc.kind)); });
  Object.assign(LibIdx, { vocab: null, v: Store._libv || 0, docs, chunks, df, avg: tot / Math.max(1, chunks.length), byId: new Map(chunks.map(c => [c.id, c])) });
  return LibIdx;
}
function libSearch(q, k = 8, opts = {}) {
  const L = libData(), N = L.chunks.length; let qt = libToks(q);
  qt = [...new Set(qt.concat(qt.flatMap(t => (LIB_SYN[t] || []).map(libStem))))];
  if (!qt.length) return [];
  const W = new Map(qt.map(t => [t, 1]));
  if (!L.vocab) L.vocab = [...L.df.keys()];
  qt.filter(t => t.length >= 5).forEach(t => { const p = t.slice(0, 5); let n = 0; for (const v of L.vocab) if (v !== t && v.startsWith(p) && !W.has(v) && n++ < 12) W.set(v, 0.45); });
  const sc = [];
  for (const c of L.chunks) {
    if (!opts.all && c.doc.status === "Superseded") continue;
    if (opts.doc && c.doc.id !== opts.doc) continue;
    let s = 0;
    for (const [t, w] of W) { const f = c.tf.get(t); if (f) { const idf = Math.log(1 + (N - L.df.get(t) + 0.5) / (L.df.get(t) + 0.5)); s += w * idf * f * 2.2 / (f + 1.2 * (0.25 + 0.75 * c.toks.length / L.avg)); } if (w === 1 && c.dtoks.has(t)) s += 0.6; }
    if (s > 0) sc.push([s, c]);
  }
  return sc.sort((a, b) => b[0] - a[0]).slice(0, k).map(x => x[1]);
}
const libRef = c => `${c.doc.short}${c.sec ? (c.doc.kind === "Act" ? ", s. " : ", item ") + c.sec : ""}${c.page ? ", p. " + c.page : ""}`;
const libPassage = c => `[[${c.id}]] ${c.doc.title}${c.doc.date ? " (" + c.doc.date + ")" : ""}${c.doc.status === "Superseded" ? " [marked superseded]" : ""} | ${libRef(c)}\n${c.text}`;

/* ---------- Ask (chat) ---------- */
const LIB_RULES = `You are the help assistant inside Quayzen, a compliance workspace used by staff of companies that hold an Authorised Person licence or Business of Strategic Importance designation from the Colombo Port City Economic Commission.
Answer ONLY from the library passages given to you or found with the search_documents and read_passage tools. Search again with other words if the first passages do not answer the question.
Rules:
- Cite each point with the passage id in double square brackets, exactly as given, e.g. [[b12]]. Never invent ids.
- If the passages do not answer the question, say so plainly and suggest asking the Commission or an adviser. Do not fill gaps from general knowledge.
- Keep three things apart: what a Commission form asks for; what the Act or regulations say; and conditions that depend on the company's own licence, approval or BSI designation.
- Do not give definitive legal or tax conclusions and never say a company is compliant. Where it matters, say the company should confirm with the Commission, its lawyer or accountant.
- Mention when a document may have been amended since its date, and when a passage is marked superseded.
- Write in plain, simple English. Short paragraphs or bullet points. Usually under 250 words.`;
function mdLite(t) {
  let h = esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\[\[([bu][\w:.\-]+)\]\]/g, (m, id) => { const c = libData().byId.get(id); return c ? `<button class="cite" data-act="lib-passage" data-id="${esc(id)}" title="${esc(c.doc.title)}">${esc(libRef(c))}</button>` : ""; });
  const lines = h.split("\n"); let out = "", inL = false;
  for (const l of lines) { const m = l.match(/^\s*[-*•]\s+(.*)/) || l.match(/^\s*\d+[.)]\s+(.*)/);
    if (m) { if (!inL) { out += "<ul>"; inL = true; } out += `<li>${m[1]}</li>`; } else { if (inL) { out += "</ul>"; inL = false; } out += l.trim() ? `<p>${l.replace(/^#+\s*/, "")}</p>` : ""; } }
  return out + (inL ? "</ul>" : "");
}
const LIB_SUGGEST = ["When is the AP licence renewal fee due?", "What does the annual return ask about office space?", "Which visas are available for Port City employees?", "What can a company do with Sri Lankan rupee payments?", "What must every Authorised Person do about tax returns?", "What happened to designated locations outside Port City?"];
function askHTML() {
  const msgs = UI.chat;
  return `<div class="chatwrap"><div class="chat" id="chatlog" aria-live="polite">
    ${msgs.length ? msgs.map((m, i) => m.role === "user" ? `<div class="msg me">${esc(m.content)}</div>` : `<div class="msg ai${m.err ? " err" : ""}" id="msg${i}">${m.pending && !m.content ? '<span class="typing">Looking through the documents…</span>' : mdLite(m.content)}${m.status ? `<div class="help">${esc(m.status)}</div>` : ""}
      ${m.sources && m.sources.length && !m.pending ? `<div class="srcs"><span class="small muted">Sources:</span>${m.sources.map(id => { const c = libData().byId.get(id); return c ? `<button class="cite" data-act="lib-passage" data-id="${esc(id)}">${esc(libRef(c))}</button>` : ""; }).join("")}</div>` : ""}
      ${m.fallback ? `<div class="hits">${m.fallback.map(c => `<button class="hit" data-act="lib-passage" data-id="${esc(c)}"><b>${esc(libRef(libData().byId.get(c)))}</b><span>${esc(libData().byId.get(c).text.slice(0, 220))}…</span></button>`).join("")}</div>` : ""}</div>`).join("")
    : `<div class="chat-empty"><h3>Ask about Port City rules</h3><p class="muted">Answers come only from the documents in the library, with the source shown for each point. They are a starting point, not legal advice.</p><div class="sugg">${LIB_SUGGEST.map(s => `<button class="chip-btn" data-act="lib-suggest">${esc(s)}</button>`).join("")}</div></div>`}</div>
   <form class="askbar" data-form="lib-ask"><textarea name="q" rows="2" placeholder="Ask a question, e.g. How long is an AP licence valid?" aria-label="Your question"></textarea>
    <div class="row" style="margin:0">${UI.askCtl ? '<button type="button" class="btn bad" data-act="lib-stop">Stop</button>' : '<button class="btn p">Ask</button>'}${msgs.length ? '<button type="button" class="btn" data-act="lib-clear">New conversation</button>' : ""}</div></form>
   <p class="small muted">Asking uses your own Claude account and needs this page open in claude.ai. Library documents may have been amended since they were added. Check important points against the source and with the Commission.</p></div>`;
}
async function libAsk(q) {
  q = q.trim(); if (!q || UI.askCtl) return;
  if (!window.LIBRARY) { await libLoad(); if (!window.LIBRARY) throw ["The library could not be loaded. Check your connection and try again."]; }
  const hist = UI.chat.filter(m => !m.pending && !m.err).slice(-6);
  UI.chat.push({ role: "user", content: q }); const me = { role: "assistant", content: "", pending: true, sources: [] }; UI.chat.push(me);
  const hits = libSearch(q, 6); render(); scrollChat();
  let sample = null; try { sample = await window.claude?.use?.("sample"); } catch (e) { }
  if (!sample) { Object.assign(me, { pending: false, content: hits.length ? "Asking Claude isn't available in this view, so here are the passages that best match your question. Open one to read it in full." : "Asking Claude isn't available in this view, and no passage matched your question. Try other words, or browse the documents.", fallback: hits.map(c => c.id) }); render(); scrollChat(); return; }
  const seen = new Set(hits.map(c => c.id));
  const tools = [
    { name: "search_documents", description: "Keyword search of the Port City library (Acts, regulations, gazettes, Commission forms and circulars). Returns up to 6 passages with their ids. Use different wording to find more.", inputSchema: { type: "object", properties: { query: { type: "string", description: "Keywords to search for" } }, required: ["query"] },
      execute: ({ query }) => { me.status = `Searching: "${String(query).slice(0, 60)}"`; render(); const r = libSearch(String(query || ""), 6); r.forEach(c => seen.add(c.id)); return r.length ? r.map(libPassage).join("\n\n---\n\n") : "No passages matched."; } },
    { name: "read_passage", description: "Read a passage in full by its id, with the passages just before and after it in the same document.", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      execute: ({ id }) => { const L = libData(), i = L.chunks.findIndex(c => c.id === id); if (i < 0) return "No passage with that id.";
        me.status = `Reading ${libRef(L.chunks[i])}`; render(); return [i - 1, i, i + 1].filter(j => L.chunks[j] && L.chunks[j].doc === L.chunks[i].doc).map(j => { seen.add(L.chunks[j].id); return libPassage(L.chunks[j]); }).join("\n\n---\n\n"); } }];
  const input = [{ role: "user", content: LIB_RULES + `\n\nDocuments in the library: ${libData().docs.filter(d => d.status !== "Superseded").map(d => `${d.short} (${d.kind}${d.date ? ", " + d.date : ""})`).join("; ")}.` },
    ...hist.map(m => ({ role: m.role, content: m.role === "assistant" ? m.content.slice(0, 3000) : m.content })),
    { role: "user", content: `Question: ${q}\n\nPassages found by a first keyword search:\n\n${hits.map(libPassage).join("\n\n---\n\n") || "(none)"}` }];
  UI.askCtl = new AbortController(); render();
  try {
    const { text, truncated } = await sample(input, { tools, signal: UI.askCtl.signal, cache: false, onText: ({ text }) => { me.content = text; me.status = ""; const el = document.getElementById("msg" + UI.chat.indexOf(me)); if (el) el.innerHTML = mdLite(text); scrollChat(); } });
    me.content = text; me.status = truncated ? "The answer was cut short. Ask a narrower question." : "";
    me.sources = [...new Set((text.match(/\[\[([bu][\w:.\-]+)\]\]/g) || []).map(x => x.slice(2, -2)))].filter(id => seen.has(id) || libData().byId.has(id));
  } catch (e) {
    me.content = e.text || ""; me.err = !e.text;
    me.status = { cancelled: "Stopped.", not_granted: "Claude wasn't allowed for this page. You can still browse and search the documents.", rate_limited: "Too many questions at once or a usage limit was reached. Please try again later.", sampling_disabled: "Asking Claude is turned off for your account.", prompt_too_large: "The conversation is too long. Start a new conversation." }[e.code] || "Something went wrong. Please try again.";
    if (!me.content) me.fallback = hits.map(c => c.id);
  }
  me.pending = false; UI.askCtl = null; render(); scrollChat();
}
function scrollChat() { setTimeout(() => { const el = document.getElementById("chatlog"); if (el) el.scrollTop = el.scrollHeight; }, 0); }
FORMS["lib-ask"] = async form => { const q = form.q.value; form.q.value = ""; UI.typing = false; await libAsk(q); };
ACTIONS["lib-retry"] = () => { LIB_STATE = "idle"; libLoad(); render(); };
ACTIONS["lib-suggest"] = el => libAsk(el.textContent);
ACTIONS["lib-stop"] = () => UI.askCtl && UI.askCtl.abort();
ACTIONS["lib-clear"] = () => { if (UI.askCtl) UI.askCtl.abort(); UI.chat = []; render(); };
document.addEventListener("keydown", ev => { if (ev.key === "Enter" && !ev.shiftKey && ev.target.closest && ev.target.closest('form[data-form="lib-ask"]') && ev.target.name === "q") { ev.preventDefault(); ev.target.form.requestSubmit(); } });
ACTIONS["lib-passage"] = el => {
  const L = libData(), i = L.chunks.findIndex(c => c.id === el.dataset.id); if (i < 0) return; const c = L.chunks[i];
  openModal(`<h2>${esc(libRef(c))}</h2><p class="small muted">${esc(c.doc.title)}${c.doc.date ? " · " + esc(c.doc.date) : ""} · ${esc(c.doc.kind)}${c.doc.status === "Superseded" ? ' · <span class="badge warn">marked superseded</span>' : ""}</p>
   <div class="passage">${esc(c.text)}</div><p class="help">Text taken from the document. Layout (for example margin notes) may be out of order.</p>
   <div class="row">${L.chunks[i - 1] && L.chunks[i - 1].doc === c.doc ? `<button class="btn sm" data-act="lib-passage" data-id="${L.chunks[i - 1].id}">← Previous passage</button>` : ""}${L.chunks[i + 1] && L.chunks[i + 1].doc === c.doc ? `<button class="btn sm" data-act="lib-passage" data-id="${L.chunks[i + 1].id}">Next passage →</button>` : ""}<button class="btn sm" data-act="lib-open-doc" data-doc="${esc(c.doc.id)}" data-at="${esc(c.id)}">Open the whole document</button>${c.doc.url ? `<a class="btn sm" href="${esc(c.doc.url)}" target="_blank" rel="noopener">Original file</a>` : ""}</div>`, "wide");
};
ACTIONS["lib-open-doc"] = el => { closeModal(); UI.tab.library = "docs"; navTo("library", { kind: "libdoc", doc: el.dataset.doc, at: el.dataset.at }); setTimeout(() => { const t = document.getElementById("p-" + el.dataset.at); if (t) t.scrollIntoView({ block: "center" }); }, 50); };

/* ---------- Library page ---------- */
const libAdmin = () => Store.role() === "admin" && !Store.readOnly;
PAGES.library = () => {
  if (!window.LIBRARY) { if (LIB_STATE !== "failed") { libLoad(); return '<div class="card empty"><span class="typing">Loading the Port City library</span></div>'; }
    return '<div class="card empty"><p>The Port City library could not be loaded.</p><button class="btn p" data-act="lib-retry">Try again</button></div>'; }
  const t = curTab("library", "ask");
  const tabs = tabsHTML("library", [["ask", "Ask a question"], ["docs", "Documents and circulars"], ...(libAdmin() ? [["add", "Add a document"]] : [])]);
  const L = libData();
  const head = `<div class="head"><div class="t"><h1>Port City Library</h1><p class="muted">The Acts, regulations, gazettes, Commission forms and circulars the system is based on. Ask a question in plain English, or search and read the documents yourself.</p></div></div>`;
  if (t === "docs") return tabs + head + libDocsHTML();
  if (t === "add" && libAdmin()) return tabs + head + libAddHTML();
  return tabs + head + hlCards([{ value: L.docs.filter(d => d.status !== "Superseded").length, label: "Documents in use" }, { value: L.docs.filter(d => !d.builtin).length, label: "Added by your team", sub: "circulars and updates" }, { value: L.chunks.length, label: "Passages searched for each question" }, { value: L.docs.filter(d => d.date).map(d => d.date).sort().pop() || "—", label: "Newest document date" }]) + askHTML();
};
function libDocsHTML() {
  const L = libData(), q = UI.filter.lib || "", hits = q.trim().length > 1 ? libSearch(q, 12, { all: true }) : [];
  const kinds = {}; L.docs.forEach(d => (kinds[d.kind] = kinds[d.kind] || []).push(d));
  const terms = libToks(q);
  const mark = s => { let h = esc(s); terms.forEach(t => { if (t.length > 2) h = h.replace(new RegExp(`\\b(${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\w*)`, "gi"), "<mark>$1</mark>"); }); return h; };
  return `<div class="row"><input type="search" placeholder="Search all documents…" value="${esc(q)}" data-filter="lib" aria-label="Search documents" style="max-width:420px;width:100%"></div>
   ${q.trim().length > 1 ? `<div class="card"><h3>${hits.length} best matching passage(s)</h3>${hits.map(c => `<button class="hit" data-act="lib-passage" data-id="${esc(c.id)}"><b>${esc(libRef(c))}</b> <span class="small muted">${esc(c.doc.title)}</span><span>${mark(c.text.slice(0, 320))}…</span></button>`).join("") || '<p class="muted">Nothing matched. Try other words.</p>'}</div>` : ""}
   ${Object.entries(kinds).map(([k, ds]) => `<div class="card"><h3>${esc(k)}${k === "Commission form" ? "s" : ""}</h3><div class="tw"><table class="t"><thead><tr><th>Document</th><th>Date</th><th>Status</th><th class="num">Passages</th><th>Added</th>${libAdmin() ? "<th></th>" : ""}</tr></thead><tbody>
    ${ds.map(d => `<tr class="${d.status === "Superseded" ? "dim" : ""}"><td><a href="#" data-act="lib-doc" data-doc="${esc(d.id)}">${esc(d.title)}</a>${d.source ? `<div class="help">${esc(d.source)}</div>` : ""}</td><td class="nowrap">${esc(d.date || "")}</td><td>${badge(d.status === "Superseded" ? "Superseded" : "Current")}</td><td class="num">${L.chunks.filter(c => c.doc === d).length}</td><td class="small">${d.builtin ? "Supplied with the system" : esc(Store.name(d.added_by)) + " · " + esc((d.added_at || "").slice(0, 10))}</td>
     ${libAdmin() ? `<td class="nowrap"><button class="btn sm" data-act="lib-status" data-doc="${esc(d.id)}" data-builtin="${d.builtin ? 1 : 0}">${d.status === "Superseded" ? "Mark current" : "Mark superseded"}</button>${d.builtin ? "" : ` <button class="btn sm bad" data-act="lib-remove" data-doc="${esc(d.id)}">Remove</button>`}</td>` : ""}</tr>`).join("")}</tbody></table></div></div>`).join("")}
   <p class="small muted">Superseded documents are left out of answers but stay here for reference. ${libAdmin() ? "" : "Administrators can add circulars and mark documents superseded."}</p>`;
}
BADGE.Superseded = "warn"; BADGE.Current = "ok";
ACTIONS["lib-doc"] = el => go({ kind: "libdoc", doc: el.dataset.doc });
VIEWS.libdoc = ({ doc, at }) => {
  const L = libData(), d = L.docs.find(x => x.id === doc); if (!d) return '<p class="empty">Not found.</p>';
  const cs = L.chunks.filter(c => c.doc === d);
  return `<div class="head"><div class="t"><button class="link" data-act="back">← Library</button><h1>${esc(d.title)}</h1><p class="muted">${esc(d.kind)}${d.date ? " · " + esc(d.date) : ""} · ${cs.length} passages${d.source ? " · " + esc(d.source) : ""}</p>${d.status === "Superseded" ? '<p class="note warn">Marked superseded. Left out of answers.</p>' : ""}${d.notes ? `<p class="note small">${esc(d.notes)}</p>` : ""}</div>${d.url ? `<div class="acts"><a class="btn" href="${esc(d.url)}" target="_blank" rel="noopener">Original file</a></div>` : ""}</div>
   <div class="card doctext">${cs.map(c => `<div class="pas${c.id === at ? " at" : ""}" id="p-${esc(c.id)}"><div class="pref">${esc(libRef(c))}</div><div class="passage">${esc(c.text)}</div></div>`).join("")}</div>`;
};
ACTIONS["lib-status"] = async el => {
  const id = el.dataset.doc;
  if (el.dataset.builtin === "1") { const cur = Store.lib.libsettings.get("main") || {}, sup = new Set(cur.superseded || []); sup.has(id) ? sup.delete(id) : sup.add(id); await Store.libSave("libsettings", "main", { superseded: [...sup], updated_by: Store.uid, updated_at: nowIso() }); }
  else { const d = Store.lib.library.get(id); await Store.libSave("library", id, Object.assign({}, d, { id: undefined, status: d.status === "Superseded" ? "Current" : "Superseded" })); }
  await Store.audit("library", id, "Status changed", `Library document ${id} marked ${el.textContent.replace("Mark ", "")}`); toast("Updated.");
};
ACTIONS["lib-remove"] = el => confirmModal("Remove this document from the library? Answers will no longer use it.", async () => {
  const d = Store.lib.library.get(el.dataset.doc); await Store.libSave("library", d.id, Object.assign({}, d, { id: undefined, deleted: true }));
  await Store.audit("library", d.id, "Removed", `Library document removed: ${d.title}`); toast("Removed.");
});

/* ---------- Add a document ---------- */
function libAddHTML() {
  return `<form class="card f" data-form="lib-add" novalidate><h3>Add a circular or document</h3><p class="small muted">Added documents are shared with everyone who uses this page, across all companies, and are used to answer questions straight away. Add the text by uploading a PDF or text file, or paste it in.</p>
   <div class="grid3f">${fieldRow("Title", '<input name="title" required placeholder="e.g. Circular 03/2026 on annual returns">')}${fieldRow("Short name (used in citations)", '<input name="short" placeholder="e.g. Circular 03/2026">')}
   ${fieldRow("Type", `<select name="kind">${LIB_KINDS.map(k => `<option>${k}</option>`).join("")}</select>`)}${fieldRow("Date of the document", '<input type="date" name="date">')}
   ${fieldRow("Reference or where it came from", '<input name="source" placeholder="e.g. CPCEC email of 12 Oct 2026, Gazette No.">')}${fieldRow("Replaces (optional)", `<select name="replaces"><option value="">—</option>${libData().docs.filter(d => d.status !== "Superseded").map(d => `<option value="${esc(d.id)}|${d.builtin ? 1 : 0}">${esc(d.short || d.title)}</option>`).join("")}</select>`, "The replaced document is marked superseded.")}</div>
   ${fieldRow("File (PDF, TXT or MD)", '<input type="file" name="file" accept=".pdf,.txt,.md">', "Text is read from the PDF in your browser. Scanned PDFs without a text layer can't be read: paste the text instead.")}
   <div class="fld wide"><label for="lib_text">Or paste the text</label><textarea id="lib_text" name="text" rows="8" placeholder="Paste the text of the circular here"></textarea></div>
   ${fieldRow("Notes (optional)", '<input name="notes" placeholder="e.g. Applies only to BSI companies">')}
   <div class="row"><button class="btn p">Add to the library</button></div></form>`;
}
function libChunkPages(pages) { // pages: [[pageNo, text]] -> [[page, sec, text]]
  const out = [];
  for (const [pg, txt] of pages) {
    const paras = txt.replace(/\r/g, "").split(/\n\s*\n|(?<=\.)\n(?=[A-Z0-9(])/); let buf = "";
    for (const p of paras) { if ((buf + "\n" + p).length > 1500 && buf) { out.push([pg, secOf(buf), buf.trim()]); buf = ""; } buf += (buf ? "\n" : "") + p.trim(); while (buf.length > 2200) { out.push([pg, secOf(buf), buf.slice(0, 1500)]); buf = buf.slice(1500); } }
    if (buf.trim().length > 20) out.push([pg, secOf(buf), buf.trim()]);
  }
  return out;
}
function secOf(t) { const m = t.match(/(?:^|\n)\s*(\d{1,3}(?:\.\d{1,2})?)[.)]\s+[A-Z(]/); return m ? m[1] : ""; }
async function pdfText(file) {
  if (!window.pdfjsLib) { await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"); window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; }
  const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise, pages = [];
  for (let i = 1; i <= pdf.numPages; i++) { const tc = await (await pdf.getPage(i)).getTextContent(); let s = "", lastY = null;
    tc.items.forEach(it => { const y = it.transform[5]; if (lastY != null && Math.abs(y - lastY) > 2) s += "\n"; s += it.str + (it.hasEOL ? "\n" : ""); lastY = y; }); pages.push([i, s]); }
  return pages;
}
FORMS["lib-add"] = async form => {
  const o = readForm(form), file = form.file.files[0];
  if (!o.title.trim()) throw ["Enter a title."];
  let pages = [];
  if (file) { toast("Reading the file…", "info");
    if (/\.pdf$/i.test(file.name)) { try { pages = await pdfText(file); } catch (e) { throw ["The PDF could not be read. Paste the text instead."]; } }
    else pages = [[0, await file.text()]]; }
  if (o.text.trim()) pages.push([0, o.text]);
  const chunks = libChunkPages(pages.filter(p => p[1].trim()));
  if (!chunks.length) throw ["No text found. If the PDF is a scan, paste the text instead."];
  const id = rid(), parts = []; let cur = [], size = 0;
  for (const c of chunks) { const n = JSON.stringify(c).length; if (size + n > 180000 && cur.length) { parts.push(cur); cur = []; size = 0; } cur.push(c); size += n; }
  if (cur.length) parts.push(cur);
  let url = null, asset_id = null;
  if (file) { try { const assets = await window.claude?.use?.("assets"); if (assets) { const up = await assets.upload(file); url = up.url; asset_id = up.id; } } catch (e) { } }
  for (let p = 0; p < parts.length; p++) await Store.libSave("libtext", `${id}_${p}`, { doc: id, n: p, chunks: parts[p] });
  await Store.libSave("library", id, { title: o.title.trim(), short: (o.short || o.title).trim().slice(0, 60), kind: o.kind, date: o.date || null, source: o.source.trim() || null, notes: o.notes.trim() || null, status: "Current", parts: parts.length, passages: chunks.length, file_name: file ? file.name : null, url, asset_id, added_by: Store.uid, added_at: nowIso() });
  if (o.replaces) { const [rid_, b] = o.replaces.split("|"); await ACTIONS["lib-status"]({ dataset: { doc: rid_, builtin: b }, textContent: "Mark superseded" }); }
  await Store.audit("library", id, "Added", `Library document added: ${o.title} (${chunks.length} passages)`);
  UI.typing = false; UI.tab.library = "docs"; toast(`Added: ${chunks.length} passage(s) can now be used in answers.`); render();
};

