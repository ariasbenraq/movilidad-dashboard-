# AGENTS.md

Guidance for AI coding agents (OpenCode) working in this repository. Read this file and `docs/spec.md` before changing anything.

## What this project is

A personal dashboard that projects the monthly reimbursement of transport expenses I (the owner) will receive. Expense data arrives as Google Forms receipt emails in Gmail.

Flow: Gmail → Apps Script (transport only) → n8n webhook (parsing) → NestJS `POST /ingest` → Postgres → read API (Redis cache) → React dashboard.

Source of truth, in this order:
1. `docs/decisiones.md` — business decisions made by the owner (dates, overtime, working days, payday rules).
2. `docs/spec.md` — technical contract (schema, endpoints, projection algorithm, caching, non-functional requirements).
3. This file — how to work.

If these conflict or something is ambiguous, stop and ask. Do not guess business rules.

## Repository layout

```
backend/                NestJS API (TypeScript, TypeORM, ioredis)
n8n/                    parser.js (pure function pasted into the n8n Code node), workflow JSON exports, parser tests
apps-script/            Gmail Apps Script (.gs)
frontend/               React + Vite dashboard (later)
fixtures/               anonymized email bodies (*.txt) + *.expected.json
docs/                   decisiones.md, spec.md
docker-compose.dev.yml  local Postgres + Redis
```

Folders that do not exist yet are created by their own task, not before.

## Commands

- Dev infrastructure: `docker compose -f docker-compose.dev.yml up -d`
- Backend (from `backend/`): `npm run start:dev`, `npm run lint`, `npm run test`
- Migrations (from `backend/`): `npm run migration:generate`, `npm run migration:run`, `npm run migration:revert`
- Use npm. Do not introduce pnpm or yarn.

## Environment variables

Single `.env` at the repo root (read by docker compose and by the backend), documented in `.env.example` with placeholders only. The backend validates them at startup and fails fast.

`NODE_ENV`, `PORT`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `REDIS_HOST`, `REDIS_PORT`, `INGEST_API_KEY` (required, at least 32 characters; the placeholder in `.env.example` must be obviously fake and shorter than the minimum, so a copied example fails validation).

## Architecture rules

- **Business rules live in the backend only.** Periods, payday, projection and overtime minutes are computed by NestJS. n8n parses and forwards. Apps Script only transports. Do not duplicate rules in n8n, Apps Script or the frontend.
- **The parser is a pure function** (`n8n/parser.js`): plain text in, JSON out, no dependencies, CommonJS, so it can be pasted into an n8n Code node unchanged. It is tested against `fixtures/`.
- **Ingestion is idempotent.** `gmail_message_id` is unique; sending the same email twice must not create a second row.
- **Database changes go through migrations.** Never use TypeORM `synchronize`.
- **No raw email bodies in the database.** Store only extracted fields.

## Privacy and security (strict)

- Never read, print, log or commit `.env` or any secret. Work with `.env.example`.
- Never commit real personal data: email addresses, employee ID (legajo), street addresses, attachment names. Fixtures must stay anonymized.
- Do not log request bodies from `/ingest`.
- `/ingest` requires the `x-api-key` header, checked against `INGEST_API_KEY` in constant time (see `docs/spec.md`, section 5).
- Bind dev services to `127.0.0.1`.

## How to work

- Take one task at a time. Before writing code for anything non-trivial, state a short plan.
- Small, logical commits using Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`). Work on a feature branch.
- **Do not push.** The owner reviews the diff and pushes.
- Every behavior change comes with tests. Run lint and tests before declaring a task done.
- Do not add features, dependencies or files that the task did not ask for.
- Finish every task with a report: what changed, commands to run, decisions you made that were not specified, and what you could not do or verify.

## Tasks only the owner can do

Say so explicitly instead of attempting them: authorizing Apps Script (Google OAuth in the browser), importing workflows into n8n and creating its credentials, Caddy and Cloudflare Tunnel changes, Portainer stack creation, GitHub repository secrets, anything that needs production credentials.

## Definition of done

Tests and lint pass, the verification steps of the task were actually run, docs updated if the contract changed, and the final report is delivered.
