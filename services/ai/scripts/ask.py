"""Manual check of the running service. Usage: python scripts/ask.py "question" [more questions]"""
import json
import sys
import time

import httpx
import jwt

from app.config import settings

h = {"Authorization": "Bearer " + jwt.encode({"sub": "cli", "org": "cli-check", "aud": "quayzen-ai", "exp": time.time() + 300, "platform": True}, settings.ai_jwt_secret, algorithm="HS256")}
for q in sys.argv[1:]:
    t, out, ev, srcs, model = time.time(), "", None, [], None
    with httpx.stream("POST", "http://localhost:8100/v1/chat", headers=h, json={"question": q}, timeout=180) as r:
        for line in r.iter_lines():
            if line.startswith("event: "):
                ev = line[7:]
            elif line.startswith("data: "):
                d = json.loads(line[6:])
                if ev == "delta": out += d["text"]
                if ev == "sources": srcs = [s["id"] + "=" + s["ref"] for s in d["sources"]]
                if ev == "done": model = d.get("model")
                if ev == "error": out += f"\n[ERROR] {d['message']}"
    print(f"\nQ: {q}\n[{time.time()-t:.1f}s | model: {model}]\n{out}\nSources: {srcs[:4]}")
