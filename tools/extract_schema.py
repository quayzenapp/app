#!/usr/bin/env python3
"""Statically parse docs/artifact/src/schema.js into seed JSON. Never executes artifact code."""
import json, re, sys
ROOT = sys.argv[1]
src = open(f"{ROOT}/docs/artifact/src/schema.js").read()
lic = open(f"{ROOT}/docs/artifact/src/lic_core.js").read() + open(f"{ROOT}/docs/artifact/src/x_dev.js").read() + open(f"{ROOT}/docs/artifact/src/x_check.js").read()

class P:
    def __init__(s, t, env): s.t, s.i, s.env = t, 0, env
    def ws(s):
        while True:
            m = re.compile(r"\s+|//[^\n]*|/\*.*?\*/", re.S).match(s.t, s.i)
            if not m: return
            s.i = m.end()
    def peek(s): s.ws(); return s.t[s.i]
    def eat(s, c):
        s.ws()
        if s.t[s.i] != c: raise ValueError(f"want {c} at {s.t[s.i-30:s.i+30]!r}")
        s.i += 1
    def string(s):
        q = s.t[s.i]; s.i += 1; o = []
        while s.t[s.i] != q:
            if s.t[s.i] == "\\":
                s.i += 1; c = s.t[s.i]; o.append({"n": "\n", "t": "\t"}.get(c, c))
            else: o.append(s.t[s.i])
            s.i += 1
        s.i += 1; return "".join(o)
    def value(s):
        c = s.peek()
        if c in "\"'`": return s.string()
        if c == "[": return s.array()
        if c == "{": return s.obj()
        m = re.compile(r"-?\d+(\.\d+)?").match(s.t, s.i)
        if m: s.i = m.end(); return float(m.group()) if m.group(1) else int(m.group())
        m = re.compile(r"[A-Za-z_]\w*").match(s.t, s.i); s.i = m.end(); w = m.group()
        if w in ("true", "false"): return w == "true"
        if w == "null": return None
        if s.peek() == "(": return s.call(w)
        return s.env[w]
    def call(s, f):
        s.eat("("); a = []
        while s.peek() != ")":
            a.append(s.value())
            if s.peek() == ",": s.eat(",")
        s.eat(")")
        if f == "F":
            d = {"name": a[0], "label": a[1], "type": a[2] if len(a) > 2 else "text"}
            if len(a) > 3: d.update(a[3])
            return d
        if f == "money": return money(a[0] if a else True)
        raise ValueError(f)
    def array(s):
        s.eat("["); o = []
        while s.peek() != "]":
            if s.t.startswith("...", s.i): s.i += 3; o.extend(s.value())
            else: o.append(s.value())
            if s.peek() == ",": s.eat(",")
        s.eat("]"); return o
    def obj(s):
        s.eat("{"); o = {}
        while s.peek() != "}":
            if s.t[s.i] in "\"'": k = s.string()
            else:
                m = re.compile(r"\w+").match(s.t, s.i); s.i = m.end(); k = m.group()
            if s.peek() == ":": s.eat(":"); o[k] = s.value()
            else: o[k] = s.env[k] if k in s.env else (True if k == "required" else None)
            if s.peek() == ",": s.eat(",")
        s.eat("}"); return o

env = {"YES_NO": ["Yes", "No"], "YES_NO_TBC": ["Yes", "No", "To be confirmed"], "YES_NO_NA": ["Yes", "No", "Not applicable"]}
def money(required=True):
    g = "Amount and currency"
    b = re.search(r"return \[\s*(F\(\"original_amount\".*?)\n  \];", src, re.S).group(1)
    e = dict(env, required=required, g=g, group=g)
    return P("[" + b.replace("{ required,", "{ required: REQ,").replace("group: g", "group: GRP") + "]", dict(e, REQ=required, GRP=g)).array()
def const(name):
    m = re.search(r"const " + name + r"\s*=\s*", src)
    return P(src[m.end():], env).value()
out = {n: const(n) for n in ["LOOKUPS", "ROLES", "MODULES", "PERM_CODES", "SENSITIVE_ACCESS", "SENSITIVE_LABELS", "OBLIGATION_LIBRARY", "LEGAL_REFS", "RESPONSE_TEMPLATES", "BP_SECTIONS", "BP_YEAR_FIELDS"]}
out["REG"] = {}
for m in re.finditer(r'^reg\("(\w+)",\s*', src, re.M):
    d = P(src[m.end():], env).obj(); d["key"] = m.group(1); d.setdefault("title", d["fields"][0]["name"]); out["REG"][m.group(1)] = d
# later modules append one column per Object.assign(PERM_CODES, ...)
out["MODULES"] += ["licensing", "development", "checklists"]
for m in re.finditer(r"Object\.assign\(PERM_CODES, \{(.*?)\}\)", lic, re.S):
    for r in re.finditer(r'(\w+): PERM_CODES\.\w+ \+ "(\w+)"', m.group(1)): out["PERM_CODES"][r.group(1)] += r.group(2)
assert all(len(v) == len(out["MODULES"]) for v in out["PERM_CODES"].values()), out["PERM_CODES"]
json.dump(out, open(f"{ROOT}/apps/web/prisma/seed-data/artifact-schema.json", "w"), indent=1)
print(len(out["REG"]), "forms:", ",".join(out["REG"]))
print(out["PERM_CODES"]); print("field types", sorted({f["type"] for r in out["REG"].values() for f in r["fields"]}))
print("lookups", len(out["LOOKUPS"]), "| investments fields", len(out["REG"]["investments"]["fields"]))
