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
| `Especificar COSTO DE MOVILIDAD` | `costo_movilidad` | Optional. Label absent (the form can omit conditional sections) or present but empty = 0. Always a number, never null. |
| `Especificar MONTO DE OTROS GASTOS` | `otros_gastos` | Optional. Label absent (the form can omit conditional sections) or present but empty = 0. Always a number, never null. |
| `Especificar detalle de OTROS GASTOS` | `otros_detalle` | Optional free text. |
| `GENERACION DE HORAS H. EXTRA - Hora de inicio` / `- Hora de final` | `he_inicio`, `he_fin` | Optional, `HH:MM`. A blank or incomplete time becomes `null`. |
| `ESPECIFICAR MONTO DEL GASTO de hospedaje y alimentación` | not used | Must NOT be confused with otros gastos. |
| workorder, cliente, tipo de traslado | `workorder`, `cliente`, `tipo_traslado` | Optional, informational. |

The parser **throws** (it does not guess) when `fecha_form` is missing or not a valid date, or when an amount label contains non-numeric content. It returns amounts already rounded to 2 decimals.

Accepted amount grammar: digits with an optional decimal part separated by `.` or `,` (`29`, `29.9`, `29,90`). A dot may carry more than two decimals (`12.345` rounds half-up to `12.35`, done with integer arithmetic, not floats). A comma followed by three or more digits (`1,234`), mixed separators (`1,234.50`, `1.234,50`) and anything non-numeric throw `INVALID_AMOUNT`.

`tipo_traslado` is always `null`: the plain-text body lists every checkbox option without showing which one was selected. The field stays in the contract for a future source (for example the HTML body).

Never stored: the sender email, employee ID (legajo), street addresses, districts, attachment names, raw body.

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
| `review_reason` | text NULL | Comma-separated review codes in fixed order; NULL when nothing to review. |
| `needs_review` | boolean GENERATED ALWAYS AS (`review_reason` IS NOT NULL) STORED | Cannot drift from `review_reason`. |
| `parser_version` | text NOT NULL | Max 20 chars. |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |

Indexes: `(periodo)`, `(fecha_form)`, `(fecha_form, workorder)` (supports the duplicate check).

### `config` (key/value, text)

| Key | Default | Meaning |
|---|---|---|
| `timezone` | `America/Lima` | Used for "today" and period boundaries. |
| `dias_laborables` | `1,2,3,4,5,6` | ISO weekdays counted as working days (Monday to Saturday). |
| `pago_dia` | `15` | Day of the next month when the period is paid. |
| `pago_fin_de_semana` | `next` | If payday is a weekend or holiday: `next` or `previous` business day. |
| `tarifa_hora_extra` | (absent) | PEN per hour. If absent, overtime is reported in hours only. |

### `feriados`

`fecha` date PK, `nombre` text. Loaded from the official Peruvian holiday list, never typed from memory.

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
  "parser_version": "1.0.0"
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

All read endpoints take `periodo=YYYY-MM` (default: current month in `timezone`). In v1 they carry no application-level auth; access is restricted at the network level (Tailscale or Cloudflare Access).

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

User accounts and login, multiple users, multiple currencies, editing or deleting records from the dashboard, correcting a stored row by re-ingesting it, storing attachments, Gmail push (Pub/Sub).
