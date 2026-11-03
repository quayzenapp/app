import json

from cryptography.fernet import Fernet
from sqlalchemy.orm import Session

from app.config import settings
from app.models import ProviderCredential

_f = Fernet(settings.ai_encryption_key.encode())


def save_secret(db: Session, provider: str, secret: dict | None, config: dict | None) -> None:
    row = db.get(ProviderCredential, provider) or ProviderCredential(provider=provider, config={})
    if secret:
        row.secret_enc = _f.encrypt(json.dumps(secret).encode()).decode()
    if config is not None:
        row.config = config
    db.add(row)
    db.commit()


def load(db: Session, provider: str) -> tuple[dict, dict]:
    row = db.get(ProviderCredential, provider)
    if not row:
        return {}, {}
    return (json.loads(_f.decrypt(row.secret_enc.encode())) if row.secret_enc else {}), row.config or {}


def has_secret(db: Session, provider: str) -> bool:
    if provider == "openrouter" and settings.openrouter_api_key:
        return True
    row = db.get(ProviderCredential, provider)
    return bool(row and row.secret_enc)
