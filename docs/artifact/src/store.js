/* ===== store.js ===== */
/* Data layer. Uses the artifact's shared database (db capability) when this
   view can run it, otherwise an in-memory store (nothing is saved; a banner says so).
   Layout: companies/{cid}  and  co/{cid}/{type}/{id}  and  co/{cid}/audit/{YYYY-MM}. */


const TYPES = [...Object.keys(REG), "bplans", "returns", "snapshots", "docs", "audit", "budgets", "inflows", "space"];
const nowIso = () => new Date().toISOString().slice(0, 19).replace("T", " ");
const today = () => new Date().toISOString().slice(0, 10);
const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const clone = o => JSON.parse(JSON.stringify(o));

const Store = {
  mode: "loading", db: null, user: null, uid: null, readOnly: false,
  companies: [], cid: null, data: {}, lib: { library: new Map(), libtext: new Map(), libsettings: new Map() }, unsubs: [], names: {}, preview: null, onChange: null, settings: {},

  async init() {
    let db = null, user = null;
    try { [db, user] = await Promise.all([window.claude?.use?.("db") ?? null, window.claude?.use?.("user") ?? null]); } catch (e) { db = null; }
    this.user = user;
    if (user) { try { this.uid = await user.id(); } catch (e) { this.uid = null; } }
    if (db && this.uid) {
      this.db = db; this.mode = "db";
      try { const w = await user.can("data.write"); if (w === false) this.readOnly = true; } catch (e) { }
      this.db.collection("companies").onSnapshot(s => {
        this.companies = s.docs.map(d => Object.assign({ id: d.id }, d.data()));
        this._pickCompany(); this._changed();
      }, e => this._dbError(e));
      for (const c of ["library", "libtext", "libsettings"]) this.db.collection(c).onSnapshot(sn => {
        const m = new Map(); sn.docs.forEach(d => m.set(d.id, Object.assign({ id: d.id }, d.data()))); this.lib[c] = m; this._libv = (this._libv || 0) + 1; this._changed();
      }, e => this._dbError(e));
    } else {
      this.mode = "memory"; this.uid = "local-user"; this.names[this.uid] = "You";
      this.companies = []; this._pickCompany(); this._changed();
    }
  },
  _dbError(e) { console.warn("db", e); if (e && e.code === "revoked") { this.readOnly = true; this._changed(); } },
  myCompanies() { return this.companies.filter(c => c.members && c.members[this.uid]).sort((a, b) => (a.name || "").localeCompare(b.name || "")); },
  _pickCompany() {
    const mine = this.myCompanies();
    let want = this.cid;
    if (!want) { try { want = localStorage.getItem("pcch.cid"); } catch (e) { } }
    if (!mine.find(c => c.id === want)) want = mine[0] ? mine[0].id : null;
    if (want !== this.cid) this.switchCompany(want);
  },
  switchCompany(cid) {
    this.unsubs.forEach(u => u()); this.unsubs = []; this.data = {}; TYPES.forEach(t => this.data[t] = new Map());
    this.cid = cid; this.preview = null;
    try { if (cid) localStorage.setItem("pcch.cid", cid); } catch (e) { }
    if (cid && this.mode === "db") {
      for (const t of TYPES) {
        this.unsubs.push(this.db.collection(`co/${cid}/${t}`).onSnapshot(s => {
          const m = new Map(); s.docs.forEach(d => m.set(d.id, Object.assign({ id: d.id }, d.data()))); this.data[t] = m; this._changed();
        }, e => this._dbError(e)));
      }
    }
    this._changed();
  },
  _changed() { if (this._raf) return; this._raf = requestAnimationFrame(() => { this._raf = null; this.onChange && this.onChange(); }); },

  company() { return this.companies.find(c => c.id === this.cid) || null; },
  realRole() { const c = this.company(); return c && c.members ? c.members[this.uid] : null; },
  role() { return this.preview || this.realRole(); },
  can(module, level = "read") {
    const r = this.role(); if (!r) return false;
    const code = PERM_CODES[r][MODULES.indexOf(module)];
    const L = { n: 0, r: 1, w: 2, a: 3 }, need = { read: 1, write: 2, approve: 3 }[level];
    return !this.readOnly || level === "read" ? L[code] >= need : false;
  },
  canSee(group) { return !group || (SENSITIVE_ACCESS[this.role()] || []).includes(group); },
  setting(k, d) { const c = this.company(); const s = (c && c.settings) || {}; return s[k] !== undefined ? s[k] : d; },

  list(type, opts = {}) {
    const m = this.data[type] || new Map();
    return [...m.values()].filter(x => opts.archived || !x.archived);
  },
  get(type, id) { return id ? (this.data[type] || new Map()).get(id) || null : null; },

  async _write(path, body) {
    if (this.mode === "db") {
      try { await this.db.doc(path).set(body); }
      catch (e) { if (e && e.code === "invalid_argument") this.readOnly = true; throw new Error(e && e.code === "quota_exceeded" ? "Storage is full. Archive or delete old records." : (e && e.message) || "Could not save."); }
    }
  },
  async save(type, obj, id) {
    if (this.readOnly) throw new Error("You can view this workspace but not change it.");
    const isNew = !id; id = id || rid();
    const before = this.get(type, id);
    const rec = Object.assign({}, before || {}, obj);
    delete rec.id;
    const ts = nowIso();
    if (isNew) { rec.created_at = ts; rec.created_by = this.uid; rec.data_source = rec.data_source || "Manual"; }
    rec.updated_at = ts; rec.updated_by = this.uid;
    for (const k of Object.keys(rec)) if (rec[k] === undefined) rec[k] = null;
    this.data[type].set(id, Object.assign({ id }, rec)); this._changed();
    await this._write(`co/${this.cid}/${type}/${id}`, rec);
    return id;
  },
  async saveCompany(patch, cid = this.cid) {
    if (this.readOnly) throw new Error("You can view this workspace but not change it.");
    const c = this.companies.find(x => x.id === cid) || {};
    const rec = Object.assign({}, c, patch); delete rec.id;
    rec.updated_at = nowIso(); rec.updated_by = this.uid;
    for (const k of Object.keys(rec)) if (rec[k] === undefined) rec[k] = null;
    const i = this.companies.findIndex(x => x.id === cid);
    if (i >= 0) this.companies[i] = Object.assign({ id: cid }, rec); else this.companies.push(Object.assign({ id: cid }, rec));
    this._changed();
    await this._write(`companies/${cid}`, rec);
  },
  /* Shared Port City library (not per company): library/{id}, libtext/{id}_{n}, libsettings/main */
  async libSave(coll, id, body) {
    if (this.readOnly) throw new Error("You can view this workspace but not change it.");
    body = Object.assign({}, body); for (const k of Object.keys(body)) if (body[k] === undefined) body[k] = null;
    this.lib[coll].set(id, Object.assign({ id }, body)); this._libv = (this._libv || 0) + 1; this._changed();
    await this._write(`${coll}/${id}`, body);
  },
  async createCompany(name, isDemo) {
    const cid = rid();
    await this.saveCompany({ name, is_demo: !!isDemo, members: { [this.uid]: "admin" }, created_at: nowIso(), created_by: this.uid,
      settings: { separate_reviewer: true, rem_requests: 7, rem_obligations: 30, rem_visas: 90, rem_passports: 180 } }, cid);
    this.switchCompany(cid);
    for (const [title, category, body] of RESPONSE_TEMPLATES) await this.save("templates", { title, category, body });
    await this.audit("companies", cid, "Created", `Company '${name}' created`);
    return cid;
  },
  async audit(entity, recId, action, summary, changes) {
    if (!this.cid) return;
    // One or more documents per month (YYYY-MM, YYYY-MM_1, ...) so no single document grows past the storage limit.
    const month = today().slice(0, 7), seq = d => d.id === month ? 0 : parseInt(d.id.split("_")[1] || "0", 10);
    const cur = this.list("audit").filter(d => d.id === month || d.id.startsWith(month + "_")).sort((a, b) => seq(b) - seq(a))[0];
    let id = cur ? cur.id : month, entries = cur ? (cur.entries || []).slice() : [];
    if (entries.length >= 250 || JSON.stringify(entries).length > 150000) { id = `${month}_${cur ? seq(cur) + 1 : 1}`; entries = []; }
    const cut = (v, n) => v == null ? null : String(v).slice(0, n);
    entries.push({ at: nowIso(), by: this.uid, entity, rec: recId || null, action, summary: cut(summary || "", 300),
      changes: changes ? changes.slice(0, 20).map(c => ({ label: cut(c.label, 80), old: cut(c.old, 200), new: cut(c.new, 200) })) : null });
    this.data.audit.set(id, { id, entries }); this._changed();
    try { await this._write(`co/${this.cid}/audit/${id}`, { entries }); } catch (e) { console.warn(e); }
  },
  history(entity, recId) {
    const all = []; this.list("audit").forEach(d => (d.entries || []).forEach(e => all.push(e)));
    return all.filter(e => (!entity || e.entity === entity) && (!recId || e.rec === recId)).sort((a, b) => b.at.localeCompare(a.at));
  },
  async resolveNames(ids) {
    ids = [...new Set(ids.filter(x => x && !this.names[x]))];
    if (!ids.length || !this.user) return;
    try { const ps = await this.user.profiles(ids); for (const id of ids) this.names[id] = (ps[id] && ps[id].name) || (id === this.uid ? "You" : "Team member"); this._changed(); } catch (e) { }
  },
  name(uid) {
    if (!uid) return "";
    if (String(uid).startsWith("demo:")) return uid.slice(5);
    if (!this.names[uid]) { this.resolveNames([uid]); return uid === this.uid ? "You" : "…"; }
    return this.names[uid];
  },
};

