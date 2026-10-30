# API contract: movilidad-dashboard

This is the contract between the BACK agent (implements it) and the FRONT agent (consumes it). `docs/decisiones.md` and `docs/spec.md` win over this file; if they disagree, stop and ask the owner.

Rules for changing it: a change to a shape, a field name or a status code is proposed in writing and approved by the owner **before** either agent codes it. Each agent reports in its final message whether it relied on the contract as written.

Status of each endpoint: **v1** = to build now. **v2** = specified so FRONT can mock it, built later.

## Conventions

- Base URL: `https://movilidad-api.hamstitors.trade` (production), `http://localhost:3000` (development).
- JSON only. Field names `snake_case`. Dates `YYYY-MM-DD`, times `HH:MM`, timestamps ISO 8601 with offset. Time zone `America/Lima`.
- Money: JSON numbers with 2 decimals, PEN. Never strings.
- `periodo`: `YYYY-MM`. Default is the current month in `America/Lima`. An invalid value is `400`.
- Authentication: session cookie `session` (httpOnly), set by `POST /auth/login`. Browsers must send `credentials: 'include'`. Every endpoint below requires it unless marked public.
- Errors use Nest's default shape: `{ "statusCode": 400, "message": ["..."] | "...", "error": "Bad Request" }`. `401` means no valid session: the frontend sends the user to the login page.
- Strings that may be unknown are `null`, never `""`.
- Addresses are personal data: show them only inside the authenticated app, never log them.

## Auth (v1)

### `POST /auth/login`

Request: `{ "username": "string", "password": "string" }`.
`204` with `Set-Cookie: session=...; HttpOnly; Secure; SameSite=Lax; Max-Age=604800; Path=/`. `401` for wrong credentials (same message whether the user or the password is wrong). `429` after 5 failed attempts in 15 minutes from one IP.

### `POST /auth/logout`

`204`, clears the cookie. Works without a session.

### `GET /auth/me`

`200 { "username": "renzo" }` or `401`. The frontend calls it on start to decide between the login page and the app.

## Summary and projection (v1)

### `GET /resumen?periodo=`

```json
{
  "periodo": "2026-10",
  "cerrado": false,
  "total": 412.30,
  "costo_movilidad": 389.80,
  "otros_gastos": 22.50,
  "registros": 21,
  "por_revisar": 2,
  "horas_extra_minutos": 150,
  "horas_extra_monto": null,
  "ultimo_registro_at": "2026-10-29T18:12:00-05:00",
  "fecha_pago": "2026-11-16"
}
```

`total = costo_movilidad + otros_gastos`. `horas_extra_monto` is `null` without a configured rate. `fecha_pago` follows the payday rules (the 15th of the next month, moved to the next business day if it falls on a weekend or holiday).

### `GET /proyeccion?periodo=`

```json
{
  "periodo": "2026-10",
  "cerrado": false,
  "acumulado": 412.30,
  "promedio_diario": 19.63,
  "dias_con_gasto": 21,
  "dias_laborables_restantes": 2,
  "proyectado": 451.56,
  "muestra_insuficiente": false,
  "progreso": 0.91,
  "dias_transcurridos": 29,
  "dias_del_mes": 31,
  "fecha_pago": "2026-11-16",
  "horas_extra_minutos": 150,
  "horas_extra_monto": null
}
```

`progreso = acumulado / proyectado`, between 0 and 1 (1 when `proyectado` is 0 and the period is closed, 0 when it is 0 and open). For a closed period `proyectado = acumulado`, `dias_laborables_restantes = 0` and `progreso = 1`. `proyectado` is an upper-end estimate by design and the frontend labels it as such.

### `GET /diario?periodo=`

```json
{
  "periodo": "2026-10",
  "items": [
    { "fecha": "2026-10-07", "costo_movilidad": 29.90, "otros_gastos": 6.50, "total": 36.40, "registros": 1, "acumulado": 36.40 }
  ]
}
```

One item per calendar day that has records, ascending by `fecha`. `acumulado` is the running total of `total`. Days without records are not returned (the frontend fills gaps for charts if it wants to).

## Records (v1)

### `GET /registros`

Query: `periodo` (or `desde` + `hasta`, both `YYYY-MM-DD`; `periodo` wins if both are sent), `cliente` (exact), `workorder` (exact), `por_revisar` (`true` returns only flagged rows), `page` (default 1), `limit` (default 20, max 100). Sorted by `fecha`, then `hora_inicio`, descending.

```json
{
  "items": [
    {
      "id": 123,
      "fecha": "2026-10-07",
      "hora_inicio": "15:00",
      "workorder": "W610052371",
      "cliente": "BANCO DE CREDITO DEL PERU",
      "desde": { "distrito": "Sjm", "distrito_canon": "San Juan de Lurigancho", "direccion": "..." },
      "hacia": { "distrito": "Jesus Maria", "distrito_canon": "Jesús María", "direccion": "..." },
      "costo_movilidad": 29.90,
      "otros_gastos": 6.50,
      "otros_detalle": "Isopos para mantenimiento de sensores",
      "total": 36.40,
      "he_inicio": null,
      "he_fin": null,
      "he_minutos": 0,
      "needs_review": false,
      "review_reason": null
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 21
}
```

`distrito_canon` is `null` when the text has no equivalence yet. `review_reason` is a comma-separated string of codes (`incomplete_overtime`, `invalid_overtime`, `no_amounts`, `possible_duplicate`, `unknown_district`) or `null`. `total` in the page wrapper is the number of rows matching the filters.

## District analytics (v1)

### `GET /analitica/distritos?periodo=`

Most visited destination districts of the month. A visit is one record with that canonical destination district. Records whose destination has no equivalence are grouped under `distrito: null`.

```json
{
  "periodo": "2026-10",
  "items": [
    {
      "distrito": "Jesús María",
      "visitas": 9,
      "costo_total": 215.10,
      "costo_promedio": 23.90,
      "clientes": [ { "cliente": "BANCO DE CREDITO DEL PERU", "visitas": 7 } ],
      "workorders": [ { "workorder": "W610151086", "visitas": 2 } ],
      "visitas_anio_hasta_hoy": 61,
      "meses_restantes": 2,
      "visitas_anio_estimadas": 79
    }
  ]
}
```

Sorted by `visitas` descending. `workorders` lists at most 10 per district, sorted by `visitas`. Year estimate: `visitas_anio_estimadas = visitas_anio_hasta_hoy + visitas × meses_restantes`, where `visitas_anio_hasta_hoy` counts the visits to that district from January 1 through the end of the requested `periodo`, and `meses_restantes = 12 - mes del periodo`. Note: return trips count as visits to their destination (usually the home district); review the numbers with real data before trusting them.

## Districts (v1)

### `GET /distritos/equivalencias`

`200 { "items": [ { "texto_normalizado": "sjm", "distrito": "San Juan de Lurigancho" } ], "sin_mapear": [ { "texto": "Sjm", "registros": 12 } ] }`. `sin_mapear` lists distinct raw texts of stored records that have no equivalence, with how many records use each, most used first.

### `PUT /distritos/equivalencias`

Request: `{ "texto": "Sjm", "distrito": "San Juan de Lurigancho" }` (the server normalizes `texto`). `200` with the stored item. Re-derives the canonical columns and the `unknown_district` flag of the affected records. `400` if either value is empty or longer than 100 chars.

### `DELETE /distritos/equivalencias/:texto_normalizado`

`204`; re-derives the affected records (they become unmapped again). `404` if it does not exist.

## Bus expenses (v2)

A manual, parallel record to compare against taxi. It never changes the taxi totals.

### `POST /bus-gastos`

Request: `{ "fecha": "2026-10-07", "desde": "Sjm", "hacia": "Jesús María", "costo": 3.50, "duracion_min": 75, "nota": null }`. `desde` and `hacia` are free text, normalized with the same equivalence table. `fecha` is a real date, not after tomorrow; `costo` 0 to 500 with at most 2 decimals; `duracion_min` optional integer 1 to 600; `nota` optional, max 200. `201 { "id": 1 }`.

### `GET /bus-gastos?periodo=`

`200 { "items": [ { "id": 1, "fecha": "2026-10-07", "desde": { "distrito": "Sjm", "distrito_canon": "..." }, "hacia": { ... }, "costo": 3.50, "duracion_min": 75, "nota": null } ] }`, newest first.

### `PUT /bus-gastos/:id` and `DELETE /bus-gastos/:id`

`PUT` takes the same body as `POST` and returns `200`; `DELETE` returns `204`. `404` if the id does not exist. Bus entries are typed by hand, so correcting them is allowed (taxi records stay read-only).

## Routes and budget (v2)

### `GET /analitica/rutas?periodo=`

Historical routes of the month (canonical origin to canonical destination).

```json
{
  "periodo": "2026-10",
  "items": [
    {
      "desde": "San Juan de Lurigancho",
      "hacia": "Jesús María",
      "viajes": 9,
      "costo_promedio": 23.90,
      "costo_total": 215.10,
      "distancia_km": 18.4,
      "duracion_taxi_min": 52,
      "geocode_confianza": 0.82
    }
  ]
}
```

`distancia_km`, `duracion_taxi_min` and `geocode_confianza` are `null` until the route has been geocoded and routed (done in the background and cached). `duracion_taxi_min` already includes `factor_trafico`.

### `GET /presupuesto?periodo=`

`periodo` is the month being budgeted (normally next month); the base is the last `presupuesto_meses` closed months before it.

```json
{
  "periodo": "2026-11",
  "base_meses": ["2026-08", "2026-09", "2026-10"],
  "taxi": { "total": 468.00, "minutos": 1180 },
  "bus": { "total": 96.50, "minutos": 2210, "incompleto": true },
  "diferencia_costo": 371.50,
  "rutas": [
    {
      "desde": "San Juan de Lurigancho",
      "hacia": "Jesús María",
      "viajes_esperados": 9,
      "taxi": { "costo_promedio": 23.90, "costo_total": 215.10, "duracion_min": 52 },
      "bus": { "costo_promedio": 3.50, "costo_total": 31.50, "duracion_min": 75 }
    }
  ]
}
```

`viajes_esperados` is the average number of trips per month of that route in the base months, rounded to the nearest integer. A route without bus data has `"bus": null`; the bus totals then cover only the routes that have data and `bus.incompleto` is `true`. Likewise `duracion_min` is `null` where it is unknown. `diferencia_costo = taxi.total - bus.total` (negative if bus costs more), `null` while `bus.incompleto` is true.

## Public endpoints

- `GET /health` -> `{ "status": "ok", "db": "up", "redis": "up" }` or `503`.
- `POST /ingest` (header `x-api-key`): used only by n8n, defined in `docs/spec.md` section 5. The frontend never calls it.

## Open points

- A return trip counts as a visit to its destination in the district analytics (see above).
- Whether `GET /presupuesto` should also accept a manual list of planned visits (option b of the budget) is a later decision.
