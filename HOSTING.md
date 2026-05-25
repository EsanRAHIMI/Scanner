# راهنمای دیپلوی (Dokploy) — دامنه و Environment

معماری: **۴ ساب‌دامین ثابت** روی یک `APP_BASE_DOMAIN`.

| سرویس | ساب‌دامین | پورت |
|--------|-----------|------|
| Frontend (Hub + Scanner) | `lorenzo` | 3003 |
| Backend (YOLO) | پشت `lorenzo` → `/api` | 8000 |
| Trainer Web | `trainer` | 3010 |
| Trainer Server API | پشت `trainer` → `/api` | 8010 |
| Products | `products` | 3004 |
| Marketing | `marketing` | 3005 |

---

## ۱) متغیرهای الزامی (secrets و سرویس)

| سرویس | متغیر | توضیح |
|--------|--------|--------|
| **Backend** | `MODEL_PATH` | مسیر مدل، مثلاً `/app/models/best.pt` |
| **Trainer Server** | `MONGODB_URI` | اتصال MongoDB |
| **Trainer Server** | `MONGODB_DB_NAME` | نام دیتابیس |
| **Trainer Server** | `TRAINER_JWT_SECRET` | حداقل ۱۶ کاراکتر |
| **Trainer Server** | `TRAINER_ADMIN_EMAIL` | ایمیل ادمین |
| **Trainer Server** | `AIRTABLE_*` | کلیدها و جدول‌های Airtable (طبق `.env.example`) |
| **Marketing** | `NEXT_PUBLIC_AIRTABLE_*` | Airtable سمت کلاینت |
| **Marketing** | `MONGODB_URI`, `MONGODB_DB_NAME` | در صورت استفاده از APIهای محلی |
| **Marketing** | `INSTAGRAM_ACCESS_TOKEN` | اختیاری برای آمار اینستاگرام |

**دامنه:** اگر `APP_BASE_DOMAIN` / `NEXT_PUBLIC_APP_BASE_DOMAIN` را **ست نکنید**، پیش‌فرض کد `ehsanrahimi.com` است (همان پروداکشن فعلی).

---

## ۲) متغیرهای اختیاری — منبع دامنه

| متغیر | کجا | نقش |
|--------|-----|-----|
| `NEXT_PUBLIC_APP_BASE_DOMAIN` | همهٔ اپ‌های Next.js | منبع اصلی دامنه (کلاینت + build) |
| `APP_BASE_DOMAIN` | Trainer Server (+ fallback سرور Next) | همان دامنه برای CORS و کوکی |

**URLهایی که در صورت نبود env صریح، از دامنه ساخته می‌شوند:**

| متغیر (اختیاری) | مقدار پیش‌فرض ساخته‌شده |
|------------------|-------------------------|
| `BACKEND_DETECT_URL` | `https://lorenzo.{DOMAIN}/api/detect` |
| `TRAINER_API_BASE` | `https://trainer.{DOMAIN}/api` |
| `NEXT_PUBLIC_TRAINER_API_BASE` | `https://trainer.{DOMAIN}/api` |
| `NEXT_PUBLIC_SCANNER_URL` | `https://lorenzo.{DOMAIN}/scanner` |

`{DOMAIN}` = `NEXT_PUBLIC_APP_BASE_DOMAIN` یا `APP_BASE_DOMAIN` یا `ehsanrahimi.com`.

---

## ۳) Overrideهای اختیاری URL (جایگزین ساخت خودکار)

اگر ست شوند، **اولویت دارند** و مقدار ساخته‌شده از دامنه نادیده گرفته می‌شود:

| متغیر | مثال |
|--------|------|
| `BACKEND_DETECT_URL` | `https://lorenzo.example.com/api/detect` |
| `BACKEND_HEALTH_URL` | health سفارشی (معمولاً لازم نیست) |
| `TRAINER_API_BASE` | `https://trainer.example.com/api` |
| `NEXT_PUBLIC_TRAINER_API_BASE` | `https://trainer.example.com/api` یا `/api` (Trainer Web) یا `/api/trainer` (Products proxy) |
| `NEXT_PUBLIC_SCANNER_URL` | `https://lorenzo.example.com/scanner` |
| `NEXT_PUBLIC_LORENZO_URL` | URL کامل Hub |
| `NEXT_PUBLIC_TRAINER_URL` | URL کامل Trainer Web |
| `NEXT_PUBLIC_PRODUCTS_URL` | URL کامل Products |
| `NEXT_PUBLIC_MARKETING_URL` | URL کامل Marketing |
| `TRAINER_CORS_ORIGINS` | لیست comma-separated (جایگزین ساخت خودکار CORS) |

---

## ۴) انتقال به دامنه / مشتری جدید — فقط این‌ها را عوض کنید

| متغیر | اقدام |
|--------|--------|
| `NEXT_PUBLIC_APP_BASE_DOMAIN` | روی **Frontend, Products, Marketing, Trainer Web** → `customer.com` |
| `APP_BASE_DOMAIN` | روی **Trainer Server** → `customer.com` |
| `TRAINER_COOKIE_DOMAIN` | `.customer.com` (برای کوکی بین ساب‌دامین‌ها) |
| DNS | `lorenzo` / `trainer` / `products` / `marketing` → سرور |
| **اختیاری** | اگر ساب‌دامین یا مسیر API عوض شد، overrideهای بخش ۳ |

سپس **Redeploy** اپ‌های Next.js (متغیرهای `NEXT_PUBLIC_*` در build).

---

## Environment — حداقل (فقط دامنه + secrets)

### Frontend
```env
NEXT_PUBLIC_APP_BASE_DOMAIN=ehsanrahimi.com
# BACKEND_DETECT_URL و TRAINER_API_BASE خودکار ساخته می‌شوند
```

### Backend
```env
MODEL_PATH=/app/models/best.pt
```

### Trainer Web
```env
NEXT_PUBLIC_APP_BASE_DOMAIN=ehsanrahimi.com
# NEXT_PUBLIC_TRAINER_API_BASE → https://trainer.ehsanrahimi.com/api
# NEXT_PUBLIC_SCANNER_URL → https://lorenzo.ehsanrahimi.com/scanner
```

### Trainer Server
```env
APP_BASE_DOMAIN=ehsanrahimi.com
TRAINER_COOKIE_DOMAIN=.ehsanrahimi.com
MONGODB_URI=***
MONGODB_DB_NAME=lorenzodb
TRAINER_JWT_SECRET=***
TRAINER_ADMIN_EMAIL=***
AIRTABLE_API_KEY=***
# ...
```

### Products
```env
NEXT_PUBLIC_APP_BASE_DOMAIN=ehsanrahimi.com
# NEXT_PUBLIC_TRAINER_API_BASE → https://trainer.ehsanrahimi.com/api
```

### Marketing
```env
NEXT_PUBLIC_APP_BASE_DOMAIN=ehsanrahimi.com
NEXT_PUBLIC_AIRTABLE_API_KEY=***
NEXT_PUBLIC_AIRTABLE_BASE_ID=***
NEXT_PUBLIC_AIRTABLE_TABLE=***
MONGODB_URI=***
MONGODB_DB_NAME=lorenzodb
```

---

## Environment — همان تنظیمات صریح فعلی (اختیاری، رفتار یکسان)

اگر می‌خواهید envهای قبلی را نگه دارید، همان‌ها override هستند:

### Frontend
```env
NEXT_PUBLIC_APP_BASE_DOMAIN=ehsanrahimi.com
BACKEND_DETECT_URL=https://lorenzo.ehsanrahimi.com/api/detect
TRAINER_API_BASE=https://trainer.ehsanrahimi.com/api
```

### Trainer Web
```env
NEXT_PUBLIC_APP_BASE_DOMAIN=ehsanrahimi.com
NEXT_PUBLIC_TRAINER_API_BASE=/api
NEXT_PUBLIC_SCANNER_URL=https://lorenzo.ehsanrahimi.com/scanner
```

### Products
```env
NEXT_PUBLIC_APP_BASE_DOMAIN=ehsanrahimi.com
NEXT_PUBLIC_TRAINER_API_BASE=https://trainer.ehsanrahimi.com/api
```

### Marketing
```env
NEXT_PUBLIC_APP_BASE_DOMAIN=ehsanrahimi.com
NEXT_PUBLIC_TRAINER_API_BASE=https://trainer.ehsanrahimi.com/api
```

---

## لوکال

| سرویس | آدرس |
|--------|------|
| Frontend | http://localhost:3003 |
| Backend | http://localhost:8000 |
| Trainer API | http://localhost:8010 |
| Trainer Web | http://localhost:3010 |
| Products | http://localhost:3004 |
| Marketing | http://localhost:3005 |

بدون override در development، APIها به `localhost` و پورت‌های جدول بالا می‌روند.

---

## نکات

- اسرار را در git commit نکنید.
- Traefik: `lorenzo` → Frontend 3003 + `/api` → Backend؛ `trainer` → 3010 + `/api` → Trainer Server.
- Frontend در مرورگر همچنان از `/api/trainer` (same-origin) استفاده می‌کند مگر `NEXT_PUBLIC_TRAINER_API_BASE` override شود.
- Docker Compose بدون env: می‌توانید `BACKEND_DETECT_URL=http://backend:8000/detect` بگذارید (override).
