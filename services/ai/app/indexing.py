import re

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models import AiModel


def ensure_vector_index(db: Session, m: AiModel) -> None:
    """A partial HNSW index per embedding model. Each model has its own fixed vector size."""
    if not m.dimensions:
        return
    if not re.fullmatch(r"[0-9a-f]{32}", m.id) or not 1 <= int(m.dimensions) <= 2000:
        raise ValueError("HNSW supports up to 2000 dimensions")
    db.execute(text(f"CREATE INDEX IF NOT EXISTS ce_hnsw_{m.id} ON chunk_embeddings USING hnsw ((embedding::vector({int(m.dimensions)})) vector_cosine_ops) WHERE model_pk = '{m.id}'"))
    db.commit()
