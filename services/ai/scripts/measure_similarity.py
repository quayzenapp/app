"""Prints the best vector similarity per question. Use it to choose min_similarity after changing embedding model."""
from sqlalchemy import text
from app.db import SessionLocal
from app.providers import default_model, get_provider

ON = ["When is the AP licence renewal fee due?", "Which visas are available for Port City employees?", "What happened to designated locations outside Port City?", "What must every Authorised Person do about tax returns?", "How long is an AP licence valid?", "What can a company do with Sri Lankan rupee payments?", "What does the annual return ask about office space?", "Who is a beneficial owner?", "What fee applies to a development permit?", "what are the rules for offshore banking", "Can I hire foreign staff?", "do we need approval to change directors"]
OFF = ["What is the recipe for chocolate cake?", "Who won the 2022 football world cup?", "How do I fix a flat bicycle tyre?", "What is the capital of France?", "Write me a poem about the sea", "What is the best laptop for gaming?", "How tall is Mount Everest?", "What time does the supermarket open?", "How do I bake sourdough bread?", "What is the weather tomorrow?"]
with SessionLocal() as db:
    m = default_model(db, "embedding")
    p = get_provider(db, m.provider)
    d = int(m.dimensions)
    for name, qs in (("ON", ON), ("OFF", OFF)):
        for q in qs:
            v = p.embed(m.model_id, [q], True, {})[0]
            s = db.execute(text(f"SELECT 1-((embedding::vector({d})) <=> CAST(:q AS vector({d}))) FROM chunk_embeddings WHERE model_pk=:m ORDER BY (embedding::vector({d})) <=> CAST(:q AS vector({d})) LIMIT 1"), {"q": str(v), "m": m.id}).scalar()
            print(f"{name:3} {s:.3f} {q}")
