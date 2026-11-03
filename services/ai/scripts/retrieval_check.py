"""Do these known questions retrieve the passage that actually answers them? Run after any retrieval change."""
from app.db import SessionLocal
from app.retrieval import search

CASES = [
    ("What happened to designated locations outside Port City?", "Gazette 2339/31"),
    ("When is the AP licence renewal fee due?", "Gazette 2387/38"),
    ("Which visas are available for Port City employees?", "Gazette 2360/24"),
    ("What must every Authorised Person do about tax returns?", "Amendment Act No. 1 of 2026"),
    ("What can a company do with Sri Lankan rupee payments?", "Gazette 2339/31"),
    ("How long is an AP licence valid?", "Act No. 11 of 2021"),
    ("What does the annual return ask about office space?", "Annual Return Form 2026"),
    ("Who must file a beneficial ownership declaration?", "UBO"),
    ("What are the rules for offshore banking?", "Gazette 2394"),
    ("What is the processing fee for an authorised person application?", "Gazette 2387/38"),
]
hit = 0
with SessionLocal() as db:
    for q, want in CASES:
        refs = [h.short or h.title for h in search(db, "eval", q)]
        rank = next((i + 1 for i, r in enumerate(refs) if want.lower() in r.lower()), None)
        hit += rank is not None
        print(f"{'ok ' if rank else 'MISS'} rank={rank} want={want!r} | {q}\n     got {refs[:4]}")
print(f"\n{hit}/{len(CASES)} found in the passages given to the model")
