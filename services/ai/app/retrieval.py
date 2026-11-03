import re
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.providers import default_model, get_provider

RRF_K = 60
POOL = 40
MAX_PER_DOC = 3
STOP = set("the a an of and or to in for on by with is are be as at from that this which any such shall may under its it than other into not no do does what when how who where can i we our us you your there been has have had was were will would should could about".split())
SCOPE = "(c.organization_id IS NULL OR c.organization_id = :org)"
READY = "d.status = 'ready' AND d.superseded = false"


@dataclass
class Hit:
    chunk_id: str
    document_id: str
    title: str
    short: str | None
    page: int | None
    section: str | None
    text: str
    score: float


def _fts_query(q: str) -> str:
    toks = [t for t in re.findall(r"[a-z0-9]+", q.lower()) if len(t) > 1 and t not in STOP]
    return " | ".join(dict.fromkeys(toks))


def search(db: Session, org_id: str, query: str, top_k: int | None = None) -> list[Hit]:
    """Hybrid search. The tenant filter is in both SQL statements, so a hit can only be shared or this org's."""
    top_k = top_k or settings.retrieve_top_k
    model = default_model(db, "embedding")
    vec = get_provider(db, model.provider).embed(model.model_id, [query], True, {**(model.params or {}), "dimensions": model.dimensions})[0]
    dim = int(model.dimensions or len(vec))
    db.execute(text("SET LOCAL hnsw.iterative_scan = relaxed_order"))
    db.execute(text("SET LOCAL hnsw.ef_search = 100"))
    vec_rows = db.execute(text(f"""
        SELECT c.id, 1 - ((e.embedding::vector({dim})) <=> CAST(:q AS vector({dim}))) AS sim
        FROM chunk_embeddings e JOIN chunks c ON c.id = e.chunk_id JOIN documents d ON d.id = c.document_id
        WHERE e.model_pk = :m AND {SCOPE} AND {READY}
        ORDER BY (e.embedding::vector({dim})) <=> CAST(:q AS vector({dim})) LIMIT 40"""), {"q": str(vec), "m": model.id, "org": org_id}).all()
    ftsq = _fts_query(query)
    fts_rows = db.execute(text(f"""
        SELECT c.id FROM chunks c JOIN documents d ON d.id = c.document_id, to_tsquery('english', :q) q
        WHERE c.tsv @@ q AND {SCOPE} AND {READY}
        ORDER BY ts_rank_cd(c.tsv, q) DESC LIMIT 40"""), {"q": ftsq, "org": org_id}).all() if ftsq else []
    # Exact references such as "2339/31" or "No. 11" must find their document, even if only its name holds them.
    exact_rows = []
    refs = re.findall(r"\b\d+/\d+\b", query)
    if refs:
        exact_rows = db.execute(text(f"""
            SELECT c.id FROM chunks c JOIN documents d ON d.id = c.document_id
            WHERE {SCOPE} AND {READY} AND (d.short ILIKE ANY(:p) OR d.title ILIKE ANY(:p) OR c.text ILIKE ANY(:p))
            ORDER BY (d.short ILIKE ANY(:p) OR d.title ILIKE ANY(:p)) DESC, c.seq LIMIT 20"""), {"p": [f"%{r}%" for r in refs], "org": org_id}).all()
    # A vector match below the floor doesn't count: this is how "not in the documents" is detected.
    # The floor is per model, because scores from different embedding models aren't comparable.
    floor = float((model.params or {}).get("min_similarity", settings.min_similarity))
    scores: dict[str, float] = {}
    for rank, r in enumerate(x for x in vec_rows if x.sim >= floor):
        scores[r.id] = scores.get(r.id, 0) + 1 / (RRF_K + rank)
    for rank, r in enumerate(exact_rows):
        scores[r.id] = scores.get(r.id, 0) + 2 / (RRF_K + rank)
    # Keywords refine a relevant result. Alone, one common word mustn't make an off-topic question look answerable.
    if scores:
        for rank, r in enumerate(fts_rows):
            scores[r.id] = scores.get(r.id, 0) + 1 / (RRF_K + rank)
    ids = sorted(scores, key=lambda i: -scores[i])[:POOL]
    if not ids:
        return []
    rows = db.execute(text(f"""
        SELECT c.id, c.document_id, d.title, d.short, c.page, c.section, c.text
        FROM chunks c JOIN documents d ON d.id = c.document_id WHERE c.id = ANY(:ids) AND {SCOPE}"""), {"ids": ids, "org": org_id}).all()
    by = {r.id: r for r in rows}
    # One long document mustn't crowd out the regulation that actually answers the question.
    out: list[Hit] = []
    per_doc: dict[str, int] = {}
    for i in ids:
        r = by.get(i)
        if r and per_doc.get(r.document_id, 0) < MAX_PER_DOC:
            per_doc[r.document_id] = per_doc.get(r.document_id, 0) + 1
            out.append(Hit(r.id, r.document_id, r.title, r.short, r.page, r.section, r.text, scores[r.id]))
    return out[:top_k]
