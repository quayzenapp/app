from collections.abc import Iterator
from typing import Protocol


class ProviderError(Exception):
    """Safe to show an administrator. Never contains a credential."""
    def __init__(self, message: str, retryable: bool = False):
        super().__init__(message)
        self.retryable = retryable


class Provider(Protocol):
    def chat_stream(self, model_id: str, system: str, messages: list[dict], params: dict) -> Iterator[str]: ...
    def embed(self, model_id: str, texts: list[str], is_query: bool, params: dict) -> list[list[float]]: ...
