# Lorenzo Image Service

Image management and processing service with API and admin UI.

## Structure

| Path | Role | Default port |
|------|------|-------------:|
| `image/server/` | FastAPI — import, processing, storage, outputs API | 8020 |
| `image/web/` | Next.js — import wizard, review, background, finalize | 3006 |

## Features

- **Import sources**: local disk (single/multi/folder), Amazon S3, Google Drive
- **Original storage**: uploaded to S3 under fixed prefix `uploads/` (or local disk fallback)
- **Auto processing**: resize canvas to **1080 × 1440** (3:4), background removal, centered subject
- **Review step**: preview processed images, rename, reprocess
- **Background step**: default Lorenzo template or per-image override
- **Outputs API**: file name, final URL, source/original refs, status — for Products and other services

## Local run

**Python**: use 3.10–3.13 (3.11 recommended). Avoid 3.14 until all wheels support it.

### Terminal 1 — Image API

```bash
cd image/server
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app:app --host 127.0.0.1 --port 8020 --reload
```

Health:

```bash
curl http://127.0.0.1:8020/health
```

### Terminal 2 — Image Admin UI

```bash
cd image/web
npm install
cp .env.example .env.local
npm run dev
```

Open: `http://localhost:3006`

## Dokploy deployment

Deploy **two separate applications** from this monorepo (Nixpacks). Set the **Root Directory** (build path) for each:

| Dokploy app | Root directory | Start command (auto via `nixpacks.toml`) |
|-------------|----------------|------------------------------------------|
| Image API | `image/server` | `uvicorn app:app --host 0.0.0.0 --port $PORT` |
| Image Admin UI | `image/web` | `npm run start` |

**Image API** — add env vars from `image/server/.env.example` (S3, optional Google Drive). Dokploy injects `PORT`; the `Procfile` and `nixpacks.toml` use it automatically.

**Image Admin UI** — use a **separate subdomain** for the Next.js app (e.g. `image.lorenzohome.ae`). Do not route all `/api/*` on that host to FastAPI, or Next.js routes (`/api/image`, `/api/trainer`, `/api/service-urls`) will 404.

```
# Proxy target (server-side only). Use internal Docker hostname or API origin — without /api suffix.
IMAGE_API_BASE=http://lorenzo-image-api:8020
# or: IMAGE_API_BASE=https://image-api.lorenzohome.ae

NEXT_PUBLIC_TRAINER_API_BASE=https://trainer.lorenzohome.ae/api
```

The browser calls Image API via `/api/image/*` (Next.js proxy). Do **not** set `NEXT_PUBLIC_IMAGE_API_BASE` to `…/api` — that produced `/api/api/v1/…` 404s.

Redeploy the web app after changing env vars (rebuild if you only had `NEXT_PUBLIC_*` before).

## Environment

### `image/server/.env`

| Variable | Description |
|----------|-------------|
| `AWS_ACCESS_KEY_ID` | S3 credentials (optional) |
| `AWS_SECRET_ACCESS_KEY` | S3 credentials (optional) |
| `AWS_S3_BUCKET` | Target bucket |
| `AWS_S3_PUBLIC_BASE_URL` | Public CDN/base URL for final links |
| `AWS_S3_UPLOAD_PREFIX` | Default: `uploads` |
| `GOOGLE_DRIVE_CREDENTIALS_JSON` | Service account JSON path for Drive import |

When S3 is not configured, files are stored under `image/server/storage/files/`.

### `image/web/.env.local`

```
IMAGE_API_BASE=http://localhost:8020
NEXT_PUBLIC_TRAINER_API_BASE=http://localhost:8010
```

## Storage layout (S3)

```
uploads/{batch_id}/{item_id}_{filename}     # originals
processed/{batch_id}/{item_id}.png          # cutout + centered (review)
final/{batch_id}/{name}.jpg                 # background applied
```

## API (v1)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Service health |
| `POST` | `/api/v1/import/local` | Multipart local import |
| `POST` | `/api/v1/import/s3` | Import by S3 keys or prefix |
| `POST` | `/api/v1/import/google-drive` | Import by file/folder IDs |
| `GET` | `/api/v1/batches` | List batches |
| `GET` | `/api/v1/batches/{id}` | Batch + items |
| `POST` | `/api/v1/batches/{id}/process` | Re-run processing |
| `PATCH` | `/api/v1/items/{id}` | Rename display name |
| `POST` | `/api/v1/items/{id}/reprocess` | Reprocess one item |
| `POST` | `/api/v1/batches/{id}/apply-background` | Apply default/per-item backgrounds |
| `POST` | `/api/v1/batches/{id}/finalize` | Publish final outputs |
| `GET` | `/api/v1/outputs` | **Cross-service output list** |
| `GET` | `/api/v1/backgrounds` | Available templates |

### Outputs response (for Products / other services)

```bash
curl "http://localhost:8020/api/v1/outputs?file_name=product-001&limit=50"
```

```json
{
  "items": [
    {
      "id": "…",
      "batch_id": "…",
      "file_name": "product-001",
      "final_url": "https://cdn.example.com/final/…/product-001.jpg",
      "source_ref": "local://photo.jpg",
      "original_ref": "uploads/…/….jpg",
      "source": "local",
      "status": "finalized",
      "updated_at": "2026-06-09T12:00:00Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0,
  "has_more": false
}
```

## Admin UI flow

1. **Import** — choose source and start batch
2. **Settings** — default background, auto-process, subject size, upload templates
3. **Processing** — background removal, 1080×1440 centering, default template applied
4. **Review** — preview with default background, rename, reprocess
5. **Finalize** — save and expose via `/api/v1/outputs` (per-image background changes in Outputs)

### Settings (`/settings`)

- Default background template for new batches
- Auto-process on import toggle
- Subject fill ratio on canvas (50–95%)
- Upload new background templates (auto-resized to output size)
- Runtime info: S3, prefixes, output dimensions

## Custom backgrounds

Place JPEG/PNG files in `image/server/assets/` named `{id}-bg.jpg` (e.g. `studio-white-bg.jpg`).

Default template: `lorenzo-default-bg.jpg` (auto-generated on first start).
