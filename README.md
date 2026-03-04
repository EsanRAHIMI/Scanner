```markdown
# Lorenzo Scanner Monorepo

YOLOv8-based chandelier detection system with integrated training dashboard.

This repository is a multi-service monorepo including:

- `frontend/` → Scanner UI (Next.js)
- `backend/` → YOLOv8 inference API (FastAPI)
- `trainer/server/` → Training API + dataset storage (FastAPI)
- `trainer/web/` → Training dashboard (Next.js)
- `nginx/` → Reverse proxy (Docker deployment)

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

# YOLO Model Location

Model file must exist at:

```

backend/models/best.pt

```

Backend loads model from:

```

MODEL_PATH=/models/best.pt (Docker)
MODEL_PATH=./models/best.pt (Local)

````

If missing, backend returns:

```json
{ "error": "MODEL_NOT_FOUND" }
````

---

# Local Development (Without Docker)

You need **4 terminals**.

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
NEXT_PUBLIC_TRAINER_API_BASE=https://scanner.ehsanrahimi.com/trainer/api
```

---

# How Training Works

The system includes a built-in YOLO training pipeline.

## Step 1 — Create Classes

Go to:

```
http://localhost:3010
```

Open **Classes** and create object names (e.g. `spark`, `adyl_central`).

Rules:

* lowercase
* no spaces
* use underscore if needed

---

## Step 2 — Upload Images

Open **Upload** and add product images.

Images move to **Queue**.

---

## Step 3 — Label Images

Open **Queue**:

For each image:

* Draw **one bounding box**
* Select class
* Save

Label at least 10–20 images per class (minimum for testing).

---

## Step 4 — Export Dataset

Open **Train** → Click:

```
Export Dataset (YOLO)
```

System generates:

* images/
* labels/
* data.yaml

---

## Step 5 — Train

In **Train** page:

Recommended test config:

```
epochs: 10
batch: 4
img size: 640
```

Click:

```
Start Training
```

Wait until status becomes:

```
finished
```

---

## Step 6 — Publish Model

Click:

```
Publish
```

This writes:

```
backend/models/best.pt
```

---

## Step 7 — Restart Backend

Stop and restart backend:

```bash
Ctrl + C
uvicorn app:app --host 127.0.0.1 --port 8000 --reload
```

---

# How to Use the Scanner

1. Open:

   ```
   http://localhost:3003/scanner
   ```
2. Allow camera access
3. Point camera at chandelier
4. Detection results appear in real time
5. If confidence threshold met → product recognized

The frontend sends frames to:

```
POST /api/detect
```

Backend loads `best.pt` and returns bounding boxes + class predictions.

---

# Development Flow Summary

```
Upload → Label → Export → Train → Publish → Restart → Scan
```

---

# Notes

* Training runs locally on your machine.
* No cloud dependency required.
* Docker provides clean production routing.
* Model must exist before inference works.

---

# License

Private internal project.

