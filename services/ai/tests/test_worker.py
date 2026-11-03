"""Deletion/rollback regression tests with real SQLAlchemy sessions in an isolated queue."""
import logging

import pytest
from sqlalchemy import create_engine, delete, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm.exc import ObjectDeletedError
from sqlalchemy.pool import StaticPool

from app import worker
from app.models import Document, IngestJob


@pytest.fixture
def queue(monkeypatch):
    engine = create_engine("sqlite://", poolclass=StaticPool)
    @event.listens_for(engine, "connect")
    def foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")
    Document.__table__.create(engine)
    IngestJob.__table__.create(engine)
    factory = sessionmaker(engine, expire_on_commit=False)
    monkeypatch.setattr(worker, "SessionLocal", factory)
    def add(name):
        with factory() as db:
            doc = Document(title=name, organization_id="worker-test")
            db.add(doc); db.flush()
            job = IngestJob(document_id=doc.id)
            db.add(job); db.commit()
            return doc.id, job.id
    yield factory, add
    engine.dispose()


@pytest.mark.parametrize("expired", [False, True])
def test_delete_during_processing_keeps_worker_running(queue, monkeypatch, caplog, expired):
    factory, add = queue
    doc_id, job_id = add("PRIVATE document value")
    def deleted(db, doc):
        with factory() as other:
            other.execute(delete(Document).where(Document.id == doc_id)); other.commit()
        if expired:
            db.expire(doc)
            with pytest.raises(ObjectDeletedError):
                _ = doc.title
            _ = doc.title
    monkeypatch.setattr(worker, "process", deleted)
    with caplog.at_level(logging.INFO):
        assert worker.run_one() is True
    with factory() as db:
        assert db.get(Document, doc_id) is None
        assert db.get(IngestJob, job_id) is None
    assert "Skipped a deleted ingestion document" in caplog.text
    assert "PRIVATE" not in caplog.text and doc_id not in caplog.text and job_id not in caplog.text
    next_id, next_job = add("Next document")
    monkeypatch.setattr(worker, "process", lambda *_: None)
    assert worker.run_one() is True
    with factory() as db:
        assert db.get(Document, next_id).status == "ready"
        assert db.get(IngestJob, next_job).status == "done"
    assert worker.run_one() is False


def test_failure_marks_existing_document_failed_without_values(queue, monkeypatch, caplog):
    factory, add = queue
    doc_id, job_id = add("PRIVATE title")
    def broken(db, doc):
        db.rollback()
        raise RuntimeError("PRIVATE error and SQL values")
    monkeypatch.setattr(worker, "process", broken)
    assert worker.run_one() is True
    with factory() as db:
        doc, job = db.get(Document, doc_id), db.get(IngestJob, job_id)
        assert doc.status == job.status == "failed"
        assert job.error == "RuntimeError"
        assert "PRIVATE" not in doc.error
    assert "PRIVATE" not in caplog.text and doc_id not in caplog.text
    next_id, _ = add("Next document")
    monkeypatch.setattr(worker, "process", lambda *_: None)
    assert worker.run_one() is True
    with factory() as db:
        assert db.get(Document, next_id).status == "ready"


def test_recovery_write_failure_does_not_escape(queue, monkeypatch, caplog):
    _, add = queue; add("PRIVATE title")
    def broken(*_):
        raise RuntimeError("PRIVATE failure")
    monkeypatch.setattr(worker, "process", broken)
    monkeypatch.setattr(worker, "record_failure", broken)
    assert worker.run_one() is True
    assert "Could not record ingestion failure (RuntimeError)" in caplog.text
    assert "PRIVATE" not in caplog.text


def test_main_continues_after_queue_error(monkeypatch, caplog):
    calls = []
    def run():
        calls.append(True)
        if len(calls) == 1:
            raise RuntimeError("PRIVATE database details")
        raise KeyboardInterrupt
    monkeypatch.setattr(worker, "recover_stuck", lambda: None)
    monkeypatch.setattr(worker, "run_one", run)
    monkeypatch.setattr(worker.time, "sleep", lambda _: None)
    with pytest.raises(KeyboardInterrupt):
        worker.main()
    assert len(calls) == 2
    assert "PRIVATE" not in caplog.text
