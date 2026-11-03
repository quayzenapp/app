#!/usr/bin/env python3
"""Decode the Commission's original forms from the artifact's js/forms/*.js. Static parse only: never runs artifact code."""
import base64, glob, os, re, sys
root = sys.argv[1]
for f in sorted(glob.glob(f"{root}/docs/artifact/data/js/forms/*.js")):
    s = open(f, errors="replace").read()
    m = max(re.finditer(r'["\'`]([A-Za-z0-9+/=\\n\s]{1000,})["\'`]', s), key=lambda x: len(x.group(1)), default=None)
    name = os.path.basename(f)[:-3]
    if not m:
        print(f"{name:9} NO BASE64 head={s[:90]!r}"); continue
    b = base64.b64decode(re.sub(r"[^A-Za-z0-9+/=]", "", m.group(1).replace("\\n", "")))
    kind = "pdf" if b[:4] == b"%PDF" else "zip" if b[:2] == b"PK" else "doc" if b[:4] == b"\xd0\xcf\x11\xe0" else "bin"
    if kind == "zip":
        import io, zipfile
        names = zipfile.ZipFile(io.BytesIO(b)).namelist()
        kind = "docx" if any(n.startswith("word/") for n in names) else "xlsx" if any(n.startswith("xl/") for n in names) else "zip"
    open(f"{root}/apps/web/assets/forms/{name}.{kind}", "wb").write(b)
    print(f"{name:9} {kind:5} {len(b):>8}  {s[:95]!r}")
