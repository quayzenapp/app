FROM python:3.12-slim
RUN pip install --no-cache-dir uv
WORKDIR /srv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY . .
ENV PATH="/srv/.venv/bin:$PATH" AI_DATA_DIR=/data
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8100"]
