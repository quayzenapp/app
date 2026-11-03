"""Ingestion worker. Postgres is the queue: run as many of these as needed, SKIP LOCKED keeps them apart."""
import logging
import time

from sqlalchemy import select, text

from app.db import SessionLocal
from app.ingest import IngestError, process
from app.models import Document, IngestJob
from app.providers.base import ProviderError

MAX_ATTEMPTS = 3
log = logging.getLogger("quayzen.worker")


def run_one() -> bool:
    with SessionLocal() as db:
        job = db.scalars(select(IngestJob).where(IngestJob.status == "queued").order_by(IngestJob.created_at).with_for_update(skip_locked=True).limit(1)).first()
        if not job:
            return False
        job.status, job.attempts = "running", job.attempts + 1
        doc = db.get(Document, job.document_id)
        if doc:
            doc.status, doc.error = "processing", None
        db.commit()
        if not doc:
            job.status = "failed"
            db.commit()
            return True
        try:
            process(db, doc)
            doc.status, job.status = "ready", "done"
        except (IngestError, ProviderError) as e:
            db.rollback()
            retry = isinstance(e, ProviderError) and getattr(e, "retryable", False) and job.attempts < MAX_ATTEMPTS
            job.status, job.error = ("queued" if retry else "failed"), str(e)
            doc.status, doc.error = ("pending" if retry else "failed"), str(e)
        except Exception as e:
            db.rollback()
            log.exception("ingest failed for %s", doc.id)
            retry = job.attempts < MAX_ATTEMPTS
            job.status, job.error = ("queued" if retry else "failed"), type(e).__name__
            doc.status, doc.error = ("pending" if retry else "failed"), "Something went wrong while processing this file."
        db.commit()
        return True


def recover_stuck() -> None:
    """Jobs left running by a crashed worker go back in the queue."""
    with SessionLocal() as db:
        db.execute(text("UPDATE ingest_jobs SET status='queued' WHERE status='running' AND updated_at < now() - interval '30 minutes' AND attempts < :m"), {"m": MAX_ATTEMPTS})
        db.commit()


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    recover_stuck()
    while True:
        if not run_one():
            time.sleep(2)


if __name__ == "__main__":
    main()
