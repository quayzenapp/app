import hashlib
import uuid
from pathlib import Path

import httpx
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import or_, select, update
from sqlalchemy.orm import Session

from app import secrets_store
from app.auth import Caller, admin, caller, platform
from app.chat import answer
from app.config import settings
from app.db import get_db
from app.indexing import ensure_vector_index
from app.models import AiModel, ChunkEmbedding, Chunk, Conversation, Document, IngestJob, Message
from app.providers import PROVIDERS, get_provider
from app.providers.base import ProviderError
from app.retrieval import search

app = FastAPI(title="Quayzen AI", docs_url=None, redoc_url=None, openapi_url=None)
ALLOWED = {".pdf", ".docx", ".xlsx", ".txt", ".md"}
KINDS = ["Circular", "Act", "Regulations", "Rules", "Gazette notice", "Commission form", "Commission guidance", "Other"]


def visible(c: Caller):
    return or_(Document.organization_id.is_(None), Document.organization_id == c.org_id)


def editable(db: Session, doc_id: str, c: Caller) -> Document:
    d = db.get(Document, doc_id)
    # Same 404 for other tenants' documents, so ids can't be probed.
    if not d or not (d.organization_id == c.org_id or (d.organization_id is None and c.platform)):
        raise HTTPException(404, "Document not found")
    return d


def doc_json(d: Document) -> dict:
    return {"id": d.id, "title": d.title, "short": d.short, "kind": d.kind, "doc_date": d.doc_date, "source": d.source, "notes": d.notes, "status": d.status, "error": d.error, "filename": d.filename, "superseded": d.superseded, "chunk_count": d.chunk_count, "shared": d.organization_id is None, "created_at": d.created_at.isoformat()}


@app.get("/healthz")
def healthz():
    return {"ok": True}


@app.post("/v1/documents", status_code=201)
def upload(file: UploadFile = File(...), title: str = Form(...), short: str = Form(""), kind: str = Form("Other"), doc_date: str = Form(""), source: str = Form(""), notes: str = Form(""), shared: bool = Form(False), db: Session = Depends(get_db), c: Caller = Depends(admin)):
    if shared and not c.platform:
        raise HTTPException(403, "Only platform administrators can add to the shared library.")
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED:
        raise HTTPException(400, "This file type isn't supported. Use PDF, Word (.docx), Excel (.xlsx), TXT or Markdown.")
    limit = settings.max_upload_mb * 1024 * 1024
    folder = Path(settings.ai_data_dir) / "uploads"
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{uuid.uuid4().hex}{ext}"  # never built from the uploaded name
    h, size = hashlib.sha256(), 0
    with path.open("wb") as out:
        while chunk := file.file.read(1024 * 1024):
            size += len(chunk)
            if size > limit:
                out.close()
                path.unlink(missing_ok=True)
                raise HTTPException(413, f"Files can be up to {settings.max_upload_mb} MB.")
            h.update(chunk)
            out.write(chunk)
    d = Document(organization_id=None if shared else c.org_id, title=title.strip()[:500], short=short.strip()[:200] or None, kind=kind if kind in KINDS else "Other", doc_date=doc_date or None, source=source or None, notes=notes or None, file_path=str(path), filename=(file.filename or "")[:300], sha256=h.hexdigest(), uploaded_by=c.user_id)
    db.add(d)
    db.flush()
    db.add(IngestJob(document_id=d.id))
    db.commit()
    return doc_json(d)


@app.get("/v1/documents")
def list_documents(db: Session = Depends(get_db), c: Caller = Depends(caller)):
    return [doc_json(d) for d in db.scalars(select(Document).where(visible(c)).order_by(Document.created_at.desc()))]


@app.delete("/v1/documents/{doc_id}", status_code=204)
def delete_document(doc_id: str, db: Session = Depends(get_db), c: Caller = Depends(admin)):
    d = editable(db, doc_id, c)
    if d.file_path:
        Path(d.file_path).unlink(missing_ok=True)
    db.delete(d)
    db.commit()


class DocPatch(BaseModel):
    superseded: bool | None = None


@app.patch("/v1/documents/{doc_id}")
def patch_document(doc_id: str, p: DocPatch, db: Session = Depends(get_db), c: Caller = Depends(admin)):
    d = editable(db, doc_id, c)
    if p.superseded is not None:
        d.superseded = p.superseded
    db.commit()
    return doc_json(d)


@app.post("/v1/documents/{doc_id}/reindex")
def reindex(doc_id: str, db: Session = Depends(get_db), c: Caller = Depends(admin)):
    d = editable(db, doc_id, c)
    d.status, d.error = "pending", None
    db.add(IngestJob(document_id=d.id))
    db.commit()
    return doc_json(d)


class ChatIn(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    conversation_id: str | None = None


@app.post("/v1/chat")
def chat(body: ChatIn, db: Session = Depends(get_db), c: Caller = Depends(caller)):
    return StreamingResponse(answer(db, c.org_id, c.user_id, body.question.strip(), body.conversation_id), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


class SearchIn(BaseModel):
    query: str = Field(min_length=1, max_length=1000)


@app.post("/v1/search")
def do_search(body: SearchIn, db: Session = Depends(get_db), c: Caller = Depends(caller)):
    try:
        return [{"ref": h.short or h.title, "page": h.page, "text": h.text[:500], "document_id": h.document_id} for h in search(db, c.org_id, body.query)]
    except ProviderError as e:
        raise HTTPException(502, str(e)) from e


@app.get("/v1/conversations/{cid}/messages")
def messages(cid: str, db: Session = Depends(get_db), c: Caller = Depends(caller)):
    conv = db.query(Conversation).filter_by(id=cid, organization_id=c.org_id, user_id=c.user_id).first()
    if not conv:
        raise HTTPException(404, "Not found")
    return [{"role": m.role, "content": m.content, "sources": m.sources} for m in db.query(Message).filter_by(conversation_id=cid).order_by(Message.created_at)]


# ---------- model configuration: platform administrators only ----------
def model_json(m: AiModel) -> dict:
    return {"id": m.id, "provider": m.provider, "model_id": m.model_id, "label": m.label, "purpose": m.purpose, "is_default": m.is_default, "enabled": m.enabled, "fallback_order": m.fallback_order, "dimensions": m.dimensions, "params": m.params}


class ModelIn(BaseModel):
    provider: str
    model_id: str = Field(min_length=1, max_length=200)
    label: str = Field(min_length=1, max_length=200)
    purpose: str = Field(pattern="^(chat|embedding)$")
    fallback_order: int | None = None
    dimensions: int | None = Field(default=None, ge=1, le=2000)
    params: dict = Field(default_factory=dict)


class ModelPatch(BaseModel):
    enabled: bool | None = None
    is_default: bool | None = None
    fallback_order: int | None = None
    clear_fallback: bool = False


class CredIn(BaseModel):
    secret: dict | None = None
    config: dict | None = None


@app.get("/v1/models")
def list_models(db: Session = Depends(get_db), _: Caller = Depends(platform)):
    default_embed = db.query(AiModel).filter_by(purpose="embedding", is_default=True).first()
    pending = 0
    if default_embed:
        pending = db.query(Chunk).filter(~Chunk.id.in_(select(ChunkEmbedding.chunk_id).where(ChunkEmbedding.model_pk == default_embed.id))).count()
    return {"models": [model_json(m) for m in db.query(AiModel).order_by(AiModel.purpose, AiModel.fallback_order.nulls_last(), AiModel.label)],
            "providers": {p: {"has_secret": secrets_store.has_secret(db, p), "config": secrets_store.load(db, p)[1]} for p in PROVIDERS},
            "chunks_needing_embedding": pending}


@app.post("/v1/models", status_code=201)
def add_model(body: ModelIn, db: Session = Depends(get_db), _: Caller = Depends(platform)):
    if body.provider not in PROVIDERS:
        raise HTTPException(400, "Unknown provider")
    if db.query(AiModel).filter_by(provider=body.provider, model_id=body.model_id, purpose=body.purpose).first():
        raise HTTPException(409, "This model is already configured.")
    m = AiModel(**body.model_dump())
    db.add(m)
    db.commit()
    return model_json(m)


@app.patch("/v1/models/{mid}")
def patch_model(mid: str, p: ModelPatch, db: Session = Depends(get_db), _: Caller = Depends(platform)):
    m = db.get(AiModel, mid)
    if not m:
        raise HTTPException(404, "Not found")
    if p.enabled is not None:
        m.enabled = p.enabled
    if p.clear_fallback:
        m.fallback_order = None
    elif p.fallback_order is not None:
        m.fallback_order = p.fallback_order
    if p.is_default:
        db.execute(update(AiModel).where(AiModel.purpose == m.purpose).values(is_default=False))
        m.is_default, m.enabled = True, True
    db.commit()
    return model_json(m)


@app.delete("/v1/models/{mid}", status_code=204)
def delete_model(mid: str, db: Session = Depends(get_db), _: Caller = Depends(platform)):
    m = db.get(AiModel, mid)
    if m and m.is_default:
        raise HTTPException(400, "Choose another default before removing this model.")
    if m:
        db.delete(m)
        db.commit()


@app.post("/v1/models/{mid}/test")
def test_model(mid: str, db: Session = Depends(get_db), _: Caller = Depends(platform)):
    m = db.get(AiModel, mid)
    if not m:
        raise HTTPException(404, "Not found")
    try:
        p = get_provider(db, m.provider)
        if m.purpose == "embedding":
            v = p.embed(m.model_id, ["Quayzen connection test"], True, {**(m.params or {}), "dimensions": m.dimensions})[0]
            if not m.dimensions:
                m.dimensions = len(v)
                db.commit()
            return {"ok": True, "detail": f"Returned a vector of {len(v)} dimensions."}
        out = "".join(p.chat_stream(m.model_id, "Reply with one short sentence.", [{"role": "user", "content": "Say hello."}], {"max_tokens": 40}))
        return {"ok": bool(out), "detail": out[:200] or "The model returned an empty reply."}
    except ProviderError as e:
        return {"ok": False, "detail": str(e)}


@app.post("/v1/models/reindex-all")
def reindex_all(db: Session = Depends(get_db), _: Caller = Depends(platform)):
    """Queues every ready document so chunks get vectors from the current default embedding model."""
    default = db.query(AiModel).filter_by(purpose="embedding", is_default=True).first()
    if default:
        ensure_vector_index(db, default)
    docs = db.scalars(select(Document).where(Document.status.in_(["ready", "failed"]))).all()
    for d in docs:
        d.status = "pending"
        db.add(IngestJob(document_id=d.id))
    db.commit()
    return {"queued": len(docs)}


@app.put("/v1/providers/{provider}")
def set_credentials(provider: str, body: CredIn, db: Session = Depends(get_db), _: Caller = Depends(platform)):
    if provider not in PROVIDERS:
        raise HTTPException(404, "Unknown provider")
    secrets_store.save_secret(db, provider, body.secret, body.config)
    return {"ok": True, "has_secret": secrets_store.has_secret(db, provider)}


@app.get("/v1/providers/openrouter/free-models")
def free_models(_: Caller = Depends(platform)):
    """Live list: free models come and go, so don't hard-code them."""
    try:
        chat = httpx.get(f"{settings.openrouter_base_url}/models", timeout=20).json()["data"]
        emb = httpx.get(f"{settings.openrouter_base_url}/embeddings/models", timeout=20).json()["data"]
    except Exception as e:
        raise HTTPException(502, "Could not reach OpenRouter.") from e
    free = lambda m: m["id"].endswith(":free") or m["id"] == "openrouter/free"
    pick = lambda ms: sorted(({"id": m["id"], "name": m.get("name", m["id"]), "context": m.get("context_length")} for m in ms if free(m)), key=lambda x: -(x["context"] or 0))
    return {"chat": pick(chat), "embedding": pick(emb)}
