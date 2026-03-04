# Lorenzo Scanner Monorepo

This repository is a multi-service, Docker-friendly monorepo:

- `frontend/`: Next.js app (App Router)
- `backend/`: FastAPI YOLOv8 detection service
- `nginx/`: Reverse proxy routing

## Routing

- `GET /` -> `frontend` (Next.js on port 3003)
- `POST /api/detect` -> `backend` `POST /detect` (FastAPI on port 8000)

The frontend always calls the detection endpoint using a **relative URL**:

- `fetch('/api/detect', ...)`

Nginx handles forwarding to the backend.

## YOLO model

Place your YOLOv8 model at:

- `backend/models/best.pt`

In Docker, this is mounted read-only into the backend container as:

- `/models/best.pt`

The backend loads the model from:

- `MODEL_PATH=/models/best.pt`

If the model file is missing, the backend returns:

```json
{ "error": "MODEL_NOT_FOUND" }
```

## Local run (Docker)

Build and start everything:

```bash
docker compose up --build
```

Open:

- http://localhost/

## Local run (without Docker)

### Frontend

```bash
cd frontend
npm ci
npm run dev
```

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
MODEL_PATH=./models/best.pt uvicorn app:app --reload --port 8000
```

When running without Docker you’ll need your own reverse proxy (or update the frontend to call the backend directly). In Docker, Nginx provides same-origin routing.
----------------------------------------


ترمینال 1 — Trainer Server (API + storage)
cd ~/Works/scanner/trainer/server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8010 --reload

✅ تست:

curl http://127.0.0.1:8010/health

باید {"status":"ok"} بده.

ترمینال 2 — Trainer Web (Dashboard)
cd ~/Works/scanner/trainer/web
npm install
# اگر پورت 3010 آزاد نیست، عدد رو عوض کن (مثلا 3011)
npm run dev -- -p 3010

✅ باز کن:

http://localhost:3010

و داخل داشبورد باید بتونی:

کلاس بسازی

عکس آپلود کنی

بری صف لیبلینگ

اگر داشبورد خطای API داد، فایل .env.example داخل trainer/web رو ببین و اگر لازم بود .env.local بساز:

echo "NEXT_PUBLIC_TRAINER_API_BASE=http://127.0.0.1:8010" > .env.local

بعد npm run dev رو ریستارت کن.

ترمینال 3 — Backend اصلی (Inference /detect)
cd ~/Works/scanner/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8000 --reload

✅ تست:

curl http://127.0.0.1:8000/health

تا وقتی backend/models/best.pt نداری، /detect ممکنه 500 بده (طبیعی).

ترمینال 4 — Frontend اصلی (Scanner UI)
cd ~/Works/scanner/frontend
npm install
# اگر پورت آزاد نیست، مثلا 3003
npm run dev -- -p 3003

✅ باز کن:

http://localhost:3003/scanner



---------------------------------------------------


حالا “Training” دقیقاً چطور کار می‌کنه؟

داخل Trainer Web (پورت 3010) این ترتیب رو برو:

Classes → چند کلاس بساز (مثلاً spark, adyl_central, …)

Upload → چند عکس آپلود کن

Queue → هر عکس رو باز کن و:

با موس/تاچ یک باکس دور لوستر بکش

کلاس رو انتخاب کن

Save

Export Dataset → دیتاست YOLO ساخته میشه

Train → epochs/batch رو بذار و Start

وقتی Train تموم شد → Publish رو بزن

خروجی میره داخل: backend/models/best.pt

بعد از Publish:

بک‌اند inference رو ریستارت کن (ترمینال 3 یک بار Ctrl+C و دوباره uvicorn)

بعد scanner UI تشخیص میده.