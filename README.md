# Lorenzo Scanner Monorepo

سیستم تشخیص لوستر مبتنی بر YOLOv8 به‌همراه داشبورد آموزش (Label/Train/Publish).

این ریپو یک monorepo چندسرویسی است:

- `frontend/` : رابط کاربری اسکنر (Next.js)
- `backend/` : API تشخیص (FastAPI + YOLOv8)
- `trainer/server/` : API آموزش + مدیریت دیتاست (FastAPI)
- `trainer/web/` : داشبورد آموزش (Next.js)
---

# فهرست

- [ویژگی‌ها](#ویژگیها)
- [مسیرها در Production](#مسیرها-در-production)
- [سرویس‌ها و پورت‌ها (لوکال)](#سرویسها-و-پورتها-لوکال)
- [محل مدل YOLO](#محل-مدل-yolo)
- [اجرای لوکال (بدون Docker)](#اجرای-لوکال-بدون-docker)
- [اجرای Docker](#اجرای-docker)
- [تنظیمات Production (Dokploy)](#تنظیمات-production-dokploy)
- [راهنمای کاربر (فارسی)](#راهنمای-کاربر-فارسی)
- [خروجی‌ها و مسیر فایل‌ها](#خروجیها-و-مسیر-فایلها)
- [لینک‌های مفید](#لینکهای-مفید)

---

# تکنولوژی‌ها (Tech Stack)

## فرانت‌اند (Scanner UI)

- Next.js (App Router)
- React
- TailwindCSS

## بک‌اند (Inference)

نکته‌ی مهم برای Production (Dokploy / Nixpacks):

اگر مدل را به‌صورت فایل داخل ریپو و داخل سرویس `backend/` نگه می‌دارید، باید در Environment سرویس بک‌اند مقدار زیر را ست کنید تا بک‌اند مدل را پیدا کند:

`MODEL_PATH=/app/models/best.pt`

- FastAPI + Uvicorn
- Ultralytics YOLOv8
- Pillow (decode کردن تصویر)

## Trainer

- FastAPI (ذخیره‌سازی دیتاست + orchestration آموزش)
- Next.js dashboard (لیبل‌گذاری + UI آموزش)

---

# ویژگی‌ها

- **اسکن زنده (موبایل‌فرست)** با دوربین و نمایش باکس‌ها روی تصویر
- **مسیر‌دهی Same-origin** (سازگار با reverse proxy) برای Deploy تمیز
- **داشبورد آموزش**:
  - ساخت کلاس‌ها
  - آپلود تصاویر
  - لیبل (کشیدن یک باکس)
  - خروجی گرفتن دیتاست YOLO
  - آموزش
  - Publish مدل (`best.pt`) برای inference

---

# مسیرها در Production

| Path | Service |
|------|---------|
| `/` | frontend (Scanner UI) |
| `/api/*` | backend (YOLO detect API) |
| `/trainer/*` | trainer/web (Dashboard) |
| `/trainer/api/*` | trainer/server (Training API) |

فرانت‌اند همیشه درخواست تشخیص را با این مسیر می‌زند:

```
fetch('/api/detect')
```

مسیر‌دهی در حالت Docker توسط Nginx و در Production توسط reverse proxy انجام می‌شود.

---

# سرویس‌ها و پورت‌ها (لوکال)

| Service | Folder | Default Port |
|---|---|---:|
| Scanner UI | `frontend/` | 3003 |
| Inference API | `backend/` | 8000 |
| Trainer Server API | `trainer/server/` | 8010 |
| Trainer Web (Dashboard) | `trainer/web/` | 3010 |

---

# محل مدل YOLO

فایل مدل باید در این مسیر وجود داشته باشد:

```
backend/models/best.pt
```

بک‌اند مدل را از این مسیر می‌خواند:

```
MODEL_PATH=/models/best.pt (Docker)
MODEL_PATH=./models/best.pt (Local)
```

اگر فایل وجود نداشته باشد، بک‌اند این خطا را برمی‌گرداند:

```json
{ "error": "MODEL_NOT_FOUND" }
```

---

# اجرای لوکال (بدون Docker)

برای اجرای کامل، به **۴ ترمینال** نیاز داری.

## پیش‌نیازها

- Node.js (پیشنهادی: 20+)
- Python 3.10+
- (اختیاری) Docker + Docker Compose

---

## Terminal 1 — Trainer Server (API + storage)

```bash
cd trainer/server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8010 --reload
```

تست:

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

باز کردن:

```
http://localhost:3010
```

اگر داشبورد وضعیت API را `Offline` نشان داد:

```bash
echo "NEXT_PUBLIC_TRAINER_API_BASE=http://localhost:8010" > .env.local
```

سرویس را ریستارت کن.

---

## Terminal 3 — Backend (YOLO Inference)

```bash
cd backend
python3 -m venv .venv
source venv/bin/activate
pip install -r requirements.txt
MODEL_PATH=./models/best.pt uvicorn app:app --host 127.0.0.1 --port 8000 --reload
```

تست:

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

باز کردن:

```
http://localhost:3003/scanner
```

---

## Terminal 5 — products
```bash
cd products
npm install
npm run dev -- -p 3004
```

باز کردن:

```
http://localhost:3004
```
---*

# راهنمای کاربر (فارسی)

## 1) استفاده از اسکنر (Scanner)

1. آدرس را باز کن:
   - `http://localhost:3003/scanner`
2. دسترسی دوربین را `Allow` کن.
3. دوربین را روی لوستر بگیر.
4. نتیجه‌ی تشخیص به‌صورت زنده روی تصویر نمایش داده می‌شود:
   - کلاس (نام محصول)
   - confidence
   - bounding box

نکته: فرانت‌اند درخواست‌ها را به این مسیر می‌فرستد:

```
POST /api/detect
```

## 2) آموزش مدل (Training) — قدم به قدم

1. داشبورد آموزش را باز کن:
   - `http://localhost:3010`
2. در صفحه **Classes** کلاس‌ها را بساز.
   - قوانین نام‌گذاری:
     - حروف کوچک
     - بدون فاصله
     - در صورت نیاز `_`
3. در صفحه **Upload** تصاویر محصولات را آپلود کن.
4. در صفحه **Queue** برای هر تصویر:
   - دقیقاً یک باکس دور لوستر بکش
   - کلاس را انتخاب کن
   - `Save`
5. در صفحه **Train**:
   - اول `Export Dataset (YOLO)` را بزن
   - بعد `Start Training` را بزن
6. وقتی وضعیت `finished` شد:
   - `Publish` را بزن
7. بعد از Publish، سرویس inference را ریستارت کن تا مدل جدید لود شود.

---

# خروجی‌ها و مسیر فایل‌ها

- **خروجی تشخیص (Inference)**: پاسخ JSON شامل `detections` (bbox + class + confidence + product)
- **خروجی آموزش (Trainer)**:
  - خروجی دیتاست (Export) در:
    - `trainer/server/storage/datasets/...`
  - خروجی Train/Log در:
    - `trainer/server/storage/runs/...`
  - مدل نهایی Publish شده در:
    - `backend/models/best.pt`

## بعد از Publish دقیقاً چه اتفاقی می‌افتد؟

1. فایل `best.pt` در مسیر زیر ساخته/جایگزین می‌شود:

```
backend/models/best.pt
```

2. برای اینکه API تشخیص از مدل جدید استفاده کند باید `backend` را ریستارت کنی.

---

# اجرای Docker

```bash
docker compose up --build
```

باز کردن:

```
http://localhost/
```

---

# تنظیمات Production (Dokploy)

دامنه:

```
https://scanner.ehsanrahimi.com
```

مسیر‌دهی پیشنهادی:

| Path             | Target              |
| ---------------- | ------------------- |
| `/`              | frontend:3003       |
| `/api/*`         | backend:8000        |
| `/trainer/*`     | trainer/web:3010    |
| `/trainer/api/*` | trainer/server:8010 |

متغیرهای محیطی:

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

# لینک‌های مفید

- Scanner UI: `/scanner`
- Service status: `/status`
- Backend docs: `/api/docs`
- Trainer docs: `/trainer/api/docs`

---

# License

Private internal project.

