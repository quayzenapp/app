import re
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.config import settings
from app.indexing import ensure_vector_index
from app.models import Chunk, ChunkEmbedding, Document
from app.providers import default_model, get_provider

EMBED_BATCH = 32


class IngestError(Exception):
    pass


def extract_pages(path: Path) -> list[tuple[int | None, str]]:
    ext = path.suffix.lower()
    if ext == ".pdf":
        from pypdf import PdfReader
        pages = [(i + 1, (p.extract_text() or "")) for i, p in enumerate(PdfReader(str(path)).pages)]
        if sum(len(t.strip()) for _, t in pages) < 50:
            raise IngestError("No text could be read from this PDF. It may be a scan. Upload a version with a text layer, or a Word or text copy.")
        return pages
    if ext == ".docx":
        import docx
        d = docx.Document(str(path))
        parts = [p.text for p in d.paragraphs if p.text.strip()]
        for t in d.tables:
            parts += [" | ".join(c.text.strip() for c in r.cells) for r in t.rows]
        return [(None, "\n\n".join(parts))]
    if ext == ".xlsx":
        from openpyxl import load_workbook
        wb = load_workbook(str(path), read_only=True, data_only=True)
        return [(None, f"Sheet: {ws.title}\n" + "\n".join(" | ".join("" if c is None else str(c) for c in row) for row in ws.iter_rows(values_only=True))) for ws in wb]
    if ext in (".txt", ".md"):
        return [(None, path.read_text(errors="replace"))]
    raise IngestError("This file type isn't supported. Use PDF, Word (.docx), Excel (.xlsx), TXT or Markdown.")


SECTION = re.compile(r"^\s*((?:section|article|regulation|part|chapter|schedule)\s+[\dIVXLC]+[^\n]{0,80})", re.I | re.M)


def chunk_pages(pages: list[tuple[int | None, str]], size: int = 0, overlap: int = 0) -> list[tuple[int | None, str | None, str]]:
    """Paragraph-aware chunks that keep their page number and the nearest section heading."""
    size, overlap = size or settings.chunk_chars, overlap or settings.chunk_overlap
    out, section = [], None
    for page, raw in pages:
        txt = re.sub(r"[ \t]+", " ", raw.replace("\r", "")).strip()
        buf = ""
        for para in re.split(r"\n\s*\n", txt):
            para = para.strip()
            if not para:
                continue
            m = SECTION.search(para)
            if m:
                section = m.group(1).strip()[:120]
            while len(para) > size:  # a single huge paragraph: split at the last sentence or space
                cut = max(para.rfind(". ", 0, size), para.rfind(" ", 0, size), size // 2)
                piece, para = para[:cut + 1].strip(), para[max(cut + 1 - overlap, 1):].strip()
                if buf:
                    out.append((page, section, buf))
                    buf = ""
                out.append((page, section, piece))
            if buf and len(buf) + len(para) + 2 > size:
                out.append((page, section, buf))
                buf = buf[-overlap:].split(" ", 1)[-1] + "\n\n" + para
            else:
                buf = f"{buf}\n\n{para}" if buf else para
        if buf.strip():
            out.append((page, section, buf.strip()))
    return [c for c in out if len(c[2].strip()) >= 20]


def embed_missing(db: Session, doc: Document) -> None:
    model = default_model(db, "embedding")
    provider = get_provider(db, model.provider)
    q = select(Chunk).where(Chunk.document_id == doc.id).where(~Chunk.id.in_(select(ChunkEmbedding.chunk_id).where(ChunkEmbedding.model_pk == model.id))).order_by(Chunk.seq)
    chunks = list(db.scalars(q))
    for i in range(0, len(chunks), EMBED_BATCH):
        batch = chunks[i:i + EMBED_BATCH]
        # The document's name and section give a passage context that its own words often lack.
        texts = [f"{doc.short or doc.title}\n{c.section or ''}\n{c.text_}" for c in batch]
        vecs = provider.embed(model.model_id, texts, False, {**(model.params or {}), "dimensions": model.dimensions})
        if not model.dimensions:
            model.dimensions = len(vecs[0])
            db.commit()
            ensure_vector_index(db, model)
        db.add_all(ChunkEmbedding(chunk_id=c.id, model_pk=model.id, embedding=v) for c, v in zip(batch, vecs))
        db.commit()


def process(db: Session, doc: Document) -> None:
    """Idempotent: re-parses a file only if it has no chunks yet, then embeds whatever is missing."""
    if doc.file_path and not doc.chunk_count:
        db.execute(delete(Chunk).where(Chunk.document_id == doc.id))
        chunks = chunk_pages(extract_pages(Path(doc.file_path)))
        if not chunks:
            raise IngestError("No usable text was found in this file.")
        db.add_all(Chunk(document_id=doc.id, organization_id=doc.organization_id, seq=i, page=p, section=s, text_=t) for i, (p, s, t) in enumerate(chunks))
        doc.chunk_count = len(chunks)
        db.commit()
    embed_missing(db, doc)
