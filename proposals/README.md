# Lorenzo Proposals — Sales Proposal Builder

Generates branded customer proposals (PDF) from the shared product catalog, with an
in-browser editor, admin-managed templates, share links and full proposal history.

- `proposals/server/` — FastAPI API (port **8030**): templates, generation, rendering, Playwright PDF export, storage, activity log
- `proposals/web/` — Next.js app (port **3007**): sales workflow UI + admin dashboard

## How it fits the platform

| Concern | Approach |
|---|---|
| Auth | Decodes the **same `trainer_auth` JWT cookie** as trainer/server (`TRAINER_JWT_SECRET` must match). No separate login. |
| Users/roles | Shared `users` collection; `admin` + `sales` can use the service, admins see/manage everything. |
| Products | Read-only view over the shared `products` collection (same data the Products app shows). Selected products are **snapshotted** into the proposal, with per-proposal overrides. |
| Database | Same MongoDB Atlas DB (`MONGODB_URI` / `MONGODB_DB_NAME`, default `trainer`). New collections: `proposals`, `proposal_templates`, `proposal_assets`, `proposal_user_profiles`, `proposal_activity`. |
| Storage | S3 if `AWS_*` configured (image/server pattern), otherwise persistent local volume (`PROPOSALS_STORAGE_ROOT`, mounted at `/data` in Docker). |
| PDF | HTML/CSS page templates (1440×810) rendered by headless Chromium (Playwright). The editor previews the **same** HTML, so the export matches the preview exactly. |

## Pages generated (Lorenzo Classic template)

Cover → Company intro (EN/AR) → per room: *Room title* → *Product visual + technical drawing* →
*Specification* → Pricing summary (subtotal / discount / VAT / included services) → Closing.

The default template is seeded automatically on first start (slug `lorenzo-classic`) with the
logo, wave patterns and intro image extracted from the approved sample proposal
(`server/assets/brand/`).

## Local run

### 1. API

```bash
cd proposals/server
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m playwright install chromium   # one-time, for PDF export
cp .env.example .env                    # set MONGODB_URI + TRAINER_JWT_SECRET
python -m uvicorn app:app --reload --port 8030
```

### 2. Web

```bash
cd proposals/web
npm install
npm run dev      # http://localhost:3007
```

Log in at **http://localhost:3007/login** (same account as the trainer dashboard).
In local dev each app runs on its own port, so the auth cookie must be set on the proposals
origin via `/api/trainer/*` — logging in only on trainer (3010) does **not** carry over to 3007.
In production, set `TRAINER_COOKIE_DOMAIN` on trainer/server so subdomains share the cookie.

## Environment variables

### server (`proposals/server/.env`)

| Var | Req | Notes |
|---|---|---|
| `MONGODB_URI` | REQ | Same value as trainer/server |
| `MONGODB_DB_NAME` | OPT | default `trainer` |
| `TRAINER_JWT_SECRET` | REQ | Must match trainer/server |
| `TRAINER_AUTH_COOKIE_NAME` | OPT | default `trainer_auth` |
| `PROPOSALS_STORAGE_ROOT` | OPT | default `./storage`; `/data/storage` in Docker |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` / `AWS_S3_BUCKET` / `AWS_S3_PUBLIC_BASE_URL` | OPT | enable S3 storage |
| `PROPOSALS_INTERNAL_BASE` | OPT | default `http://127.0.0.1:8030` (used by Playwright) |
| `PROPOSALS_PUBLIC_BASE` | OPT | public URL used in share links |
| `PROPOSALS_CORS_ORIGINS` | OPT | default localhost:3007 |

### web

| Var | Req | Notes |
|---|---|---|
| `PROPOSALS_API_BASE` | REQ in prod | e.g. `http://proposals-server:8030` |
| `TRAINER_API_BASE` | OPT | default `http://localhost:8010` (dev) / `https://trainer.{DOMAIN}/api` (prod) |
| `NEXT_PUBLIC_TRAINER_URL` | OPT | login redirect target |
| `NEXT_PUBLIC_APP_BASE_DOMAIN` | OPT | default `lorenzohome.ae` |

## Production (Dokploy)

Two apps, same pattern as the other services:

| App | Folder | Host | Container port |
|---|---|---|---|
| Proposals Web | `proposals/web/` | `proposals.{DOMAIN}` | 3007 |
| Proposals Server | `proposals/server/` | (internal, or `proposals.{DOMAIN}` → path `/api/proposals/*`) | 8030 |

- The web app proxies `/api/proposals/*` and `/api/trainer/*` server-side, so exposing the
  API publicly is optional. If public **share links** should work without the web app,
  route `proposals.{DOMAIN}/api/proposals/*` to the server via Traefik.
- Mount a persistent volume at `/data` on the server app (or configure S3). Generated PDFs
  must never live only on the ephemeral container disk.
- The server image is based on `mcr.microsoft.com/playwright/python` (~1.5 GB) — expected,
  it bundles Chromium for the PDF export.

## API overview

All routes under `/api/proposals` (cookie-authenticated unless noted):

- `GET /catalog` — search/filter the shared product catalog
- `GET|POST /` · `GET|PATCH|DELETE /{id}` — proposal CRUD (`?all=1` for admins)
- `POST /{id}/duplicate` · `PATCH /{id}/status` — reuse + draft/sent/approved/rejected/archived
- `POST /{id}/generate` — rebuild pages from template + items
- `GET /{id}/render[?page=N]` — exact-layout HTML (used by the editor preview)
- `POST /{id}/export` · `GET /{id}/pdf` — Playwright PDF export + download
- `POST /{id}/share` · `GET /share/{token}[/pdf]` — public customer links (no login)
- `GET|POST /templates` · `GET|PATCH|DELETE /templates/{id}` · `POST /templates/{id}/duplicate`
- `GET /user-profiles` · `PUT /user-profiles/{user_id}` — salesperson contact blocks (admin)
- `POST /assets/upload` · `GET /assets` · `DELETE /assets/{id}` — image/logo/pattern library
- `GET /activity` — admin audit log
- `GET /health` — service status
