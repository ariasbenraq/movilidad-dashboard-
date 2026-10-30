# AGENTS.md

Guidance for AI coding agents (OpenCode) working in this repository. Read this file, then the file of your role (below), then `docs/spec.md` and `docs/api-contract.md` before changing anything.

## What this project is

A personal dashboard that projects the monthly reimbursement of transport expenses I (the owner) will receive, and helps plan next month's budget and travel time. Expense data arrives as Google Forms receipt emails in Gmail.

Flow: Gmail → Apps Script (transport only) → n8n webhook (parsing) → NestJS `POST /ingest` → Postgres → read API (Redis cache) → React dashboard.

Source of truth, in this order:
1. `docs/decisiones.md`: business decisions made by the owner (period, payday, overtime, districts, budget).
2. `docs/spec.md`: technical contract (schema, ingest, projection, auth, caching).
3. `docs/api-contract.md`: the shapes the frontend consumes. Written first, then implemented.
4. This file and the role files: how to work.

If these conflict or something is ambiguous, stop and ask. Do not guess business rules.

## Roles (two agents)

Each session starts by telling you your role. If it does not, ask.

| Role | You own | You must not edit | Rules file |
|---|---|---|---|
| **BACK** | `backend/`, `n8n/`, `apps-script/`, `fixtures/` | `frontend/`, `.github/`, `docs/` (propose changes instead) | `backend/AGENTS.md` |
| **FRONT** | `frontend/` | everything else | `frontend/AGENTS.md` |

- Shared files (`AGENTS.md`, `docs/`, `.github/`, `docker-compose*.yml`, `.env.example`) are changed only by the owner, or by an agent when the owner asks for that change explicitly.
- If you need something from the other agent (a new field, a different status code), do not build it yourself. Write it in your final report as a contract change request.
- The contract is `docs/api-contract.md`. BACK implements it as written; FRONT builds against it with typed mocks. A contract change is approved by the owner before either side codes it.

## Repository layout

```
backend/                NestJS API (TypeScript, TypeORM, ioredis)
frontend/               React + Vite + TypeScript + Tailwind dashboard
n8n/                    parser.js (pure function pasted into the n8n Code node), workflow JSON export, parser tests
apps-script/            Gmail Apps Script (.gs)
fixtures/               anonymized email bodies (*.txt) + *.expected.json
docs/                   decisiones.md, spec.md, api-contract.md, roadmap.md
docker-compose.dev.yml  local Postgres + Redis
.github/                CI and deploy workflows (owner)
```

Folders that do not exist yet are created by their own task, not before.

## Commands

- Dev infrastructure: `docker compose -f docker-compose.dev.yml up -d`
- Backend (from `backend/`): `npm run start:dev`, `npm run lint`, `npm run test`, `npm run build`
- Migrations (from `backend/`): `npm run migration:generate`, `npm run migration:run`, `npm run migration:revert`
- Parser tests (from `n8n/`): `node --test`
- Use npm. Do not introduce pnpm or yarn.

## Environment variables

Single `.env` at the repo root (read by docker compose and by the backend), documented in `.env.example` with placeholders only. The backend validates them at startup and fails fast.

`NODE_ENV`, `PORT`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `REDIS_HOST`, `REDIS_PORT`, `INGEST_API_KEY`, `JWT_SECRET`, `CORS_ORIGIN`, `ORS_API_KEY`.

`INGEST_API_KEY` and `JWT_SECRET` are required and at least 32 characters; the placeholder in `.env.example` must be obviously fake and shorter than the minimum, so a copied example fails validation. The frontend reads only `VITE_API_URL`, from `frontend/.env` (never a secret).

## Architecture rules

- **Business rules live in the backend only.** Periods, payday, projection, overtime minutes, district normalization, budget and route time are computed by NestJS. n8n parses and forwards. Apps Script only transports. The frontend formats and displays what the API returns; it does not recompute totals, periods or paydays.
- **The parser is a pure function** (`n8n/parser.js`): plain text in, JSON out, no dependencies, CommonJS, so it can be pasted into an n8n Code node unchanged. It is tested against `fixtures/`.
- **Ingestion is idempotent.** `gmail_message_id` is unique; sending the same email twice must not create a second row.
- **Database changes go through migrations.** Never use TypeORM `synchronize`.
- **No raw email bodies in the database.** Store only extracted fields.

## Privacy and security (strict)

- Never read, print, log or commit `.env` or any secret. Work with `.env.example`.
- Never commit real personal data: email addresses, employee ID (legajo), street addresses, attachment names. Fixtures stay anonymized.
- Districts and street addresses are stored in the database (a decision of the owner) and are personal data: only authenticated endpoints return them, they are never logged, and they are sent to the map provider only from the backend.
- Do not log request bodies from `/ingest`, passwords, tokens or addresses.
- `/ingest` requires the `x-api-key` header, checked against `INGEST_API_KEY` in constant time (see `docs/spec.md`, section 5). Read endpoints require the session cookie (section 12).
- Bind dev services to `127.0.0.1`.

## How to work

- Take one task at a time. Before writing code for anything non-trivial, state a short plan.
- Work on a branch named `feat/<role>-<topic>` (for example `feat/back-auth`, `feat/front-layout`). One branch per task.
- Small, logical commits using Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).
- **Push is allowed on your own branch, never on `main`, never forced, never on a branch another agent works on.** Do not open a pull request unless the owner asks. The owner reviews and merges.
- Every behavior change comes with tests. Run lint, tests and build before declaring a task done.
- Do not add features, dependencies or files that the task did not ask for. A new dependency needs the owner's approval, unless it is listed as pre-approved in your role file.
- Do not touch files outside your role's folders.
- Finish every task with a report: files created or modified, commands to run, decisions you made that were not specified, contract change requests, and what you could not do or verify.

## Tasks only the owner can do

Say so explicitly instead of attempting them: authorizing Apps Script (Google OAuth in the browser), importing workflows into n8n and creating its credentials, Caddy and Cloudflare Tunnel changes, Portainer stack creation, GitHub repository secrets, anything that needs production credentials.

## Definition of done

Tests, lint and build pass, the verification steps of the task were actually run, docs updated if the contract changed (proposed to the owner, not edited silently), and the final report is delivered.
