---
name: quayzen-ai
description: Ask Quayza AI service including FastAPI, SQLAlchemy, pgvector RAG, document ingestion, OpenRouter and AWS Bedrock model configuration, and tenant-safe retrieval. Use before changing anything in services/ai or the AI admin screens.
---

# Ask Quayza service (`services/ai`)

Python 3.12, FastAPI, SQLAlchemy 2, Alembic, pgvector, in the separate `quayzen_ai` database. Full guide: `docs/AI-ARCHITECTURE.md`.

## Flow
- **Ingest:** admin upload -> Next.js checks RBAC -> `POST /v1/documents` -> file saved, `ingest_jobs` row -> worker (`FOR UPDATE SKIP LOCKED`) parses, chunks with page references, embeds -> status `ready`.
- **Ask:** browser -> `/api/ai/chat` (Next.js checks RBAC, signs JWT) -> `POST /v1/chat` -> hybrid search (vector + full text, merged with reciprocal rank fusion) -> LLM with citations -> SSE stream.

## Rules that must not be broken
- The browser never calls FastAPI. Next.js signs a JWT lasting about 60 seconds (`aud=quayzen-ai`) with `sub`, `org`, `role`, `ai_admin`, `platform`. **The org only ever comes from that JWT, never from a request body.**
- Every retrieval SQL query filters `organization_id IS NULL OR organization_id = :org` (null = shared library). Only platform admins can write shared documents.
- Document text is untrusted data. It goes inside delimited context, and the system prompt says instructions inside documents are ignored.
- No relevant passage means say so and do not guess. Answers cite passages.
- API keys are read from env or stored Fernet-encrypted (`AI_ENCRYPTION_KEY`), and are never returned by any endpoint.

## Models
`ai_models` rows: provider (`openrouter`, `bedrock`, `local`), `model_id`, purpose (`chat`, `embedding`), `is_default`, `fallback_order`, `dimensions`. Admin UI: `/admin/ai/models`.
- Add a provider by implementing `app/providers/base.py` and registering it in `app/providers/__init__.py`.
- Embeddings: vectors live in `chunk_embeddings` keyed by model, with a partial HNSW index per model and dimension. **Changing the default embedding model requires a re-index**, and search only uses the default model's vectors.
- "Not in the documents" is detected by `min_similarity` (0.60 for bge-small, measured). **Re-measure with `scripts/measure_similarity.py` after changing embedding model**, and store the value in that model's `params`.
- Default embedding is local `fastembed`, so documents stay on our servers. Free OpenRouter models may log prompts, so warn before using them with confidential tenant data.
