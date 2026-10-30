# Technical spec: movilidad-dashboard

Business decisions (dates, overtime, working days, payday, projection) live in `docs/decisiones.md` and always win. This document is the technical contract. Defaults below mirror `decisiones.md` and are stored as configuration, not hardcoded.

## 1. Goal

Show, for the current month, how much reimbursement the owner is going to receive and when, based on the Google Forms receipts emailed after each service. Currency is PEN only.

## 2. Pipeline

1. **Apps Script** runs every 1 minute, finds form emails that carry neither the `procesado` nor the `movilidad-error` label, and POSTs `{ messageId, receivedAt, body }` to the n8n webhook. It reacts to the HTTP status: `2xx` → label `procesado`; `422` → label `movilidad-error` (no automatic retry); `5xx` or network error → no label (retried on the next run).
2. **n8n** runs `parser.js` on the body and calls `POST /ingest`. It answers Apps Script with `200` if ingest returned 201 or 200, `422` if the parser failed or ingest returned 400, `502` if ingest returned 5xx or was unreachable. Parser failures and 400s raise an alert that includes the `messageId` and the error text. The backend never receives an email that could not be parsed.
3. **Backend** validates, derives period, overtime minutes and review flags, stores the row in one transaction, invalidates the cache.
4. **Frontend** reads the read API and refreshes every 30–60 seconds.

## 3. Email format and parser contract

Subject: `Gracias por rellenar este formulario: FORMULARIO GASTOS DE MOVILIDAD`. Sender: `forms-receipts-noreply@google.com`. The parser reads the plain-text body. Real, anonymized examples in `fixtures/` are the source of truth for the format; the parser is developed against them, not against this table.

| Field in email (label) | Parsed as | Notes |
|---|---|---|
| `FECHA FORMS` (DD / MM / AAAA) | `fecha_form` | Date of the expense. Required. |
| `Especificar COSTO DE MOVILIDAD` | `costo_movilidad` | Optional. Label present but empty = 0. |
| `Especificar MONTO DE OTROS GASTOS` | `otros_gastos` | Optional. Label present but empty = 0. |
| `Especificar detalle de OTROS GASTOS` | `otros_detalle` | Optional free text. |
| `GENERACION DE HORAS H. EXTRA - Hora de inicio` / `- Hora de final` | `he_inicio`, `he_fin` | Optional, `HH:MM`. A blank or incomplete time becomes `null`. |
| `Especificar DISTRITO o DEPARTAMENTO ORIGEN` | `distrito_origen` | Free text. |
| `Especificar Dirección: PUNTO DE PARTIDA` | `direccion_origen` | Free text. |
| `Especificar DISTRITO O DEPARTAMENTO DESTINO` | `distrito_destino` | Free text. |
| `Especificar Dirección: PUNTO DE LLEGADA` | `direccion_destino` | Free text. |
| `Especificar HORA INICIO de toma de movilidad` | `hora_inicio` | Optional, `HH:MM`; blank or incomplete = `null`. Not the overtime hours. |
| `ESPECIFICAR MONTO DEL GASTO de hospedaje y alimentación` | not used | Must NOT be confused with otros gastos. |
| workorder, cliente, tipo de traslado | `workorder`, `cliente`, `tipo_traslado` | Optional, informational. |

The parser **throws** (it does not guess) when `fecha_form` is missing or not a valid date, or when an amount label contains non-numeric content. It returns amounts already rounded to 2 decimals.

Never stored: the sender email, employee ID (legajo), attachment names, raw body. Districts and street addresses ARE stored (see `decisiones.md`): they are personal data, so they are returned only to authenticated endpoints, never logged and never committed (fixtures stay anonymized). Transport is always taxi.

Parser version for this contract: `2.0.0`.

## 4. Data model (PostgreSQL)

### `movilidad_registros`

| Column | Type | Notes |
|---|---|---|
| `id` | bigserial PK | |
| `gmail_message_id` | text NOT NULL UNIQUE | Idempotency key. |
| `received_at` | timestamptz NOT NULL | When the email arrived. |
| `fecha_form` | date NOT NULL | Date of the expense. Decides the period. |
| `periodo` | char(7) NOT NULL | `YYYY-MM`, derived server-side from `fecha_form`. |
| `costo_movilidad` | numeric(10,2) NOT NULL DEFAULT 0 | CHECK between 0 and 5000. |
| `otros_gastos` | numeric(10,2) NOT NULL DEFAULT 0 | CHECK between 0 and 5000. |
| `otros_detalle` | text NULL | Max 500 chars. |
| `he_inicio`, `he_fin` | time NULL | |
| `he_minutos` | integer NOT NULL DEFAULT 0 | Derived server-side, see section 5. |
| `workorder`, `cliente`, `tipo_traslado` | text NULL | |
| `distrito_origen`, `distrito_destino` | text NULL | As written in the email, max 100 chars. |
| `direccion_origen`, `direccion_destino` | text NULL | As written in the email, max 200 chars. |
| `distrito_origen_canon`, `distrito_destino_canon` | text NULL | Canonical district from `distrito_equivalencias`; NULL when the text is not mapped. |
| `hora_inicio` | time NULL | Start of the trip. |
| `review_reason` | text NULL | Comma-separated review codes in fixed order; NULL when nothing to review. |
| `needs_review` | boolean GENERATED ALWAYS AS (`review_reason` IS NOT NULL) STORED | Cannot drift from `review_reason`. |
| `parser_version` | text NOT NULL | Max 20 chars. |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |

Indexes: `(periodo)`, `(fecha_form)`, `(fecha_form, workorder)` (supports the duplicate check), `(distrito_destino_canon)`.

### `config` (key/value, text)

| Key | Default | Meaning |
|---|---|---|
| `timezone` | `America/Lima` | Used for "today" and period boundaries. |
| `dias_laborables` | `1,2,3,4,5,6` | ISO weekdays counted as working days (Monday to Saturday). |
| `pago_dia` | `15` | Day of the next month when the period is paid. |
| `pago_fin_de_semana` | `next` | If payday is a weekend or holiday: `next` or `previous` business day. |
| `tarifa_hora_extra` | (absent) | PEN per hour. If absent, overtime is reported in hours only. |
| `factor_trafico` | `1.3` | Multiplier on the OpenRouteService taxi duration. |
| `presupuesto_meses` | `3` | Closed months averaged for the budget. |

### `feriados`

`fecha` date PK, `nombre` text. Loaded from the official Peruvian holiday list, never typed from memory.

### `distrito_equivalencias`

`texto_normalizado` text PK (lowercase, no accents, single spaces), `distrito` text NOT NULL (canonical name). Maintained by the owner. Ingest looks up `distrito_origen` and `distrito_destino` here; a miss leaves the `*_canon` column NULL and adds the review code `unknown_district`. Adding an equivalence re-derives the `*_canon` columns and the review flag of the affected rows (the only update that touches stored rows).

### `users`

`id` bigserial PK, `username` text UNIQUE NOT NULL, `password_hash` text NOT NULL (argon2id), `created_at` timestamptz. Single user, created from a CLI script; there is no public registration.

### `bus_gastos` (v2)

`id` bigserial PK, `fecha` date, `distrito_origen_canon` text, `distrito_destino_canon` text, `costo` numeric(10,2) CHECK between 0 and 500, `duracion_min` integer NULL CHECK between 1 and 600, `nota` text NULL (max 200), `created_at`. Entered by hand; never mixed into the taxi totals.

### `rutas_cache` (v2)

`origen_hash` + `destino_hash` (SHA-256 of the normalized addresses) PK, `distancia_m`, `duracion_s`, `geocode_confianza` numeric, `fetched_at`. Avoids repeating OpenRouteService calls for the same pair of addresses.

## 5. Ingestion: `POST /ingest`

Auth: header `x-api-key`, compared with env `INGEST_API_KEY` in constant time (compare `crypto.timingSafeEqual` over the SHA-256 digests of both values, so length does not leak). Missing or wrong: `401`.

Request body (JSON):

```json
{
  "gmail_message_id": "18f3c2a1b2c3d4e5",
  "received_at": "2026-10-07T20:41:00-05:00",
  "fecha_form": "2026-10-07",
  "costo_movilidad": 29.9,
  "otros_gastos": 6.5,
  "otros_detalle": "Isopos para mantenimiento de sensores",
  "he_inicio": null,
  "he_fin": null,
  "workorder": "W610052371",
  "cliente": "BCP",
  "tipo_traslado": null,
  "distrito_origen": "San Juan de Lurigancho",
  "direccion_origen": "(address)",
  "distrito_destino": "Jesus Maria",
  "direccion_destino": "(address)",
  "hora_inicio": "15:00",
  "parser_version": "2.0.0"
}
```

### Validation

| Field | Required | Rules |
|---|---|---|
| `gmail_message_id` | yes | string, 1–64 chars, `[A-Za-z0-9_-]` only |
| `received_at` | yes | ISO 8601 with UTC offset |
| `fecha_form` | yes | `YYYY-MM-DD`, a real calendar date, between `2020-01-01` and today + 1 day (in `timezone`) |
| `costo_movilidad`, `otros_gastos` | no (missing or `null` = 0) | JSON number (strings rejected), 0 to 5000 **each** (the limit is per amount, not total), at most 2 decimals (more decimals are rejected, not rounded) |
| `otros_detalle` | no | string, max 500 |
| `he_inicio`, `he_fin` | no | `HH:MM` 24-hour, regex `^([01]\d\|2[0-3]):[0-5]\d$`; seconds are rejected |
| `workorder` | no | string, max 50 |
| `cliente`, `tipo_traslado` | no | string, max 100 |
| `distrito_origen`, `distrito_destino` | no | string, max 100 |
| `direccion_origen`, `direccion_destino` | no | string, max 200 |
| `hora_inicio` | no | `HH:MM`, same rule as `he_inicio` |
| `parser_version` | yes | string, 1–20 |

Strings are trimmed and an empty string becomes `null`. Unknown fields are rejected with `400` (`forbidNonWhitelisted` on this endpoint).

### Derived values

- `periodo` = `YYYY-MM` of `fecha_form`.
- `he_minutos`: if both `he_inicio` and `he_fin` are present and different, `(he_fin - he_inicio)` modulo 24 h, so an end earlier than the start crosses midnight. In every other case it is 0.

### Review flags

Evaluated on every new row. All that apply are stored in `review_reason`, comma-separated, always in this order. A row is never rejected because of a review flag.

| Order | Code | Condition |
|---|---|---|
| 1 | `incomplete_overtime` | exactly one of `he_inicio` / `he_fin` is present |
| 2 | `invalid_overtime` | `he_inicio` equals `he_fin` (0 minutes stored; it is not read as 24 hours) |
| 3 | `no_amounts` | `costo_movilidad` = 0 and `otros_gastos` = 0 and `he_minutos` = 0 (so partial or invalid overtime does not count as overtime and can combine with this flag) |
| 4 | `possible_duplicate` | `workorder` is not null and a row with a different `gmail_message_id`, the same `fecha_form`, the same `workorder` and the same `costo_movilidad` (numeric equality) already exists. A null `workorder` never matches. Only the new row is flagged; the earlier row is not modified |
| 5 | `unknown_district` | `distrito_origen` or `distrito_destino` is present but has no entry in `distrito_equivalencias` |

Flagged rows still count in totals, and the dashboard shows how many need review.

### Responses

| Status | Body | When |
|---|---|---|
| `201` | `{ "status": "created", "id": 123 }` | New row stored. |
| `200` | `{ "status": "duplicate" }` | `gmail_message_id` already stored. |
| `400` | Nest default error shape | Validation failed. |
| `401` | Nest default error shape | Bad or missing API key. |
| `500` | Nest default error shape | Unexpected error. |

Every error body uses Nest's default shape: `{ "statusCode": 400, "message": ["fecha_form must be a valid date"], "error": "Bad Request" }` (`message` is an array for validation errors and a string otherwise). Error bodies and logs never echo the request payload.

### Idempotency and concurrency

- A retry of an already stored `gmail_message_id` returns `200 duplicate` **even if the payload differs**. The stored row is never updated by re-ingest. Corrections are a separate, later feature.
- The whole operation runs in **one transaction**: take `pg_advisory_xact_lock(hashtext(fecha_form || ':' || workorder))` when `workorder` is not null, evaluate the review flags, then `INSERT ... ON CONFLICT (gmail_message_id) DO NOTHING RETURNING id`. If no row is returned the insert lost a race or was a retry: discard the computed flags and answer `200 duplicate`. The advisory lock serializes concurrent inserts of the same expense, so the `possible_duplicate` flag is consistent.
- The cache is invalidated only after the transaction commits and only for `201`. Cache errors must never fail the ingest.

## 6. Period and payday rules

- `periodo` = month (`YYYY-MM`) of `fecha_form`.
- The month closes on its last day. It is paid on day `pago_dia` of the following month.
- If that date is a weekend or a holiday, move it to the `next` (default, per `decisiones.md`) or `previous` business day according to `pago_fin_de_semana`.
- A period is **closed** when today (in `timezone`) is after its last day.

## 7. Read API

All read endpoints take `periodo=YYYY-MM` (default: current month in `timezone`) and require a session (see section 12). `/health` and `/ingest` are the exceptions. The exact request and response shapes live in `docs/api-contract.md`, which is the contract the frontend builds against.

| Endpoint | Response |
|---|---|
| `GET /health` | `{ "status": "ok", "db": "up", "redis": "up" }`, or `503` naming the failed dependency. |
| `GET /resumen` | `periodo`, `cerrado`, `total`, `costo_movilidad`, `otros_gastos`, `registros`, `horas_extra_minutos`, `horas_extra_monto` (null without tarifa), `por_revisar`, `ultimo_registro_at`, `fecha_pago`. |
| `GET /diario` | One item per calendar day with records: `fecha`, `costo_movilidad`, `otros_gastos`, `total`, `registros`, `acumulado`. |
| `GET /proyeccion` | See below. |
| `GET /registros` | Paginated list (`page`, `limit`, max 100) of rows with all stored fields, newest first. Includes `needs_review` and `review_reason`. |

Amounts are returned as JSON numbers with 2 decimals.

### Projection

For the current (open) period, following `decisiones.md` (average per day with expense):

- `acumulado` = sum of `costo_movilidad + otros_gastos` for the period.
- `dias_con_gasto` = number of distinct `fecha_form` in the period whose day total (`costo_movilidad + otros_gastos`) is greater than 0.
- `promedio_diario` = `acumulado / dias_con_gasto`, or 0 when `dias_con_gasto` is 0.
- `dias_laborables_restantes` = working days (`dias_laborables`, minus `feriados`) after today until the last day of the month.
- `proyectado` = `acumulado + promedio_diario × dias_laborables_restantes`.
- `muestra_insuficiente` = true when `dias_con_gasto` < 3.

This assumes every remaining working day has an expense, so it is an upper-end estimate by design; the frontend labels it as such.

For a closed period, `proyectado = acumulado` and `dias_laborables_restantes = 0`.

Response: `periodo`, `cerrado`, `acumulado`, `promedio_diario`, `dias_con_gasto`, `dias_laborables_restantes`, `proyectado`, `fecha_pago`, `muestra_insuficiente`, `horas_extra_minutos`, `horas_extra_monto`.

## 8. Cache (Redis)

- Keys: `movilidad:v1:{periodo}:resumen`, `movilidad:v1:{periodo}:diario`, `movilidad:v1:{periodo}:registros:{page}:{limit}`, `movilidad:v1:{periodo}:proyeccion:{YYYY-MM-DD}` (today's date is part of the key because the projection depends on it).
- TTL 300 s as a safety net. The real freshness mechanism is invalidation: a committed ingest deletes every key of that `periodo`.
- If Redis is down, serve from Postgres. The cache is an optimization, never a dependency.

## 9. Fast reaction to new emails (requirement)

New form emails must show up in the dashboard almost immediately.

- Target: **under 2 minutes** from the form email arriving to the record being visible in the dashboard.
- Apps Script trigger every 1 minute (the minimum allowed). Emails that got no response, or a 5xx, are retried on the next run because labeling happens only after the outcome is known (section 2).
- n8n responds to the webhook after the ingest call finishes, with no batching or waiting.
- `/ingest` must be fast (no heavy work in the request path) and idempotent, so retries are always safe.
- Cache invalidation on ingest, plus frontend refresh every 30–60 seconds, so the new record appears without a manual reload.
- A daily reconciliation re-scans the last 3 days of emails that carry neither label.
- A failed ingestion raises an alert (n8n error branch to Telegram or email).
- Possible later upgrade if 1 minute is not enough: Gmail `watch` + Pub/Sub push to an n8n webhook (requires a Google Cloud project and renewal every 7 days). Not in scope now.

## 10. Testing

- **Parser** (`n8n/parser.js`): for each `fixtures/NN-*.txt` there is a `NN-*.expected.json`; tests assert parser output equals it. Edge cases: empty fields, tabs, decimal formats, blank or incomplete hours, hospedaje amount not mistaken for otros gastos, MISCELANEO workorder, and the throwing cases (missing date, non-numeric amount). Run with `node --test` inside `n8n/`, no dependencies.
- **Backend**: unit tests for period derivation, overtime minutes (including crossing midnight and equal times), flag combinations and their order, payday adjustment and projection. Integration tests for `/ingest` against the dev Postgres: idempotency with a changed payload, concurrent retries of the same `gmail_message_id`, concurrent inserts of the same expense, validation errors and unknown fields, API key handling.
- Frontend tests are decided when the frontend task starts.

## 11. Out of scope for now

Multiple users, multiple currencies, editing or deleting records from the dashboard, correcting a stored row by re-ingesting it, storing attachments, Gmail push (Pub/Sub).

## 12. Authentication

Single owner account. `POST /auth/login` checks the argon2id hash and sets a session cookie: a JWT signed with `JWT_SECRET`, `httpOnly`, `Secure` (off only in development), `SameSite=Lax`, valid 7 days. All read endpoints verify it. CORS allows only `CORS_ORIGIN` (`https://mov.hamstitors.trade`) with credentials; the API and the frontend share the registrable domain `hamstitors.trade`, so the cookie travels. Login failures are limited per IP with Redis (5 per 15 minutes). `/ingest` keeps using `x-api-key`. No registration endpoint: the user is created with a CLI script.

## 13. Route budget and time (v2)

Budget for the next month = for every route (canonical origin district to canonical destination district) the average number of trips per month over the last 3 closed months times the average taxi cost of that route. Time = trips times the OpenRouteService driving duration (geocoded exact addresses of that route, from `rutas_cache`) multiplied by the configurable `factor_trafico`. Bus data comes only from `bus_gastos`; a route with no bus data is returned with `null` bus values and the total is marked `incompleto`. Env: `ORS_API_KEY`. OpenRouteService has no live traffic and no public transport, and its geocoding of Lima addresses can be weak: a low `geocode_confianza` is reported, never hidden.
