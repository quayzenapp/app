"""Ingestion worker. Postgres is the queue: SKIP LOCKED keeps workers apart."""
import logging
import time

from sqlalchemy import select, text

from app.db import SessionLocal
from app.ingest import process
from app.models import Document, IngestJob

MAX_ATTEMPTS = 3
log = logging.getLogger("quayzen.worker")


def record_failure(job_id: str, document_id: str, error_type: str) -> None:
    # Rollback/expiration or deletion may have invalidated both ORM instances.
    # A fresh transaction and row lock also serialize a concurrent delete.
    with SessionLocal() as db:
        doc = db.scalar(select(Document).where(Document.id == document_id).with_for_update())
        if doc is None:
            log.info("Skipped a deleted ingestion document")
            return
        job = db.scalar(select(IngestJob).where(IngestJob.id == job_id, IngestJob.document_id == document_id).with_for_update())
        doc.status, doc.error = "failed", "Something went wrong while processing this file."
        if job is not None:
            job.status, job.error = "failed", error_type
        db.commit()
    # Never log exception messages, SQL parameters, document IDs or values.
    log.warning("Ingestion document failed (%s)", error_type)


def run_one() -> bool:
    job_id = document_id = None
    try:
        with SessionLocal() as db:
            job = db.scalars(select(IngestJob).where(IngestJob.status == "queued").order_by(IngestJob.created_at).with_for_update(skip_locked=True).limit(1)).first()
            if job is None:
                return False
            job_id, document_id = job.id, job.document_id
            job.status, job.attempts = "running", job.attempts + 1
            doc = db.get(Document, document_id)
            if doc is None:
                job.status = "failed"
                db.commit()
                log.info("Skipped a deleted ingestion document")
                return True
            doc.status, doc.error = "processing", None
            db.commit()
            process(db, doc)
            doc.status, job.status = "ready", "done"
            # Deletion can surface only at this final commit, too.
            db.commit()
    except Exception as error:
        if job_id is None or document_id is None:
            raise
        try:
            record_failure(job_id, document_id, type(error).__name__)
        except Exception as recovery_error:
            log.error("Could not record ingestion failure (%s)", type(recovery_error).__name__)
    return True


def recover_stuck() -> None:
    """Jobs left running by a crashed worker go back in the queue."""
    with SessionLocal() as db:
        db.execute(text("UPDATE ingest_jobs SET status='queued' WHERE status='running' AND updated_at < now() - interval '30 minutes' AND attempts < :m"), {"m": MAX_ATTEMPTS})
        db.commit()


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    try:
        recover_stuck()
    except Exception as error:
        log.error("Could not recover ingestion queue (%s)", type(error).__name__)
    while True:
        try:
            if run_one():
                continue
        except Exception as error:
            log.error("Ingestion queue unavailable (%s)", type(error).__name__)
        time.sleep(2)


if __name__ == "__main__":
    main()
