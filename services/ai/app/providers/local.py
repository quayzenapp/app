from collections.abc import Iterator
from functools import lru_cache

from app.providers.base import ProviderError


@lru_cache(maxsize=2)
def _model(model_id: str):
    from fastembed import TextEmbedding
    return TextEmbedding(model_name=model_id)


class Local:
    """Embeddings on our own server: free, no key, and document text never leaves the infrastructure."""
    def __init__(self, secret: dict, config: dict):
        pass

    def chat_stream(self, model_id: str, system: str, messages: list[dict], params: dict) -> Iterator[str]:
        raise ProviderError("The local provider only supports embeddings.")

    def embed(self, model_id: str, texts: list[str], is_query: bool, params: dict) -> list[list[float]]:
        m = _model(model_id)
        vecs = m.query_embed(texts) if is_query else m.passage_embed(texts)
        return [v.tolist() for v in vecs]
