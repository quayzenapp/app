---
name: quayzen-architecture
description: Quayzen system architecture, multi-tenancy, Keycloak auth, built-in RBAC, Prisma data access, repo layout and dev commands. Use before writing any web app code, server action, schema change, auth or permission logic.
---

# Quayzen architecture

```
Browser -> Next.js (apps/web: UI, BFF, RBAC, tenancy) -> Postgres db `quayzen` (Prisma)
              |  OIDC                  |  short-lived signed JWT
           Keycloak             FastAPI (services/ai) -> Postgres db `quayzen_ai` (SQLAlchemy, pgvector)
                                                      -> OpenRouter / AWS Bedrock
```

## Layout
- `apps/web` Next.js App Router, Tailwind, Prisma. `src/lib` = auth, tenancy, rbac, forms logic; `src/app/(app)` = tenant app; `src/app/admin` = admin dashboard; `src/app/api/ai` = AI proxy.
- `services/ai` FastAPI service (see `quayzen-ai`).
- `infra/keycloak` realm import and login theme. `docker-compose.yml` runs Postgres (host port 5434), Keycloak (8180), AI service (8100).
- `docs/STATUS.md` progress and roadmap.

## Auth: Keycloak authenticates, the app authorises
- Keycloak holds only credentials and identity. **No roles or organisations live in Keycloak.**
- OIDC authorization code with PKCE through Auth.js. Sign-in asks for email and password only, on the themed Keycloak page. Registration is disabled.
- On login the user is matched to the `users` table by `keycloakSub`, or by email on first login. No row, or status not ACTIVE, means no access.
- Admin-created users are created in Keycloak with the Admin REST API (service account client `quayzen-admin`).

## Multi-tenancy: shared database, tenant column, RLS
- Tenant = `Organization`. Users join through `Membership` (user, org, role).
- The active org is in the `qz_org` cookie and is **always re-validated against Membership on each request**. Never trust a client-supplied org id.
- `getTenantContext()` in `src/lib/tenant.ts` is the only way to get the org, role and permissions.
- Tenant tables (`records`, `audit_logs`, `annual_returns`, `return_snapshots`) use Postgres RLS with `FORCE`. Access them only through `withTenant(orgId, tx => ...)`, which sets `app.org_id` for the transaction, using the non-owner `quayzen_app` role. RLS is the second line of defence, so still filter by `organizationId` in code.
- `platformDb` is for identity and admin tables only (users, organisations, memberships, roles, forms).

## RBAC: built into the app
- `Role.permissions` = `{ module: "none"|"read"|"write"|"approve" }`; `Role.sensitive` = category list. Roles with a null `organizationId` are templates copied into each new org, and org admins edit their copies.
- Check permissions **on the server in every action and page** with `can(ctx, module, level)` or `requirePermission(...)`. Hiding UI is not security.
- Sensitive fields: `stripSensitive()` on every read, and `mergeSensitive()` on every write so hidden values are kept, never blanked.
- Platform admin (`User.isPlatformAdmin`) manages everything. An org admin needs `settings: approve` and is limited to their own org.
- Write an audit log entry for every create, update, delete and permission change.

## Forms are data
`FormDefinition` rows (org override first, then the global row) drive lists, forms, validation and sensitive handling. Records are stored in `records.data` JSONB. Do not add a table per register unless a calculation really requires it.

## Conventions
- Next.js 16: read `apps/web/AGENTS.md`; `params`, `cookies()` and `headers()` are async. There is no middleware: protection happens in `getTenantContext()`.
- All dates for deadlines use `todayISO()` (Asia/Colombo), never `toISOString()`.
- Server Components by default, Server Actions for mutations, zod to validate input.
- Use artifact CSS classes for the look (see `quayzen-design`) and Tailwind for layout.
- After `prisma generate`, restart the dev server: it caches the client in a global.
- Secrets only in `.env` files (gitignored). The seeded demo passwords are for development only.

## Commands
```bash
docker compose up -d postgres keycloak          # infrastructure
cd apps/web && pnpm prisma migrate deploy && pnpm db:seed && pnpm dev   # http://localhost:3000
pnpm test:isolation                             # tenant and RBAC isolation checks
./tests/e2e/run.sh                              # browser tests (stack running; needs Docker; cleans up)
cd services/ai && uv run alembic upgrade head && uv run uvicorn app.main:app --port 8100
uv run python -m app.worker                     # ingestion worker
uv run python -m pytest tests -q                # AI isolation and retrieval tests (API running)
```
