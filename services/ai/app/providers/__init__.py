from sqlalchemy.orm import Session

from app import secrets_store
from app.models import AiModel
from app.providers.base import Provider, ProviderError
from app.providers.bedrock import Bedrock
from app.providers.local import Local
from app.providers.openrouter import OpenRouter

PROVIDERS = {"openrouter": OpenRouter, "bedrock": Bedrock, "local": Local}


def get_provider(db: Session, name: str) -> Provider:
    if name not in PROVIDERS:
        raise ProviderError(f"Unknown provider {name}")
    secret, config = secrets_store.load(db, name)
    return PROVIDERS[name](secret, config)


def default_model(db: Session, purpose: str) -> AiModel:
    m = db.query(AiModel).filter_by(purpose=purpose, is_default=True, enabled=True).first()
    if not m:
        raise ProviderError(f"No default {purpose} model is configured.")
    return m


def chat_chain(db: Session) -> list[AiModel]:
    """The default model, then enabled models with a fallback order."""
    first = default_model(db, "chat")
    rest = db.query(AiModel).filter(AiModel.purpose == "chat", AiModel.enabled.is_(True), AiModel.fallback_order.isnot(None), AiModel.id != first.id).order_by(AiModel.fallback_order).all()
    return [first, *rest]
