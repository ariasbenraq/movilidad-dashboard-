# Roadmap for the two agents

Each task is one branch (`feat/back-*` or `feat/front-*`), reviewed and merged by the owner before dependent tasks start. FRONT never waits for BACK: it works against typed mocks of `docs/api-contract.md`.

| Task | Role | Depends on | Done when |
|---|---|---|---|
| B1 Parser v2 and migration | BACK | none | Parser extracts districts, addresses and `hora_inicio` (fixtures extended, anonymized); `/ingest` stores them; migration adds columns, `distrito_equivalencias`; version `2.0.0`; n8n workflow updated |
| B2 Auth | BACK | none | `/auth/*` and the guard work; CLI creates the user; tests cover failures and rate limit |
| B3 Read API | BACK | B1, B2 | `/resumen`, `/proyeccion`, `/diario`, `/registros` match the contract; cache invalidation tested |
| B4 District analytics and equivalences | BACK | B3 | `/analitica/distritos` and `/distritos/equivalencias` match the contract |
| B5 Bus expenses | BACK | B2 | `/bus-gastos` CRUD matches the contract |
| B6 Routes and budget | BACK | B4, B5 | OpenRouteService client with cache, `/analitica/rutas`, `/presupuesto` |
| F1 Layout, theme, login | FRONT | tree approved | Phase (a) of `frontend/AGENTS.md` |
| F2 Data layer and mocks | FRONT | F1 | Phase (b) |
| F3 Dashboard components | FRONT | F2 | Phase (c) |
| F4 Integration and states | FRONT | F3, B3 | Phase (d), mocks replaced by the API |
| F5 District analytics view | FRONT | F4, B4 | Analytics page |
| F6 Bus form and comparison | FRONT | F4, B5, B6 | Bus form, taxi vs bus view |
| D1 CI on pull requests | owner + agent | B1, F1 | Lint, tests, build for backend, frontend, parser and Apps Script |
| D2 Deploy on merge to main | owner | D1 | Images built, stack updated on the server |

After B1 is deployed, the owner clears `movilidad_registros`, removes the `procesado` and `movilidad-error` labels in Gmail and lets Apps Script reprocess the history (see `docs/decisiones.md`).
