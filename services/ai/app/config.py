from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    ai_database_url: str
    ai_jwt_secret: str
    ai_encryption_key: str
    ai_data_dir: str = "./data"
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    max_upload_mb: int = 50
    chunk_chars: int = 1400
    chunk_overlap: int = 200
    retrieve_top_k: int = 12
    min_similarity: float = 0.60  # measured for bge-small: see scripts/measure_similarity.py


settings = Settings()
