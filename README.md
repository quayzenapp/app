# Quayzen
Multi-tenant compliance workspace for Colombo Port City. Status and roadmap: `docs/STATUS.md`. AI and model setup: `docs/AI-ARCHITECTURE.md`.

## Run it
```bash
cp apps/web/.env.example apps/web/.env            # then fill in values
cp services/ai/.env.example services/ai/.env      # then fill in values
docker compose up -d postgres keycloak

cd apps/web && pnpm install && pnpm prisma generate && pnpm prisma migrate deploy && pnpm db:seed && pnpm dev

cd services/ai && uv sync && uv run alembic upgrade head
uv run python -m app.seed ../../docs/artifact/data/js/library.json
uv run uvicorn app.main:app --port 8100          # one terminal
uv run python -m app.worker                      # another terminal
```
Open http://localhost:3000. Demo users (password `Demo@12345`, development only): `platform@quayzen.test`, `admin@demo.test`, `compliance@demo.test`, `hr@demo.test`, `finance@demo.test`, `reviewer@demo.test`, `adviser@demo.test` (in two organizations), `admin@harbourline.test`.

## Test it
`pnpm test:isolation` in `apps/web`, `uv run python -m pytest tests -q` in `services/ai`, `./tests/e2e/run.sh` from the root.
