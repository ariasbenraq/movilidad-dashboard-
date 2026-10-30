# AGENTS.md: BACK agent

Applies to `backend/`, `n8n/`, `apps-script/` and `fixtures/`. Read the root `AGENTS.md` first.

## Stack and conventions

- NestJS 12, TypeScript strict, ESM: relative imports end in `.js` (see `src/app.module.ts`). TypeORM with PostgreSQL, ioredis, Joi for env validation, class-validator for DTOs, Vitest, oxlint, prettier.
- One feature module per folder (`src/ingest`, `src/auth`, `src/registros`...) with controller, service, DTOs, rules and specs next to each other. Pure functions (period, overtime, flags, budget) live in a `*.rules.ts` file with unit tests and no framework imports.
- Money is `numeric(10,2)` in Postgres and a JSON number with 2 decimals in responses. Never floats in SQL math you can avoid; round once at the edge.
- Time zone is `America/Lima`. Never use the server's local time.
- No `any`, even though the linter allows it. No non-null assertions to silence errors.
- Errors use Nest's default shape. Error bodies and logs never include the request payload, passwords, tokens or addresses.
- Every new endpoint matches `docs/api-contract.md` exactly (names, types, status codes). If the contract is wrong or incomplete, stop and report a change request.

## Database

- Schema changes only through migrations in `src/migrations/` (`npm run migration:generate` or hand-written, with a working `down`). Test `migration:run`, `migration:revert` and `migration:run` again.
- Never `synchronize`. Never edit a migration that is already merged: add a new one.
- Read endpoints are cached in Redis under `movilidad:v1:{periodo}:...` keys with a 300 s TTL; a committed ingest deletes the period's keys. Redis down means serve from Postgres.

## Auth

- Argon2id password hashes, JWT in an `httpOnly` cookie as defined in `docs/spec.md` section 12. Login is rate-limited with Redis. No registration endpoint: the user is created by a CLI script (`npm run user:create`) that asks for the password without echo and never logs it.
- Every read endpoint is guarded by default; only `/health`, `/ingest` and `/auth/login` are public.

## Parser, n8n and Apps Script

- `n8n/parser.js` stays a pure CommonJS function without dependencies; bump `PARSER_VERSION` when its output changes. Extend `fixtures/*.expected.json` and keep the fixtures anonymized: replace street addresses with `DIRECCION PARTIDA` / `DIRECCION LLEGADA` style placeholders and use made-up districts.
- `n8n/workflow.json` embeds `parser.js` unchanged (a test checks it). Do not put secrets or real URLs in it beyond the documented placeholders.
- `apps-script/Code.gs` only transports. Its pure helpers are tested with `node --test`.

## Dependencies

Pre-approved: `@nestjs/jwt`, `argon2`, `cookie-parser` (and its types), `@nestjs/swagger`. Anything else needs the owner's approval first: say what it is and why.

## Tests

- Unit tests for every rule function. Integration tests against the dev Postgres and Redis, gated by `RUN_INTEGRATION=1` (they truncate tables: use a disposable database).
- Auth tests cover: wrong password, same message for unknown user, rate limit, expired token, missing cookie on every protected route.

## Before saying "done"

From `backend/`: `npm run lint`, `npm run test`, `npm run build`, and with `RUN_INTEGRATION=1` the integration suite. From `n8n/`: `node --test`. Report any that you could not run.
