# Lorenzo Scanner Monorepo

YOLOv8-based lobster detection system with a training dashboard (Label / Train / Publish).

This repository is a multi-service monorepo:

- `frontend/` — Scanner user interface (Next.js)
- `backend/` — Detection API (FastAPI + YOLOv8)
- `trainer/server/` — Training API and dataset management (FastAPI)
- `trainer/web/` — Training dashboard (Next.js)
- `image/server/` — Image import, processing, and outputs API (FastAPI)
- `image/web/` — Image admin UI (Next.js)

---

# Table of Contents

- [Features](#features)
- [Production Routes](#production-routes)
- [Services and Ports (Local)](#services-and-ports-local)
- [YOLO Model Location](#yolo-model-location)
- [Local Execution (Without Docker)](#local-execution-without-docker)
- [Docker Execution](#docker-execution)
- [Production Configuration (Dokploy)](#production-configuration-dokploy)
- [User Guide](#user-guide)
- [Outputs and File Paths](#outputs-and-file-paths)
- [Useful Links](#useful-links)

---

# Tech Stack

## Frontend (Scanner UI)

- Next.js (App Router)
- React
- TailwindCSS

## Backend (Inference)

**Important for Production (Dokploy / Nixpacks):**

If you keep the model as a file inside the repository under the `backend/` service, set the following environment variable on the backend service so the API can locate the model:

`MODEL_PATH=/app/models/best.pt`

- FastAPI + Uvicorn
- Ultralytics YOLOv8
- Pillow (image decoding)

## Trainer

- FastAPI (dataset persistence + training orchestration)
- Next.js dashboard (labeling + training UI)

---

# Features

- **Live scanning (mobile-first)** with camera feed and bounding boxes overlaid on the image
- **Same-origin routing** (reverse-proxy compatible) for clean deployments
- **Training dashboard**:
  - Create classes
  - Upload images
  - Label (draw a single bounding box)
  - Export YOLO dataset
  - Train
  - Publish model (`best.pt`) for inference

---

# Production Routes

| Path | Service |
|------|---------|
| `/` | frontend (Scanner UI) |
| `/api/*` | backend (YOLO detect API) |
| `/trainer/*` | trainer/web (Dashboard) |
| `/trainer/api/*` | trainer/server (Training API) |

The frontend always sends detection requests to:

```
fetch('/api/detect')
```

Routing is handled by Nginx in Docker and by the reverse proxy in production.

---

# Services and Ports (Local)

| Service | Folder | Default Port |
|---|---|---:|
| Scanner UI | `frontend/` | 3003 |
| Inference API | `backend/` | 8000 |
| Trainer Server API | `trainer/server/` | 8010 |
| Trainer Web (Dashboard) | `trainer/web/` | 3010 |
| Image API | `image/server/` | 8020 |
| Image Admin UI | `image/web/` | 3006 |

---

# YOLO Model Location

The model file must exist at:

```
backend/models/best.pt
```

The backend reads the model from:

```
MODEL_PATH=/models/best.pt (Docker)
MODEL_PATH=./models/best.pt (Local)
```

If the file is missing, the backend returns:

```json
{ "error": "MODEL_NOT_FOUND" }
```

---

# Local Execution (Without Docker)

A full local setup requires **four terminals** (plus optional terminals for Products and Marketing).

## Prerequisites

- Node.js (recommended: 20+)
- Python 3.10+
- (Optional) Docker + Docker Compose

---

## Terminal 1 — Trainer Server (API + Storage)

```bash
cd trainer/server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8010 --reload
```

Health check:

```bash
curl http://127.0.0.1:8010/health
```

---

## Terminal 2 — Trainer Web (Dashboard)

```bash
cd trainer/web
npm install
npm run dev -- -p 3010
```

Open:

```
http://localhost:3010
```

If the dashboard shows the API as `Offline`:

```bash
echo "NEXT_PUBLIC_TRAINER_API_BASE=http://localhost:8010" > .env.local
```

Restart the service.

----

## Terminal 3 — Backend (YOLO Inference)

```bash
cd backend
python3 -m venv .venv
source venv/bin/activate
pip install -r requirements.txt
MODEL_PATH=./models/best.pt uvicorn app:app --host 127.0.0.1 --port 8000 --reload
```

Health check:

```bash
curl http://127.0.0.1:8000/health
```

> 🟥 **Trainer Server Deployment Note (CPU-only now):**  
> `trainer/server/requirements.txt` is currently optimized for **non-GPU hosts** (CPU-only PyTorch).  
> If/when you move Trainer Server to a GPU machine, install with:
>
> ```bash
> cd trainer/server
> pip install -r requirements.gpu.txt
> ```
>
> This switches Trainer to CUDA-enabled PyTorch for better YOLO performance.

---

## Terminal 4 — Frontend (Scanner UI)

```bash
cd frontend
npm install
npm run dev -- -p 3003
```

Open:

```
http://localhost:3003/scanner
```

---

## Terminal 5 — Products

```bash
cd products
npm install
npm run dev -- -p 3004
```

---

## Terminal 6 — Marketing

```bash
cd marketing
npm install
npm run dev -- -p 3005
```

Open:

```
http://localhost:3005
```

---

## Terminal 7 — Image

```bash
cd image/server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8020 --reload
```

In a second terminal:

```bash
cd image/web
npm install
npm run dev
```

Open:

```
http://localhost:3006
```

See `image/README.md` for API details and S3/Google Drive configuration.

---

# User Guide

## 1) Using the Scanner

1. Open:
   - `http://localhost:3003/scanner`
2. Grant camera access (`Allow`).
3. Point the camera at the lobster.
4. Detection results are shown live on the image:
   - Class (product name)
   - Confidence score
   - Bounding box

**Note:** The frontend sends requests to:

```
POST /api/detect
```

## 2) Model Training — Step by Step

1. Open the training dashboard:
   - `http://localhost:3010`
2. On the **Classes** page, create your classes.
   - Naming rules:
     - Lowercase letters only
     - No spaces
     - Use `_` when needed
3. On the **Upload** page, upload product images.
4. On the **Queue** page, for each image:
   - Draw exactly one bounding box around the lobster
   - Select the class
   - Click `Save`
5. On the **Train** page:
   - First click `Export Dataset (YOLO)`
   - Then click `Start Training`
6. When the status is `finished`:
   - Click `Publish`
7. After publishing, restart the inference service so the new model is loaded.

---

# Outputs and File Paths

- **Inference output**: JSON response containing `detections` (bbox, class, confidence, product)
- **Trainer output**:
  - Exported dataset:
    - `trainer/server/storage/datasets/...`
  - Training runs and logs:
    - `trainer/server/storage/runs/...`
  - Published model:
    - `backend/models/best.pt`

## What Happens After Publish?

1. The `best.pt` file is created or replaced at:

```
backend/models/best.pt
```

2. Restart `backend` so the detection API loads the new model.

---

# Docker Execution

```bash
docker compose up --build
```

Open:

```
http://localhost/
```

---

# Production Configuration (Dokploy)

Domain:

```
https://scanner.ehsanrahimi.com
```

Recommended routing:

| Path             | Target              |
| ---------------- | ------------------- |
| `/`              | frontend:3003       |
| `/api/*`         | backend:8000        |
| `/trainer/*`     | trainer/web:3010    |
| `/trainer/api/*` | trainer/server:8010 |

## Git Source and Build Root (Dokploy)

In Dokploy, each application is connected to GitHub so that the **application subdirectory** (e.g. `trainer/web`) is the build root and container content directly. **No path changes inside this repository are required for deployment.**

### trainer/web and Nixpacks

Nixpacks defaults to **`npm ci`** when `package-lock.json` is detected during **plan generation**. On some build servers, the lockfile is not present under `/app` at the **`COPY`** stage, causing `npm ci` to fail even though the file exists in Git.

To avoid this failure, `trainer/web/nixpacks.toml` overrides only the install phase with **`npm install --no-audit --no-fund`** (without changing the Node version or using `onlyIncludeFiles`). When the lockfile is in the build context, npm still respects it.

To build with **`npm ci`**, set **Build Type** to **Dockerfile** in Dokploy and use the `Dockerfile` in that directory.

- **Port**: `3010`

Environment variables:

### frontend

```
BACKEND_DETECT_URL=https://scanner.ehsanrahimi.com/api/detect
```

### trainer/web

```
NEXT_PUBLIC_TRAINER_API_BASE=/trainer/api
# or
# NEXT_PUBLIC_TRAINER_API_BASE=https://scanner.ehsanrahimi.com/trainer/api
```

---

## Code Invariants (Do Not Break)

- Products preview open flow is **recordId-first** (URL is fallback only) to prevent wrong-item jumps in Feed.
- Products assets API uses **cursor pagination** (`limit`, `cursor`, `has_more`, `next_cursor`) — do not reintroduce fixed hard limits.
- Trainer assets pagination order is **stable**: `created_at desc` + `_id desc`; cursor logic must use the same tuple.
- Products cache provider may aggregate paged responses into one snapshot; keep response schema backward-compatible.
- Trainer Server deploy target is `trainer/server` with a local `.dockerignore`; avoid building from repo root.
- `trainer/server/requirements.txt` is **CPU-only by default**; use `requirements.gpu.txt` only on GPU hosts.

---

# Useful Links

- Scanner UI: `/scanner`
- Service status: `/status`
- Backend docs: `/api/docs`
- Trainer docs: `/trainer/api/docs`

---

# License

Private internal project.
