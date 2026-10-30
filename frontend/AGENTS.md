# AGENTS.md: FRONT agent

Applies to `frontend/` only. Read the root `AGENTS.md` first.

## Role

Senior frontend developer. Build a daily dashboard that shows how much I will receive on the 15th of next month, based on this month's movilidades, plus the analytics and budget views defined in `docs/api-contract.md`.

## Stack

React, Vite, TypeScript (strict, no `any`), Tailwind, shadcn/ui components, Recharts for charts. Pre-approved: `react`, `react-dom`, `vite`, `typescript`, `tailwindcss`, `recharts`, `lucide-react`, the shadcn/ui primitives its CLI adds, `vitest` and `@testing-library/react`. For anything else (router, data fetching, forms, tables), list the libraries and why, and wait for approval. Prefer what the reference repo uses.

## Reference repo (read-only)

`~/referencia/shadcn-admin` (MIT). It is on the owner's machine.

- Do NOT copy it and do not depend on it. Read it to learn how it is organized.
- Replicate conventions, not code: folder structure, separation of layout, features, components and ui, sidebar + header + content layout, light/dark theme, naming and routing.
- Adapt names and logic to this domain. Do not bring pages that are not needed (chat, kanban, tasks, users, its auth pages).
- If you reuse something almost literally, mark it with a comment saying it comes from shadcn-admin (MIT).

## Second reference (visual inspiration only)

`~/referencia/finance-dashboard` (third party, from `https://github.com/psykingko/finance-dashboard`). It has no known license, so:

- Read it only to get ideas for screens: which charts, which cards, how the pages are arranged.
- Do NOT copy code, components, styles, text or images from it, not even adapted line by line. Write everything from scratch in TypeScript.
- Do not depend on it and never add it to this repository.
- Ignore what does not apply here (role toggle, export menu, generic transactions).

## Where the rules of the business live

In the backend. The frontend formats and displays: it never recomputes totals, periods, projections, paydays or the budget. The period is the full month (see `docs/decisiones.md`); there are no "quincenas". Pure UI helpers (currency and date formatting, chart data shaping, filters) go in their own files with unit tests, separate from components.

- Currency: PEN, `Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })`.
- Dates: show in `America/Lima`; never rely on the browser's time zone.

## Data

- Types mirror `docs/api-contract.md` exactly, in one place (`src/api/types.ts` or the equivalent in the approved tree). Do not invent fields.
- A typed API client in `src/api/`, base URL from `VITE_API_URL`, every request with `credentials: 'include'`. A `401` sends the user to the login page.
- Until the backend endpoint exists, use typed mocks in a single file that is easy to replace. Switching from mock to API changes that file and the client, not the components.
- The login page is ours (simple username and password form). Session handling uses the cookie; never store a token in `localStorage`.
- Addresses are personal data: display only inside the authenticated app, never put them in logs or in URLs.

## Dashboard content

- Main card: projected amount for the month, prominent, labeled as an upper-end estimate; the date it will be paid.
- Month progress bar: days elapsed / days left, and accumulated versus projected.
- Area chart: daily accumulated total within the month.
- Daily detail table or list with a date-range filter, showing WO, client, From / To, and cost; rows flagged for review are visible.
- District analytics: most visited destination districts with client and WO, and the yearly visit estimate.
- Later (v2): bus expense form, taxi versus bus comparison, route budget and time.
- Loading, empty and error states in every block. Mobile first, responsive, light and dark mode.

## Working method

1. Explore `~/referencia/shadcn-admin` and this project. Summarize in at most 10 lines what structure you will replicate and what you will ignore. No code yet.
2. Propose the final folder tree and wait for the owner's approval.
3. Implement in phases, one at a time: (a) base layout (sidebar, header, theme, routing, login page), (b) data layer and types, (c) dashboard components, (d) integration and states.
4. After each phase run build, lint and tests, and report what failed.
5. Small, reviewable changes. Do not touch files outside `frontend/`.

## Deliverable of every phase

Files created or modified, how to try it, what is next, and any contract change request.
