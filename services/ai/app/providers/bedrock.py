import json
from collections.abc import Iterator

from app.providers.base import ProviderError


class Bedrock:
    """Uses stored keys if present, otherwise the AWS default chain (preferred: an IAM role on the server)."""
    def __init__(self, secret: dict, config: dict):
        import boto3
        self.client = boto3.client(
            "bedrock-runtime",
            region_name=config.get("region") or "us-east-1",
            aws_access_key_id=secret.get("access_key_id") or None,
            aws_secret_access_key=secret.get("secret_access_key") or None,
        )

    def chat_stream(self, model_id: str, system: str, messages: list[dict], params: dict) -> Iterator[str]:
        from botocore.exceptions import BotoCoreError, ClientError
        try:
            r = self.client.converse_stream(
                modelId=model_id,
                system=[{"text": system}],
                messages=[{"role": m["role"], "content": [{"text": m["content"]}]} for m in messages],
                inferenceConfig={"temperature": params.get("temperature", 0.1), "maxTokens": params.get("max_tokens", 1500)},
            )
            for ev in r["stream"]:
                t = ev.get("contentBlockDelta", {}).get("delta", {}).get("text")
                if t:
                    yield t
        except (ClientError, BotoCoreError) as e:
            code = getattr(e, "response", {}).get("Error", {}).get("Code", "") if isinstance(e, ClientError) else ""
            raise ProviderError(f"Bedrock error: {code or type(e).__name__}", retryable=code in ("ThrottlingException", "ServiceUnavailableException")) from e

    def embed(self, model_id: str, texts: list[str], is_query: bool, params: dict) -> list[list[float]]:
        from botocore.exceptions import BotoCoreError, ClientError
        out = []
        try:
            if model_id.startswith("cohere."):
                for i in range(0, len(texts), 96):
                    body = {"texts": texts[i:i + 96], "input_type": "search_query" if is_query else "search_document"}
                    r = self.client.invoke_model(modelId=model_id, body=json.dumps(body))
                    e = json.loads(r["body"].read())["embeddings"]
                    out.extend(e["float"] if isinstance(e, dict) else e)
            else:  # Amazon Titan
                for t in texts:
                    body: dict = {"inputText": t}
                    if params.get("dimensions"):
                        body["dimensions"] = params["dimensions"]
                    r = self.client.invoke_model(modelId=model_id, body=json.dumps(body))
                    out.append(json.loads(r["body"].read())["embedding"])
        except (ClientError, BotoCoreError) as e:
            raise ProviderError(f"Bedrock embedding error: {type(e).__name__}") from e
        return out
