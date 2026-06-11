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

## Data architecture

| Layer | Stores |
|-------|--------|
| **S3** | Image bytes (`uploads/`, `processed/`, `final/`, `backgrounds/`, `watermarks/`) |
| **MongoDB Atlas** | All metadata — batches, items, outputs, settings, background registry |

Database name: `IMAGE_MONGODB_DB` (default `lorenzo_image`).

Collections:

| Collection | Contents |
|------------|----------|
| `image_batches` | Batch id, source, status, total_count, timestamps |
| `image_items` | Per-image keys, URLs, status, errors (`transparent_key` / `transparent_url` in DB; API returns `processed_key` / `processed_url`) |
| `image_outputs` | Published outputs for Products and other services |
| `image_settings` | Singleton system settings |
| `image_backgrounds` | Background template metadata + `storage_key` pointing at S3 |

Indexed fields: `file_name`, `batch_id`, `item_id`, `status`, `final_key`.

Local JSON under `image/server/storage/` is **deprecated** — use migration scripts below.

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

**Image API** — set `MONGODB_URI`, `IMAGE_MONGODB_DB`, S3 vars from `image/server/.env.example`. Dokploy injects `PORT`; the `Procfile` and `nixpacks.toml` use it automatically.

**Image Admin UI** — typical Lorenzo host layout on one domain:

| URL | Service |
|-----|---------|
| `https://image.lorenzohome.ae` | Next.js Web UI |
| `https://image.lorenzohome.ae/api` | FastAPI (`/api/v1/…`) |

Nginx sends `/api/*` to FastAPI and everything else to Next.js. The UI calls Image API at `/api/v1/…` on the same host. Next.js-only routes live under `/web-api/*` (trainer auth, service URLs).

```
IMAGE_API_BASE=https://image.lorenzohome.ae
NEXT_PUBLIC_TRAINER_API_BASE=https://trainer.lorenzohome.ae/api
```

Do **not** set `NEXT_PUBLIC_IMAGE_API_BASE` to `…/api` (causes `/api/api/v1/…` 404s). Rebuild and redeploy the web app after env changes.

## Environment

### `image/server/.env`

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | **Required.** MongoDB Atlas connection string |
| `IMAGE_MONGODB_DB` | Database name (default: `lorenzo_image`) |
| `AWS_ACCESS_KEY_ID` | S3 credentials (recommended in production) |
| `AWS_SECRET_ACCESS_KEY` | S3 credentials |
| `AWS_S3_BUCKET` | Target bucket |
| `AWS_S3_PUBLIC_BASE_URL` | Public CDN/base URL for final links |
| `AWS_S3_UPLOAD_PREFIX` | Default: `uploads` |
| `AWS_S3_BACKGROUNDS_PREFIX` | Default: `backgrounds` |
| `GOOGLE_DRIVE_CREDENTIALS_JSON` | Service account JSON path for Drive import |
| `IMAGE_REMBG_MODEL` | AI cutout model (default: `bria-rmbg`; fallbacks: `birefnet-general`, `isnet-general-use`) |
| `IMAGE_REMBG_ALPHA_MATTING` | Edge refinement for thin wires/crystals (default: `true`) |
| `IMAGE_REMBG_MIN_DIMENSION` | Upscale small photos before cutout to preserve fine detail (default: `1600`) |

When S3 is not configured, image bytes are cached under `image/server/storage/files/` (metadata still in MongoDB).

**Background removal quality:** the API uses `bria-rmbg` + alpha matting + halo cleanup (not the old default `u2net`). Reprocess existing batches to regenerate cutouts. First run downloads the model (~175MB).

### Migration helpers

Import legacy JSON metadata (one-time, from an old deploy or local machine):

```bash
cd image/server
source .venv/bin/activate
python scripts/migrate_json_to_mongo.py --storage-root ./storage
```

Upload local `assets/` backgrounds to S3 (one-time after upgrading Settings storage):

```bash
python scripts/migrate_backgrounds_to_s3.py
```

Rebuild `image_outputs` from existing S3 `final/` keys (after metadata loss):

```bash
python scripts/rebuild_outputs_from_s3.py
python scripts/rebuild_outputs_from_s3.py --dry-run   # preview only
```

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
backgrounds/{id}-bg.jpg                     # Settings templates (shared across hosts)
watermarks/default.png                      # Product watermark (shared across hosts)
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
- Watermark: enable/disable, logo upload, size, opacity, bottom margin (default: Lorenzo white logo, bottom-center)
- Runtime info: S3, prefixes, output dimensions

## Custom backgrounds

Upload templates from **Settings** (`POST /api/v1/settings/backgrounds`). Files are normalized to output size, stored in S3 under `backgrounds/`, and registered in `image_backgrounds` — the same list appears on every host (local and production).

Bundled defaults in `image/server/assets/` (`{id}-bg.jpg`) are seeded to S3 on first API start. To backfill backgrounds that were only on local disk before this change:

```bash
cd image/server
python scripts/migrate_backgrounds_to_s3.py
python scripts/migrate_backgrounds_to_s3.py --force   # re-upload all assets/
```

Default template: `lorenzo-default` (auto-generated if missing).
