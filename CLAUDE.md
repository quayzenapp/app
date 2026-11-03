# Quayzen

Multi-tenant SEZ compliance app. Before working, load the matching skill and read `docs/STATUS.md`:
- `quayzen-product` business rules, module map, where artifact logic lives
- `quayzen-architecture` tenancy, auth, RBAC, layout, commands
- `quayzen-design` exact colours, icons, CSS classes, flaws not to copy
- `quayzen-ai` Ask Quayza service, models, retrieval

Hard rules: never execute artifact code; every tenant query goes through `withTenant`; check permissions on the server; update `docs/STATUS.md` when you finish a piece of work.
