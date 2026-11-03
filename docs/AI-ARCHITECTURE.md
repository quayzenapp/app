# Ask Quayza: architecture and model guide

## Recommendation
Your instinct is right: **Python, FastAPI, SQLAlchemy and Postgres**, as a separate service. Python has the strongest document-parsing and embedding libraries, and the service can scale apart from the web app. Three additions make it safer and better:

| Decision | Why |
|---|---|
| **pgvector in Postgres**, not a separate vector database | One system to run and back up. SQL filters tenants in the same query as the search. It handles this scale well. |
| **Hybrid search** (vector + keyword + exact citation) | Legal text needs exact matches such as "Gazette 2339/31", which vector search alone misses. |
| **Next.js as the only gateway** | The browser never calls FastAPI. Next.js checks RBAC, then signs a 60-second token. The tenant only ever comes from that token. |
| **Postgres as the job queue** | Ingestion runs in a worker with `SKIP LOCKED`. No Redis or Celery to run yet. |
| **Local embeddings by default** | Free, no API key, and document text stays on your server when it's vectorized. |

```
Admin upload -> Next.js (RBAC) -> FastAPI -> file + job -> worker: parse -> chunk -> embed -> pgvector
Question     -> Next.js (RBAC, signs JWT) -> FastAPI: search (tenant filter in SQL) -> LLM -> streamed answer + citations
```
Documents are either **shared** (platform admin only, for all organizations; the 43 built-in legal documents are here) or **organization** documents, visible only to that organization.

## Configure models: Admin > AI models (platform admin)
There are two kinds of model. **Answering** (chat) writes the answer. **Reading documents** (embedding) turns text into vectors.

### OpenRouter free models (start here)
1. Create a key at https://openrouter.ai/keys.
2. Paste it under **OpenRouter > API key** and save. It's stored encrypted and can't be shown again. Alternatively set `OPENROUTER_API_KEY` in `services/ai/.env`, which takes priority.
3. Press **Test** on "OpenRouter: free auto-router" (`openrouter/free`). This default picks an available free model for you.
4. Optional: add specific free models with a **Fallback order**, so another is tried if one is rate limited. Model ID suggests the live list, because free models change often.

**Before relying on free models:**
- They're rate limited, so they suit trying things out, not production traffic.
- **Passages from your documents are sent with each question, and free providers may log them.** Don't use them for confidential tenant documents. Check each provider's data policy on OpenRouter.

### AWS Bedrock (later)
1. In AWS, enable access to the models you want in your region, and give the server an IAM role with `bedrock:InvokeModel` and `bedrock:InvokeModelWithResponseStream`.
2. Under **AWS Bedrock**, set the region. Leave the keys empty to use the IAM role, which is safer. Access keys are also supported, and are stored encrypted.
3. **Add a model** with provider AWS Bedrock and its model ID or inference profile ID from your AWS console. Press **Test**, then **Make default**.

The chat call uses Bedrock's Converse API, so it works across the model families that support it. Embeddings support Amazon Titan and Cohere IDs.

### Changing the embedding model
Vectors from different models can't be compared.
1. Add the model, press **Test** (this detects its size), then **Make default**.
2. Press **Process all documents again**.
3. Re-run `scripts/measure_similarity.py` and set `min_similarity` in that model's `params`. Scores differ per model, and a wrong value makes Quayza either refuse good questions or accept off-topic ones.

## What's verified
- Verified: upload-to-search pipeline on the 43 library documents (534 passages), tenant isolation, permissions, off-topic refusal, citations, and the no-key error path.
- **Not yet verified: a real LLM answer through OpenRouter (needs your key), and anything on Bedrock (needs AWS access).** The code exists for both but has never run against the real services.

## Later improvements
- OCR for scanned PDFs (these are currently rejected with a clear message).
- A cross-encoder reranker, once real questions show where ranking falls short.
- Agent tools, so Quayza can also read a tenant's own records, with RBAC and sensitive-field rules applied. Not built: it only reads documents today.
- S3 for uploaded files (local disk now).
