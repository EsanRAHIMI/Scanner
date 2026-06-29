# Lorenzo Scanner Monorepo

YOLOv8-based lobster detection system with a training dashboard (Label / Train / Publish).

This repository is a multi-service monorepo:

- `frontend/` — Scanner user interface (Next.js)
- `backend/` — Detection API (FastAPI + YOLOv8)
- `trainer/server/` — Training API and dataset management (FastAPI)
- `trainer/web/` — Training dashboard (Next.js)
- `image/server/` — Image import, processing, and outputs API (FastAPI)
- `image/web/` — Image admin UI (Next.js)
- `proposals/server/` — Proposal builder API: templates, generation, PDF export (FastAPI + Playwright)
- `proposals/web/` — Proposal builder UI for the sales team (Next.js) — see `proposals/README.md`

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
- [Local Dev — One Command (`./dev`)](#local-dev--one-command-dev)

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
| Proposals API | `proposals/server/` | 8030 |
| Proposals Web | `proposals/web/` | 3007 |

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

## Prerequisites

- Node.js 20+
- Python 3.11

---

## Terminal 1 — Trainer Server (API + Storage)

```bash
cd trainer/server
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8010 --reload
```

---

## Terminal 2 — Trainer Web (Dashboard)

```bash
cd trainer/web
npm install
npm run dev
```

---

## Terminal 3 — Backend (YOLO Inference)

```bash
cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
MODEL_PATH=./models/best.pt uvicorn app:app --host 127.0.0.1 --port 8000 --reload
```

---

## Terminal 4 — Frontend (Scanner UI)

```bash
cd frontend
npm install
npm run dev
```

---

## Terminal 5 — Products

```bash
cd products
npm install
npm run dev
```

---

## Terminal 6 — Marketing

```bash
cd marketing
npm install
npm run dev
```

---

## Terminal 7 — Image Server (API)

```bash
cd image/server
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8020 --reload
```

---

## Terminal 8 — Image Web (Admin UI)

```bash
cd image/web
npm install
npm run dev
```

---

## Terminal 9 — Proposals Server (API)

```bash
cd proposals/server
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m playwright install chromium
cp .env.example .env
uvicorn app:app --host 127.0.0.1 --port 8030 --reload
```

---

## Terminal 10 — Proposals Web

```bash
cd proposals/web
npm install
npm run dev
```

---

## Terminal 11 — Agent server

```bash
cd agent/server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app:app --port 8040

## Local URLs

| Service | URL |
|---|---|
| Scanner UI | http://localhost:3003/scanner |
| Inference API | http://127.0.0.1:8000 |
| Trainer Web | http://localhost:3010 |
| Trainer API | http://127.0.0.1:8010 |
| Products | http://localhost:3004 |
| Marketing | http://localhost:3005 |
| Image Web | http://localhost:3006 |
| Image API | http://127.0.0.1:8020 |
| Proposals Web | http://localhost:3007 |
| Proposals API | http://127.0.0.1:8030 |
| Agent Server |  http://localhost:8040 |

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

# Local Dev — One Command (`./dev`)

Run **all 11 local services** from the repo root in **one terminal** — with labeled, color-coded logs.

**Prerequisites:** Node.js 20+, Python 3.11 (same as [Local Execution](#local-execution-without-docker)).

## First time

```bash
./dev setup
```

Creates Python venvs, installs `pip` / `npm` dependencies, Playwright Chromium (proposals PDF), and copies `.env` from `.env.example` where missing (`proposals/server`, `agent/server`, `image/server`). Edit those `.env` files if you need MongoDB, S3, or API keys.

## Start (logs in this terminal)

```bash
./dev
```

Starts every service and streams live logs. **Ctrl+C** stops all of them.

## Stop

```bash
./dev stop
```

Use this from **another terminal** while `./dev` is running, or after a crash left ports busy.

## Other commands

| Command | What it does |
|---|---|
| `./dev status` | Running/stopped per port + local URLs |
| `./dev restart` | Stop all, then start all |
| `./dev up backend frontend` | Start only the services you name |
| `./dev help` | Short usage summary |

## Services included

| Name | Port | Folder |
|---|---:|---|
| backend | 8000 | `backend/` |
| frontend | 3003 | `frontend/` |
| trainer-server | 8010 | `trainer/server/` |
| trainer-web | 3010 | `trainer/web/` |
| products | 3004 | `products/` |
| marketing | 3005 | `marketing/` |
| image-server | 8020 | `image/server/` |
| image-web | 3006 | `image/web/` |
| proposals-server | 8030 | `proposals/server/` |
| proposals-web | 3007 | `proposals/web/` |
| agent-server | 8040 | `agent/server/` |

**Quick URLs after start:** Scanner `http://localhost:3003/scanner` · Trainer `http://localhost:3010` · Products `http://localhost:3004` · Image `http://localhost:3006` · Proposals `http://localhost:3007`

The per-terminal steps in [Local Execution (Without Docker)](#local-execution-without-docker) are still valid if you prefer to run services separately.

---

# License

Private internal project.
