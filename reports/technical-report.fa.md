# گزارش فنی انتشار Flysos

| مورد | مقدار |
|---|---|
| پروژه | Flysos |
| نوع گزارش | گزارش فنی انتشار |
| زبان | فارسی |
| تاریخ شمسی | ۱۴۰۵/۰۶/۲۴ |
| تاریخ میلادی | ۲۰۲۶-۰۹-۱۵ |
| وضعیت | NOT_PERFORMED؛ مسدود به علت ابزار نشست مرورگر |

## دامنه و انتخاب فایل

پس از بررسی `git status`، `project-state.json` و `release-manifest.json`، فایل‌های runtime مرتبط با پنج اصلاح برای انتشار شناسایی شدند: `index.html`، `admin/v2/login/index.html`، bundleهای فعال public/admin، سه helper پرسشنامه، helper رسید، `backend/controllers/cmsController.js`، `backend/services/claimReceiptContentService.js`، `backend/services/flightCacheService.js`، `backend/services/teamPerformanceService.js`، `backend/controllers/platformController.js`، `backend/routes/adminRoutes.js` و فایل‌های لازم قرارداد ویرایش پرواز (`adminController.js`، `adminSchemas.js` و `claimMapper.js`).

`backend/services/cmsSeedService.js` برای این انتشار انتخاب نشد؛ اجرای آن در startup مسیرهای seed/repair دیتابیس را فراخوانی می‌کند و با الزام عدم migration و عدم mutation داده واقعی سازگار نیست. هیچ فایل `.env`، `node_modules`، `uploads` یا داده پایگاه‌داده هدف قرار نگرفت.

## اعتبارسنجی محلی

| بررسی | وضعیت |
|---|---|
| تست‌های متمرکز پنج اصلاح | PASS؛ ۲۵ تست |
| کل تست‌های محلی | PASS؛ ۱۰۰ تست، صفر شکست |
| `node --check` فایل‌های منتخب | PASS |
| frontend build | NOT_RUN؛ پروژه فقط assetهای browser commit‌شده دارد |
| typecheck/lint | NOT_RUN؛ script یا پروژه build متناظر در workspace موجود نیست |
| migration/database | NOT_PERFORMED؛ طبق دستور کاربر |
| security mutation/exploitation | NOT_PERFORMED |

## بررسی live پیش از انتشار

- `https://flysos.ir/`: HTTP 200.
- `https://flysos.ir/api/health`: HTTP 200.
- `index.html`: HTTP 200، اما markerهای ticket و receipt در نسخه فعلی وجود ندارند.
- helperهای جدید: درخواست HTTP 200 ظاهری داشتند، اما پاسخ assetهای ticket و receipt، HTML fallback سایت بود و محتوای helper محلی را نداشت.
- `GET /api/pages/track`: HTTP 200، بدون بخش `رسید نهایی`.
- hash/content فایل‌های remote با نسخه محلی تطبیق نداشت.

## وضعیت انتشار

دو مسیر کنترل مرورگر موجود، یعنی runtime کنترل نشست و browser helper، به علت خطای `helper_unknown_error: apply deny-read ACLs` راه‌اندازی نشدند. نشست cPanel، رمز و کوکی درخواست یا استخراج نشد. در نتیجه backup مقصد، upload، overwrite، restart Passenger و بررسی live پس از انتشار انجام نشدند و هیچ موفقیت انتشار ادعا نمی‌شود.

## ریسک و اقدام بعدی

تا زمان در دسترس شدن کنترل همان نشست cPanel، نسخه live قدیمی باقی می‌ماند. پس از رفع ابزار، باید برای هر فایل مقصد backup گرفته شود، فقط فایل‌های منتخب upload شوند، اپ ثبت‌شده فقط از Setup Node.js App restart شود و سپس hash، markerهای HTML/helper، API track و health دوباره بررسی شوند.
