import uuid
from datetime import datetime, timezone

from pgvector.sqlalchemy import Vector
from sqlalchemy import JSON, Boolean, Computed, DateTime, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def uid() -> str:
    return uuid.uuid4().hex


def now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class AiModel(Base):
    """A chat or embedding model the admin has configured."""
    __tablename__ = "ai_models"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    provider: Mapped[str] = mapped_column(String(32))  # openrouter | bedrock | local
    model_id: Mapped[str] = mapped_column(String(200))
    label: Mapped[str] = mapped_column(String(200))
    purpose: Mapped[str] = mapped_column(String(16))  # chat | embedding
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    fallback_order: Mapped[int | None] = mapped_column(Integer, nullable=True)
    dimensions: Mapped[int | None] = mapped_column(Integer, nullable=True)
    params: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (Index("uq_ai_models_provider_model_purpose", "provider", "model_id", "purpose", unique=True),)


class ProviderCredential(Base):
    __tablename__ = "provider_credentials"
    provider: Mapped[str] = mapped_column(String(32), primary_key=True)
    secret_enc: Mapped[str | None] = mapped_column(Text, nullable=True)  # Fernet-encrypted JSON
    config: Mapped[dict] = mapped_column(JSONB, default=dict)  # non-secret, e.g. region
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class Document(Base):
    """organization_id NULL = shared library, visible to every organization."""
    __tablename__ = "documents"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    organization_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    title: Mapped[str] = mapped_column(Text)
    short: Mapped[str | None] = mapped_column(Text, nullable=True)
    kind: Mapped[str] = mapped_column(String(64), default="Other")
    doc_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    source: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending|processing|ready|failed
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    filename: Mapped[str | None] = mapped_column(Text, nullable=True)
    sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    superseded: Mapped[bool] = mapped_column(Boolean, default=False)
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    uploaded_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    chunks: Mapped[list["Chunk"]] = relationship(back_populates="document", cascade="all, delete-orphan", passive_deletes=True)


class Chunk(Base):
    __tablename__ = "chunks"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    organization_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    seq: Mapped[int] = mapped_column(Integer)
    page: Mapped[int | None] = mapped_column(Integer, nullable=True)
    section: Mapped[str | None] = mapped_column(Text, nullable=True)
    text_: Mapped[str] = mapped_column("text", Text)
    tsv = mapped_column(TSVECTOR, Computed("to_tsvector('english', text)", persisted=True))
    document: Mapped[Document] = relationship(back_populates="chunks")
    __table_args__ = (Index("ix_chunks_tsv", "tsv", postgresql_using="gin"),)


class ChunkEmbedding(Base):
    """One row per chunk and model, so embedding models of any size can coexist during a switch."""
    __tablename__ = "chunk_embeddings"
    chunk_id: Mapped[str] = mapped_column(ForeignKey("chunks.id", ondelete="CASCADE"), primary_key=True)
    model_pk: Mapped[str] = mapped_column(ForeignKey("ai_models.id", ondelete="CASCADE"), primary_key=True)
    embedding = mapped_column(Vector())


class IngestJob(Base):
    __tablename__ = "ingest_jobs"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(16), default="queued", index=True)  # queued|running|done|failed
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class Conversation(Base):
    __tablename__ = "conversations"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    organization_id: Mapped[str] = mapped_column(String(64), index=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    title: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Message(Base):
    __tablename__ = "messages"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(16))
    content: Mapped[str] = mapped_column(Text)
    sources: Mapped[list] = mapped_column(JSONB, default=list)
    model: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
