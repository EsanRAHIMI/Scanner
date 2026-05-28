# Environment — Dokploy (Production)

معماری ثابت: چهار ساب‌دامین روی یک `APP_BASE_DOMAIN`.

| اپ Dokploy | پوشه | Host | Container port |
|------------|------|------|------------------|
| Frontend (Hub) | `frontend/` | `dashboard.{DOMAIN}` | 3003 |
| Backend | `backend/` | `dashboard.{DOMAIN}` → path `/api/*` | 8000 |
| Trainer Web | `trainer/web/` | `trainer.{DOMAIN}` | 3010 |
| Trainer Server | `trainer/server/` | `trainer.{DOMAIN}` → path `/api/*` | 8010 |
| Products | `products/` | `products.{DOMAIN}` | 3004 |
| Marketing | `marketing/` | `marketing.{DOMAIN}` | 3005 |

**Traefik:** روی Frontend و Trainer Web، مسیر `/api` را به Backend / Trainer Server پروکسی کنید.

**Build:** بعد از تغییر هر `NEXT_PUBLIC_*` حتماً Redeploy (در build embed می‌شود).

----

## راهنمای برچسب‌ها

| برچسب | معنی |
|--------|------|
| **REQ** | بدون آن سرویس در پروداکشن درست کار نمی‌کند |
| **URL** | آدرس سرویس؛ اگر خالی بماند از `APP_BASE_DOMAIN` ساخته می‌شود |
| **DOM** | فقط هنگام عوض کردن دامنه / مشتری جدید |
| **OPT** | اختیاری؛ پیش‌فرض کد کافی است |
| **LEG** | در runtime استفاده نمی‌شود (اسکریپت قدیمی) — در Dokploy لازم نیست |

`{DOMAIN}` = مقدار `ehsanrahimi.com` یا دامنهٔ مشتری جدید.

---

## ۱) Frontend

```env
# --- Runtime ---
NODE_ENV=production

# --- Domain [DOM] ---
NEXT_PUBLIC_APP_BASE_DOMAIN=ehsanrahimi.com
APP_BASE_DOMAIN=ehsanrahimi.com
NEXT_PUBLIC_HUB_SUBDOMAIN=dashboard

# --- Hub override (URL کامل) ---
# NEXT_PUBLIC_HUB_URL=https://dashboard.ehsanrahimi.com

# --- Server proxy [URL] — اختیاری؛ از دامنه ساخته می‌شود ---
BACKEND_DETECT_URL=https://dashboard.ehsanrahimi.com/api/detect
TRAINER_API_BASE=https://trainer.ehsanrahimi.com/api

# --- Optional ---
# BACKEND_HEALTH_URL=https://dashboard.ehsanrahimi.com/api/health
# BACKEND_DETECT_TIMEOUT_MS=60000
# NEXT_PUBLIC_TRAINER_API_BASE=/api/trainer
# NEXT_PUBLIC_TRAINER_URL=https://trainer.ehsanrahimi.com
# NEXT_PUBLIC_PRODUCTS_URL=https://products.ehsanrahimi.com
# NEXT_PUBLIC_MARKETING_URL=https://marketing.ehsanrahimi.com
```

| متغیر | برچسب | مقدار اگر ست نشود (production) |
|--------|--------|--------------------------------|
| `NEXT_PUBLIC_APP_BASE_DOMAIN` | DOM | `ehsanrahimi.com` |
| `NEXT_PUBLIC_HUB_SUBDOMAIN` | DOM | `dashboard` → `https://dashboard.{DOMAIN}` |
| `BACKEND_DETECT_URL` | URL | `https://{HUB_SUB}.{DOMAIN}/api/detect` |
| `TRAINER_API_BASE` | URL | `https://trainer.{DOMAIN}/api` |

**داشبورد:** لینک‌های Quick Actions از `/api/app-urls` (runtime env) خوانده می‌شوند — بعد از تغییر دامنه فقط Redeploy Frontend کافی است.

**نکته:** مرورگر Scanner از `/api/trainer` (same-origin) استفاده می‌کند؛ `TRAINER_API_BASE` فقط برای پراکسی سرور Next است.

---

## ۲) Backend

```env
# --- Required [REQ] ---
MODEL_PATH=/app/models/best.pt

# --- Optional [OPT] ---
# YOLO_INFERENCE_TIMEOUT_SEC=30
# HEALTH_INFERENCE_PROBE_TIMEOUT_MS=5000
# HEALTH_INFERENCE_PROBE_SKIP=false
```

دامنه لازم نیست؛ فقط پشت `dashboard.{DOMAIN}/api` در Traefik.

---

## ۳) Trainer Web

```env
# --- Runtime ---
NODE_ENV=production

# --- Domain [DOM] ---
NEXT_PUBLIC_APP_BASE_DOMAIN=ehsanrahimi.com

# --- API on same host (relative path) [REQ for trainer host] ---
NEXT_PUBLIC_TRAINER_API_BASE=/api

# --- Cross-link to Scanner [URL] ---
NEXT_PUBLIC_SCANNER_URL=https://dashboard.ehsanrahimi.com/scanner

# --- Optional ---
# NEXT_PUBLIC_LAST_TRAIN_JOB_ID=
# NEXT_PUBLIC_TRAINER_URL=https://trainer.ehsanrahimi.com
```

| متغیر | برچسب | مقدار اگر ست نشود |
|--------|--------|-------------------|
| `NEXT_PUBLIC_TRAINER_API_BASE` | URL | `https://trainer.{DOMAIN}/api` |
| `NEXT_PUBLIC_SCANNER_URL` | URL | `https://dashboard.{DOMAIN}/scanner` |

**توصیه:** روی هاست `trainer` مقدار `/api` را نگه دارید (همان تنظیم فعلی شما).

---

## ۴) Trainer Server

```env
# --- Domain & auth [DOM] [REQ] ---
APP_BASE_DOMAIN=ehsanrahimi.com
HUB_SUBDOMAIN=dashboard
TRAINER_COOKIE_DOMAIN=.ehsanrahimi.com

# --- MongoDB [REQ] ---
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster.mongodb.net/lorenzodb?retryWrites=true&w=majority&appName=Cluster0
MONGODB_DB_NAME=lorenzodb

# --- JWT / admin [REQ] ---
TRAINER_JWT_SECRET=CHANGE_ME_MIN_16_CHARS
TRAINER_JWT_EXPIRES_SECONDS=604800
TRAINER_AUTH_COOKIE_NAME=trainer_auth
TRAINER_ADMIN_EMAIL=admin@example.com

# --- CORS [OPT] — اگر خالی: خودکار از APP_BASE_DOMAIN ---
# TRAINER_CORS_ORIGINS=https://dashboard.ehsanrahimi.com,https://products.ehsanrahimi.com,https://marketing.ehsanrahimi.com,https://trainer.ehsanrahimi.com

# --- Runtime [OPT] ---
# ENV=production
# NODE_ENV=production

# --- Airtable [LEG] — فقط اسکریپت migrate/inspect/mirror؛ در API زنده استفاده نمی‌شود ---
# AIRTABLE_API_KEY=
# AIRTABLE_BASE_ID=
# AIRTABLE_TABLE=
# AIRTABLE_PRODUCTS_API_KEY=
# AIRTABLE_PRODUCTS_BASE_ID=
# AIRTABLE_PRODUCTS_TABLE=
# AIRTABLE_HTTP_TIMEOUT_SECONDS=90
# AIRTABLE_HTTP_RETRIES=3
```

| متغیر | برچسب |
|--------|--------|
| `MONGODB_URI` | REQ |
| `MONGODB_DB_NAME` | REQ |
| `TRAINER_JWT_SECRET` | REQ (≥ ۱۶ کاراکتر) |
| `TRAINER_ADMIN_EMAIL` | REQ |
| `APP_BASE_DOMAIN` | DOM |
| `TRAINER_COOKIE_DOMAIN` | DOM (با نقطه: `.domain.com`) |
| `TRAINER_CORS_ORIGINS` | OPT |
| `AIRTABLE_*` | LEG |

`MONGODB_Username` / `MONGODB_Password` در کد خوانده نمی‌شوند — فقط `MONGODB_URI` کافی است.

### Build Context (Very Important)

- Dokploy service root **must** be `trainer/server` (not repo root).
- This folder now includes a dedicated `.dockerignore` to keep Nixpacks context small.
- Current default install profile is **CPU-only** (`requirements.txt`).
- For future GPU hosts, switch install command to:

```bash
pip install -r requirements.gpu.txt
```

---

## ۵) Products

```env
# --- Runtime ---
NODE_ENV=production

# --- Domain [DOM] ---
NEXT_PUBLIC_APP_BASE_DOMAIN=ehsanrahimi.com
APP_BASE_DOMAIN=ehsanrahimi.com

# --- Trainer API (browser → Trainer; CORS via trainer server) [URL] ---
NEXT_PUBLIC_TRAINER_API_BASE=https://trainer.ehsanrahimi.com/api

# --- Trainer Web UI (Manage users و لینک‌های cross-app) [URL] ---
# NEXT_PUBLIC_TRAINER_URL=https://trainer.ehsanrahimi.com

# --- Optional ---
# NEXT_PUBLIC_BASE_PATH=

# --- Alternative: same-origin proxy (فقط اگر تست کردید) ---
# NEXT_PUBLIC_TRAINER_API_BASE=/api/trainer
```

| متغیر | برچسب | مقدار اگر ست نشود |
|--------|--------|-------------------|
| `NEXT_PUBLIC_TRAINER_API_BASE` | URL | `https://trainer.{DOMAIN}/api` |

**تنظیم فعلی شما:** URL کامل Trainer — همان را در Dokploy نگه دارید.

---

## ۶) Marketing

```env
# --- Runtime ---
NODE_ENV=production

# --- Domain [DOM] ---
NEXT_PUBLIC_APP_BASE_DOMAIN=ehsanrahimi.com

# --- Trainer API [URL] [REQ] ---
NEXT_PUBLIC_TRAINER_API_BASE=https://trainer.ehsanrahimi.com/api

# --- Instagram Graph (Social stats) [OPT] ---
INSTAGRAM_ACCESS_TOKEN=CHANGE_ME_OR_LEAVE_EMPTY
INSTAGRAM_GRAPH_API_VERSION=v22.0

# --- Optional ---
# NEXT_PUBLIC_BASE_PATH=
# NEXT_PUBLIC_HUB_URL=https://dashboard.ehsanrahimi.com
# NEXT_PUBLIC_MARKETING_URL=https://marketing.ehsanrahimi.com
```

| متغیر | برچسب | توضیح |
|--------|--------|--------|
| `NEXT_PUBLIC_TRAINER_API_BASE` | URL / REQ | Calendar و campaigns از Trainer API |
| `INSTAGRAM_ACCESS_TOKEN` | OPT | بدون آن آمار اینستاگرام کار نمی‌کند |
| `NEXT_PUBLIC_AIRTABLE_*` | — | **در کد استفاده نمی‌شود — ست نکنید** |
| `MONGODB_*` | — | **در Marketing استفاده نمی‌شود — ست نکنید** |

---

## جدول URLهای ساخته‌شده از دامنه

وقتی `APP_BASE_DOMAIN=mybrand.com` و override URL خالی باشد:

| متغیر | مقدار |
|--------|--------|
| `BACKEND_DETECT_URL` | `https://dashboard.mybrand.com/api/detect` |
| `TRAINER_API_BASE` | `https://trainer.mybrand.com/api` |
| `NEXT_PUBLIC_TRAINER_API_BASE` | `https://trainer.mybrand.com/api` |
| `NEXT_PUBLIC_SCANNER_URL` | `https://dashboard.mybrand.com/scanner` |

---

## انتقال به دامنه / مشتری جدید [DOM]

در **همه** بلوک‌های بالا این‌ها را یکسان عوض کنید:

1. `NEXT_PUBLIC_APP_BASE_DOMAIN`
2. `APP_BASE_DOMAIN` (Trainer Server)
3. `TRAINER_COOKIE_DOMAIN` → `.{DOMAIN جدید}`
4. هر URL صریح که هنوز دامنهٔ قدیمی دارد
5. DNS چهار ساب‌دامین
6. Redeploy اپ‌های Next.js

`TRAINER_CORS_ORIGINS` را فقط اگر ساب‌دامین سفارشی دارید override کنید.

---

## لوکال (مرجع)

| سرویس | URL |
|--------|-----|
| Frontend | http://localhost:3003 |
| Backend | http://localhost:8000 |
| Trainer API | http://localhost:8010 |
| Trainer Web | http://localhost:3010 |
| Products | http://localhost:3004 |
| Marketing | http://localhost:3005 |

```env
# نمونه .env.local — Frontend
BACKEND_DETECT_URL=http://127.0.0.1:8000/detect
TRAINER_API_BASE=http://127.0.0.1:8010

# Products / Marketing / Trainer Web
NEXT_PUBLIC_TRAINER_API_BASE=http://localhost:8010
```

---

## چک‌لیست بعد از Deploy

- [ ] `https://dashboard.{DOMAIN}/scanner` — detect
- [ ] `https://dashboard.{DOMAIN}/api/health` — backend
- [ ] `https://trainer.{DOMAIN}/api/health` — trainer API
- [ ] Login در Products و Marketing
- [ ] `https://marketing.{DOMAIN}/calendar`
