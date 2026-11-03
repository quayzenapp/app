import json
from collections.abc import Iterator

import httpx

from app.config import settings
from app.providers.base import ProviderError


class OpenRouter:
    def __init__(self, secret: dict, config: dict):
        self.key = settings.openrouter_api_key or secret.get("api_key", "")
        if not self.key:
            raise ProviderError("No OpenRouter API key is configured. Add one under Admin > AI models.")
        self.headers = {"Authorization": f"Bearer {self.key}", "X-Title": "Quayzen", "Content-Type": "application/json"}

    @staticmethod
    def _raise(status: int, body: str) -> None:
        try:
            msg = json.loads(body).get("error", {}).get("message", "")
        except Exception:
            msg = ""
        raise ProviderError(f"OpenRouter returned {status}. {msg}".strip(), retryable=status in (408, 429, 500, 502, 503, 504))

    def chat_stream(self, model_id: str, system: str, messages: list[dict], params: dict) -> Iterator[str]:
        body = {"model": model_id, "stream": True, "messages": [{"role": "system", "content": system}, *messages], "temperature": params.get("temperature", 0.1), "max_tokens": params.get("max_tokens", 1500)}
        with httpx.stream("POST", f"{settings.openrouter_base_url}/chat/completions", headers=self.headers, json=body, timeout=httpx.Timeout(120, connect=15)) as r:
            if r.status_code >= 400:
                self._raise(r.status_code, r.read().decode(errors="replace"))
            for line in r.iter_lines():
                if not line.startswith("data: "):
                    continue  # OpenRouter sends keep-alive comments
                data = line[6:]
                if data.strip() == "[DONE]":
                    return
                ev = json.loads(data)
                if ev.get("error"):
                    raise ProviderError(f"OpenRouter: {ev['error'].get('message', 'model error')}", retryable=True)
                delta = (ev.get("choices") or [{}])[0].get("delta", {}).get("content")
                if delta:
                    yield delta

    def embed(self, model_id: str, texts: list[str], is_query: bool, params: dict) -> list[list[float]]:
        r = httpx.post(f"{settings.openrouter_base_url}/embeddings", headers=self.headers, json={"model": model_id, "input": texts}, timeout=120)
        if r.status_code >= 400:
            self._raise(r.status_code, r.text)
        return [d["embedding"] for d in sorted(r.json()["data"], key=lambda d: d["index"])]
