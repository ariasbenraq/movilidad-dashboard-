# movilidad-dashboard

Personal dashboard that projects the monthly transport reimbursement. Receipt
emails arrive via Google Forms in Gmail, are parsed by n8n, and will be stored
in Postgres through a NestJS backend (Redis as cache). The React frontend will
be added later.

This repository currently contains the backend skeleton and the local
development infrastructure.

## Requirements

- Node.js 24+ and npm
- Docker + Docker Compose

## First run

```bash
cp .env.example .env
# edit DB_PASSWORD in .env (placeholder is change_me)
npm run dev:up
```

Wait until both containers are healthy:

```bash
docker compose -f docker-compose.dev.yml ps
```

Install and start the backend:

```bash
cd backend
npm install
npm run start:dev
```

Check the service:

```bash
curl localhost:3000/health
# {"status":"ok","db":"up","redis":"up"}
```

## Root scripts

| Script           | Description                                      |
| ---------------- | ------------------------------------------------ |
| `npm run dev:up`   | Start Postgres (127.0.0.1:5433) and Redis (6380) |
| `npm run dev:down` | Stop the local containers                         |
| `npm run dev:logs` | Follow the containers' logs                       |

## Backend scripts

Run these from `backend/`.

| Script                          | Description                                 |
| ------------------------------- | ------------------------------------------- |
| `npm run start:dev`             | Start NestJS in watch mode                  |
| `npm run build`                 | Compile to `dist/`                          |
| `npm run lint`                  | Lint with the Nest default linter (oxlint)  |
| `npm run test`                  | Run unit tests (vitest)                     |
| `npm run migration:generate -- src/migrations/Name` | Generate a migration |
| `npm run migration:run`         | Apply pending migrations                    |
| `npm run migration:revert`      | Revert the last migration                   |

## Configuration

The only source of truth for environment variables is the root `.env`
(git-ignored). Both Docker Compose and the backend read it. See
`.env.example` for the full list. The backend validates these variables at
startup and fails fast if any required value is missing or invalid.

`INGEST_API_KEY` is required (at least 32 characters; the placeholder in
`.env.example` is too short on purpose). Generate one with `openssl rand -hex 32`.
Apply the schema with `npm run migration:run` from `backend/`.

Integration tests for `POST /ingest` need a disposable Postgres and Redis (the
table is truncated). Run them from `backend/` with `RUN_INTEGRATION=1` and the
`DB_*`, `REDIS_*` and `INGEST_API_KEY` variables set; plain `npm run test` skips them.

Database schema changes use TypeORM migrations; `synchronize` is disabled.
The TypeORM CLI data source lives in `backend/src/database/data-source.ts`.
