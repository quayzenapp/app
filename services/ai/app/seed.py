"""Idempotent. Default models, plus the built-in legal library from the artifact as shared documents.
Usage: python -m app.seed [path/to/library.json]"""
import json
import sys

from app.db import SessionLocal
from app.indexing import ensure_vector_index
from app.models import AiModel, Chunk, Document, IngestJob

DEFAULTS = [
    dict(provider="local", model_id="BAAI/bge-small-en-v1.5", label="Local: BGE small (free, stays on our server)", purpose="embedding", is_default=True, dimensions=384),
    dict(provider="openrouter", model_id="openrouter/free", label="OpenRouter: free auto-router", purpose="chat", is_default=True),
]


def main() -> None:
    with SessionLocal() as db:
        for d in DEFAULTS:
            m = db.query(AiModel).filter_by(provider=d["provider"], model_id=d["model_id"], purpose=d["purpose"]).first()
            if not m:
                if db.query(AiModel).filter_by(purpose=d["purpose"], is_default=True).first():
                    d = {**d, "is_default": False}
                m = AiModel(**d)
                db.add(m)
                db.commit()
            if m.purpose == "embedding":
                ensure_vector_index(db, m)
        if len(sys.argv) > 1:
            lib = json.load(open(sys.argv[1]))
            added = 0
            for idx, meta in enumerate(lib["docs"]):
                if db.query(Document).filter(Document.organization_id.is_(None), Document.source == f"builtin:{meta['id']}").first():
                    continue
                rows = [c for c in lib["chunks"] if c[0] == idx]
                d = Document(organization_id=None, title=meta["title"], short=meta.get("short"), kind=meta.get("kind", "Other"), doc_date=meta.get("date"), source=f"builtin:{meta['id']}", chunk_count=len(rows))
                db.add(d)
                db.flush()
                db.add_all(Chunk(document_id=d.id, organization_id=None, seq=i, page=c[1] or None, section=c[2] or None, text_=c[3]) for i, c in enumerate(rows))
                db.add(IngestJob(document_id=d.id))
                added += 1
            db.commit()
            print(f"Queued {added} library documents")
    print("Seed complete")


if __name__ == "__main__":
    main()
