# Lorenzo Scanner Monorepo

YOLOv8-based chandelier detection system with integrated training dashboard.

This repository is a multi-service monorepo including:

- `frontend/` → Scanner UI (Next.js)
- `backend/` → YOLOv8 inference API (FastAPI)
- `trainer/server/` → Training API + dataset storage (FastAPI)
- `trainer/web/` → Training dashboard (Next.js)
- `nginx/` → Reverse proxy (Docker deployment)

---

# Tech Stack

## Frontend (Scanner UI)

- Next.js (App Router)
- React
- TailwindCSS

## Backend (Inference)

- FastAPI + Uvicorn
- Ultralytics YOLOv8
- Pillow (image decoding)

## Trainer

- FastAPI (dataset storage + training orchestration)
- Next.js dashboard (labeling + training UI)

---

# Key Features

- **Real-time scanning UI** (mobile-first) with camera capture and overlay boxes.
- **Same-origin API** routing (works behind reverse proxy) for clean deployments.
- **Training dashboard**:
  - Create classes
  - Upload images
  - Label (draw one bounding box)
  - Export YOLO dataset
  - Train
  - Publish model (`best.pt`) for inference

---

# Architecture Overview

## Public Routes (Production / Docker)

| Path | Service |
|------|---------|
| `/` | frontend (Scanner UI) |
| `/api/*` | backend (YOLO detect API) |
| `/trainer/*` | trainer/web (Dashboard) |
| `/trainer/api/*` | trainer/server (Training API) |

Frontend always calls detection using:

```

fetch('/api/detect')

```

Routing is handled by Nginx (Docker) or your reverse proxy.

---

# Services & Ports (Local)

| Service | Folder | Default Port |
|---|---|---:|
| Scanner UI | `frontend/` | 3003 |
| Inference API | `backend/` | 8000 |
| Trainer Server API | `trainer/server/` | 8010 |
| Trainer Web (Dashboard) | `trainer/web/` | 3010 |

---

# YOLO Model Location

Model file must exist at:

```
backend/models/best.pt
```

Backend loads model from:

```
MODEL_PATH=/models/best.pt (Docker)
MODEL_PATH=./models/best.pt (Local)
```

If missing, backend returns:

```json
{ "error": "MODEL_NOT_FOUND" }
```

---

# Local Development (Without Docker)

You need **4 terminals**.

## Prerequisites

- Node.js (recommended: 20+)
- Python 3.10+
- (Optional) Docker + Docker Compose

---

## Terminal 1 — Trainer Server (API + storage)

```bash
cd trainer/server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8010 --reload
```

Test:

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

If API error occurs:

```bash
echo "NEXT_PUBLIC_TRAINER_API_BASE=http://localhost:8010" > .env.local
```

Restart dev server.

---

## Terminal 3 — Backend (YOLO Inference)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
MODEL_PATH=./models/best.pt uvicorn app:app --host 127.0.0.1 --port 8000 --reload
```

Test:

```bash
curl http://127.0.0.1:8000/health
```

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

# Quick User Guide (Simple)

## Scanner (تشخیص)

1. برو به:

   - `http://localhost:3003/scanner`

2. دسترسی دوربین رو Allow کن.
3. دوربین رو به لوستر بگیر.
4. نتیجه‌ی تشخیص (کلاس/کانفیدنس/باکس) روی تصویر نمایش داده می‌شه.

## Training (آموزش مدل)

1. برو به داشبورد:

   - `http://localhost:3010`

2. **Classes**: چند کلاس بساز (مثلاً `spark`, `adyl_central`).
3. **Upload**: چند عکس آپلود کن.
4. **Queue**: هر عکس رو باز کن:

   - یک باکس دور لوستر بکش
   - کلاس رو انتخاب کن
   - Save

5. **Train**:

   - Export Dataset (YOLO)
   - Start Training

6. بعد از `finished` شدن:

   - Publish

خروجی مدل اینجا ذخیره می‌شه:

- `backend/models/best.pt`

و بعد از Publish باید سرویس inference رو ریستارت کنی.

---

# Outputs

- **Inference output**: JSON شامل `detections` (bbox + class + confidence + product)
- **Trainer output**:
  - Dataset export under: `trainer/server/storage/datasets/...`
  - Training runs/logs under: `trainer/server/storage/runs/...`
  - Published model: `backend/models/best.pt`

---

# Docker Run (All Services)

```bash
docker compose up --build
```

Open:

```
http://localhost/
```

---

# Production Routing Example (Dokploy)

Domain:

```
https://scanner.ehsanrahimi.com
```

Suggested routing:

| Path             | Target              |
| ---------------- | ------------------- |
| `/`              | frontend:3003       |
| `/api/*`         | backend:8000        |
| `/trainer/*`     | trainer/web:3010    |
| `/trainer/api/*` | trainer/server:8010 |

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

# Useful Links

- Scanner UI: `/scanner`
- Service status: `/status`
- Backend docs: `/api/docs`
- Trainer docs: `/trainer/api/docs`

---

# License

Private internal project.

