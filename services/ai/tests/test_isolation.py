"""Runs against the live local service and database. Usage: uv run pytest tests -q"""
import time
import uuid

import httpx
import jwt
import pytest

from app.config import settings
from app.ingest import chunk_pages

BASE = "http://localhost:8100"


def tok(org, sub="u1", **kw):
    return {"Authorization": "Bearer " + jwt.encode({"sub": sub, "org": org, "aud": "quayzen-ai", "exp": time.time() + 60, **kw}, settings.ai_jwt_secret, algorithm="HS256")}


def upload(org, marker, **form):
    r = httpx.post(f"{BASE}/v1/documents", headers=tok(org, ai_admin=True, platform=form.pop("platform", False)), data={"title": f"Doc {marker}", **form},
                   files={"file": ("note.txt", f"The secret project codename is {marker}. It concerns zebra licensing rules in the harbour district.\n\n" * 3)}, timeout=30)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def wait_ready(org, doc_id):
    for _ in range(120):
        d = next(x for x in httpx.get(f"{BASE}/v1/documents", headers=tok(org)).json() if x["id"] == doc_id)
        if d["status"] in ("ready", "failed"):
            return d
        time.sleep(1)
    raise AssertionError("document not processed")


def search(org, q):
    return httpx.post(f"{BASE}/v1/search", headers=tok(org), json={"query": q}, timeout=60).json()


@pytest.fixture(scope="module")
def orgs():
    a, b, m = f"org-a-{uuid.uuid4().hex[:6]}", f"org-b-{uuid.uuid4().hex[:6]}", f"MARKER{uuid.uuid4().hex[:8]}"
    doc = upload(a, m)
    assert wait_ready(a, doc)["status"] == "ready"
    yield a, b, m, doc
    httpx.delete(f"{BASE}/v1/documents/{doc}", headers=tok(a, ai_admin=True))


def test_owner_finds_own_document(orgs):
    a, _, m, _ = orgs
    assert any(m in h["text"] for h in search(a, f"zebra licensing codename {m}"))


def test_other_tenant_cannot_find_it(orgs):
    _, b, m, _ = orgs
    assert not any(m in h["text"] for h in search(b, f"zebra licensing codename {m}"))


def test_other_tenant_cannot_list_or_change_it(orgs):
    _, b, _, doc = orgs
    assert doc not in [d["id"] for d in httpx.get(f"{BASE}/v1/documents", headers=tok(b)).json()]
    h = tok(b, ai_admin=True)
    assert httpx.delete(f"{BASE}/v1/documents/{doc}", headers=h).status_code == 404
    assert httpx.post(f"{BASE}/v1/documents/{doc}/reindex", headers=h).status_code == 404


def test_shared_library_visible_to_every_org():
    hits = search(f"org-new-{uuid.uuid4().hex[:6]}", "annual licence renewal fee two months before expiry")
    assert hits and any("Fee" in h["ref"] or "fee" in h["text"].lower() for h in hits)


def test_off_topic_questions_find_nothing():
    for q in ("What is the recipe for chocolate cake?", "How tall is Mount Everest?", "What is the capital of France?"):
        assert search("org-x", q) == [], q


def test_off_topic_chat_says_so_without_calling_a_model():
    with httpx.stream("POST", f"{BASE}/v1/chat", headers=tok("org-chat"), json={"question": "What is the recipe for chocolate cake?"}, timeout=60) as r:
        body = "".join(r.iter_text())
    assert "couldn't find anything" in body and "event: error" not in body


def test_exact_citation_finds_its_document():
    assert search("org-x", "Gazette 2339/31")[0]["ref"] == "Gazette 2339/31"


def test_permissions():
    org = "org-perm"
    files = {"file": ("x.txt", "hello world text content")}
    assert httpx.post(f"{BASE}/v1/documents", headers=tok(org), data={"title": "x"}, files=files).status_code == 403
    assert httpx.post(f"{BASE}/v1/documents", headers=tok(org, ai_admin=True), data={"title": "x", "shared": "true"}, files=files).status_code == 403
    assert httpx.get(f"{BASE}/v1/models", headers=tok(org, ai_admin=True)).status_code == 403
    assert httpx.get(f"{BASE}/v1/documents").status_code == 401
    forged = jwt.encode({"sub": "u", "org": org, "aud": "quayzen-ai", "exp": time.time() + 60}, "wrong-secret-wrong-secret-wrong-secret", algorithm="HS256")
    assert httpx.get(f"{BASE}/v1/documents", headers={"Authorization": f"Bearer {forged}"}).status_code == 401
    expired = jwt.encode({"sub": "u", "org": org, "aud": "quayzen-ai", "exp": time.time() - 5}, settings.ai_jwt_secret, algorithm="HS256")
    assert httpx.get(f"{BASE}/v1/documents", headers={"Authorization": f"Bearer {expired}"}).status_code == 401


def test_keys_never_returned():
    r = httpx.put(f"{BASE}/v1/providers/bedrock", headers=tok("o", platform=True), json={"secret": {"access_key_id": "TESTKEYVALUE123"}, "config": {"region": "us-east-1"}})
    assert r.status_code == 200
    assert "TESTKEYVALUE123" not in httpx.get(f"{BASE}/v1/models", headers=tok("o", platform=True)).text


def test_chat_without_key_explains_and_shows_passages():
    with httpx.stream("POST", f"{BASE}/v1/chat", headers=tok("org-chat"), json={"question": "When is the licence renewal fee due?"}, timeout=120) as r:
        body = "".join(r.iter_text())
    assert "event: sources" in body and "Fee" in body
    assert "event: error" in body or "event: done" in body


def test_chunking_keeps_pages_and_sections():
    chunks = chunk_pages([(3, "Section 12 Licences\n\n" + "A sentence about renewal. " * 200)], 500, 50)
    assert len(chunks) > 3 and all(c[0] == 3 and c[2] for c in chunks) and all(len(c[2]) <= 560 for c in chunks)
    assert all(c[1] and c[1].startswith("Section 12") for c in chunks)
