<div dir="rtl" align="right">

# راهنمای ساختار پایگاه‌داده سامانه FlySOS

**نسخه سند:** ۱.۰
**تاریخ تهیه:** ۲۵ شهریور ۱۴۰۵ / ۱۶ سپتامبر ۲۰۲۶
**مخاطب:** کارفرما، مدیر فنی و پشتیبان سرور

## ۱. خلاصه اجرایی

این سند توضیح می‌دهد اطلاعات سامانه FlySOS در چه حوزه‌هایی دسته‌بندی می‌شود، هر رکورد در کدام جدول قرار می‌گیرد و ارتباط منطقی جدول‌ها چگونه است.

بررسی کد backend و migrationهای موجود نشان می‌دهد پایگاه‌داده فعلی سامانه از **MySQL یا MariaDB** استفاده می‌کند و اتصال برنامه با بسته `mysql2` انجام می‌شود. در کد فعلی نشانه‌ای از اتصال به Microsoft SQL Server، درایور `mssql` یا Entity Framework وجود ندارد.

بنابراین:

- این راهنما مستند واقعی ساختار MySQL/MariaDB سامانه است.
- عبارت «SQL Server» نباید به معنای Microsoft SQL Server تفسیر شود؛ اگر هدف انتقال به Microsoft SQL Server باشد، این کار یک پروژه مهاجرت جداگانه است.
- رمز عبور، توکن پیامک، کلید JWT و اطلاعات خصوصی سرور عمداً در این سند درج نشده‌اند.
- برای تأیید نهایی وضعیت production، دستورهای بخش «بازبینی دیتابیس روی سرور» باید با دسترسی مدیر سرور اجرا شوند.

## ۲. معماری کلی ذخیره‌سازی

سامانه از یک پایگاه‌داده رابطه‌ای مرکزی استفاده می‌کند. داده‌های اصلی در جدول‌های رابطه‌ای ذخیره می‌شوند و بعضی فیلدهای انعطاف‌پذیر مانند محتوای CMS، پاسخ OCR، قالب پیامک و payload خام پرواز به‌صورت JSON متنی در ستون‌های متنی نگهداری می‌شوند.

فایل‌های ارسالی کاربران و فایل‌های رسانه‌ای CMS معمولاً به‌صورت فایل فیزیکی در مسیر `UPLOAD_DIR` قرار می‌گیرند و مشخصات، مسیر و مجوز آن‌ها در جدول‌های `UploadedFile` یا `CmsMedia` ذخیره می‌شود. بنابراین پشتیبان‌گیری از دیتابیس به‌تنهایی برای بازیابی کامل فایل‌ها کافی نیست.

### ارتباط منطقی حوزه‌های اصلی

```text
Customer
  └── Claim
        ├── Passenger
        ├── FlightInfo
        ├── UploadedFile
        ├── QuestionnaireAnswer
        ├── ClaimBankDetails
        ├── ClaimStatusHistory
        ├── ClaimNote ─────── AdminUser
        ├── MessageLog ─────── AdminUser
        ├── Notification
        └── SupportTicket ─── SupportMessage

AdminUser ─── Claim.assignedAdminId
AdminUser ─── OrganizationRole / permissions

CmsPage ─── CmsPageVersion
CmsPage ─── CmsMedia (از طریق URL/شناسه کاربردی)
CmsGlobalLayout
CmsMigration
AppSetting
SiteDocument

ExternalFlightSnapshot ─── FlightFeedRun
ExternalFlightCountSnapshot
FlightStatus (مسیر سازگاری/وضعیت‌های قدیمی)
```

ارتباط‌های بالا، ارتباط منطقی و قراردادی برنامه را نشان می‌دهند. برای اعلام وجود یا نبودن Foreign Key در دیتابیس production باید خروجی `SHOW CREATE TABLE` روی همان سرور بررسی شود؛ این سند بدون دسترسی مستقیم به credential دیتابیس، Foreign Key جدیدی را فرض نمی‌کند.

## ۳. تنظیمات اتصال backend به دیتابیس

تنظیمات اتصال از متغیرهای محیطی خوانده می‌شوند و در کد hard-code نشده‌اند.

| متغیر | کاربرد | نکته عملیاتی |
|---|---|---|
| `DB_HOST` | نام میزبان دیتابیس | در production مقدار واقعی سرور دیتابیس قرار می‌گیرد. |
| `DB_PORT` | پورت اتصال | مقدار معمول MySQL برابر `3306` است، اما مقدار محیط production ملاک است. |
| `DB_NAME` | نام دیتابیس سامانه | نباید در frontend یا اسناد عمومی منتشر شود. |
| `DB_USER` | کاربر اتصال برنامه | بهتر است کاربر اختصاصی با حداقل دسترسی باشد. |
| `DB_PASSWORD` | رمز کاربر دیتابیس | فقط در environment سرور نگهداری شود، نه در Git. |
| `DB_CONNECTION_LIMIT` | سقف اتصال‌های هم‌زمان pool | در کد با سقف محافظتی محدود می‌شود. |
| `DB_QUEUE_LIMIT` | سقف صف درخواست‌های اتصال | برای جلوگیری از مصرف بی‌نهایت منابع. |
| `DB_CONNECT_TIMEOUT_MS` | timeout برقراری اتصال | در صورت قطعی دیتابیس، درخواست‌ها بی‌نهایت معطل نمی‌مانند. |
| `DB_IDLE_TIMEOUT_MS` | زمان نگهداری اتصال idle | برای مدیریت چرخه عمر pool. |

اتصال با `mysql2/promise` و pool انجام می‌شود. queryهای اصلی از پارامترهای جداگانه استفاده می‌کنند تا مقدار ورودی کاربر مستقیماً داخل SQL الحاق نشود. عملیات چندمرحله‌ای مهم مانند ویرایش پرونده و تغییر وضعیت در transaction اجرا می‌شوند.

## ۴. کاتالوگ جدول‌های سامانه

### ۴.۱ پرونده، مسافر و اطلاعات پرواز

| جدول | نقش | اطلاعات مهم و چرخه ثبت |
|---|---|---|
| `Customer` | پروفایل مالک/ثبت‌کننده پرونده | شناسه، کد ملی، نام، تلفن، ایمیل، وضعیت و یادداشت. معمولاً یک مشتری می‌تواند چند پرونده داشته باشد. |
| `Claim` | رکورد اصلی پرونده و کد پیگیری | نوع خسارت، وضعیت، مرحله، `trackingCode`، `customerId`، `assignedAdminId`، اولویت، زمان ایجاد/به‌روزرسانی، داده استخراج‌شده بلیت و وضعیت OCR. هر درخواست مسافر یک رکورد اصلی در این جدول دارد. |
| `Passenger` | اطلاعات مسافر مرتبط با پرونده | از طریق `claimId` به پرونده متصل است و نام و اطلاعات مسافر را نگه می‌دارد. |
| `FlightInfo` | مشخصات بلیت و پرواز | شرکت هواپیمایی، شماره پرواز، تاریخ و ساعت، مبدأ، مقصد، مسیر، PNR، شماره بلیت، مبلغ، کلاس پروازی، تاریخ صدور بلیت و متن خام OCR. ویرایش مشخصات پرواز از این مسیر ذخیره می‌شود. |
| `UploadedFile` | متادیتای فایل‌های ارسالی پرونده | نام فایل، مسیر امن، نوع فایل، `claimId`، نوع مدرک، شناسه و عنوان سؤال، زمان جایگزینی و کارشناس جایگزین‌کننده. محتوای فایل در filesystem است، نه در خود جدول. |
| `QuestionnaireAnswer` | پاسخ‌های پرسشنامه پرونده | شناسه پرونده، شناسه سؤال، بخش، پاسخ و ترتیب نمایش. پاسخ‌ها هنگام ثبت نهایی پرونده اعتبارسنجی می‌شوند. |
| `ClaimBankDetails` | اطلاعات بانکی برای پرداخت خسارت | بانک، صاحب حساب، شماره کارت، شماره حساب و شبا؛ از طریق `claimId` به پرونده متصل است. این جدول داده بسیار حساس دارد. |
| `ClaimStatusHistory` | تاریخچه تغییر وضعیت پرونده | وضعیت قبلی، وضعیت جدید، توضیح، زمان و شناسه پرونده. برای گزارش میانگین زمان بررسی و audit وضعیت استفاده می‌شود. |
| `ClaimNote` | یادداشت داخلی کارشناسان | متن یادداشت، نویسنده، پرونده، پیوست اختیاری و زمان ثبت. برای مسافر عمومی نیست مگر مسیر مشخصی آن را ارائه کند. |
| `Notification` | اعلان‌های پنل و پرونده | نوع اعلان، متن، پرونده، گیرنده، زمان خوانده‌شدن و زمان ایجاد. |

#### چرخه ثبت پرونده

۱. اطلاعات مشتری و پرونده در `Customer` و `Claim` ثبت می‌شود.
۲. فایل بلیت در storage ذخیره و metadata آن در `UploadedFile` درج می‌شود.
۳. OCR در پس‌زمینه اجرا می‌شود و داده خام/استخراج‌شده را در `Claim.extractedTicketData` و در صورت امکان در `FlightInfo`، `Passenger` و `Customer` تکمیل می‌کند.
۴. پاسخ‌های پرسشنامه در `QuestionnaireAnswer` قرار می‌گیرند.
۵. تغییر وضعیت در `Claim` ثبت و رویداد آن در `ClaimStatusHistory` نگهداری می‌شود.
۶. ارجاع پرونده به کارشناس با مقدار `Claim.assignedAdminId` انجام می‌شود.
۷. پیامک‌ها و عملیات اطلاع‌رسانی در `MessageLog` و `Notification` قابل پیگیری هستند.

### ۴.۲ کاربران مدیریتی، کارشناسان و مجوزها

| جدول | نقش | اطلاعات مهم |
|---|---|---|
| `AdminUser` | حساب ورود مدیران و کارشناسان | نام کاربری، hash رمز عبور، نام، ایمیل، تلفن، نقش، وضعیت فعال/غیرفعال، سطح دسترسی، `permissions`، `accessLevels`، سمت سازمانی و تصویر. رمز خام ذخیره نمی‌شود. |
| `OrganizationRole` | نقش‌های سازمانی و مجموعه مجوزها | عنوان نقش، کد یکتا، JSON مجوزها و سیستمی‌بودن نقش. نقش‌های اصلی مانند مدیر اصلی، مدیر محتوا، مدیر پرونده و کارشناس در این حوزه تعریف می‌شوند. |

`AdminUser.id` مرجع منطقی انتساب پرونده، نویسنده یادداشت، فرستنده پیام و ثبت‌کننده برخی تغییرات است. سرویس backend قبل از ارجاع پرونده وجود کارشناس مقصد و سطح دسترسی درخواست‌کننده را بررسی می‌کند.

### ۴.۳ پیامک، پشتیبانی و پرسش‌های متداول

| جدول | نقش | اطلاعات مهم |
|---|---|---|
| `MessageLog` | سابقه ارسال پیامک/پیام | پرونده، کاربر مدیریتی، جهت، کانال، گیرنده، متن، وضعیت ارسال، شناسه پیام سرویس‌دهنده و زمان. توکن سرویس پیامک در این جدول ذخیره نمی‌شود. |
| `SupportTicket` | تیکت پشتیبانی | مشتری، پرونده، موضوع، وضعیت، ایمیل/تلفن، hash توکن عمومی، زمان آخرین پیام و زمان بسته‌شدن. |
| `SupportMessage` | پیام‌های داخل تیکت | شناسه تیکت، فرستنده، نویسنده مدیر، متن، کانال، فایل پیوست و زمان. |
| `FaqQuestion` | سؤال و جواب عمومی FAQ | دسته، سؤال، پاسخ، ترتیب، وضعیت انتشار و شناسه مدیر ایجادکننده/ویرایش‌کننده. |
| `FaqInquiry` | سؤال ارسال‌شده از فرم FAQ | متن سؤال، اطلاعات تماس، وضعیت پاسخ، پاسخ مدیر، زمان پاسخ و اتصال اختیاری به تیکت پشتیبانی. |

### ۴.۴ تنظیمات سامانه، CMS و فایل‌های عمومی

| جدول | نقش | اطلاعات مهم |
|---|---|---|
| `AppSetting` | تنظیمات سراسری سامانه | معمولاً یک رکورد با شناسه `default`: نام سایت، تنظیمات پیامک، کمیسیون، حالت تعمیر، الزامی‌بودن فایل بلیت، لینک اسناد حقوقی، اطلاعات تماس، شبکه‌های اجتماعی، قالب‌های SMS و شناسه عمومی Goftino. |
| `CmsPage` | صفحات و محتوای قابل ویرایش | عنوان، slug، وضعیت، بلوک‌های draft/published، SEO، نویسنده و ویرایش‌کننده، دسته، tag، keyword و تصویر شاخص. متن بلوک‌ها و SEO به‌صورت JSON متنی نگهداری می‌شوند. |
| `CmsPageVersion` | تاریخچه نسخه‌های صفحات | صفحه، شماره نسخه، عنوان، slug، وضعیت، بلوک‌ها، SEO، مدیر ایجادکننده و زمان. برای بازبینی یا بازگردانی نسخه استفاده می‌شود. |
| `CmsGlobalLayout` | بخش‌های عمومی مانند header/footer | نوع layout، عنوان، draft، published، زمان انتشار و مدیر آخرین ویرایش. |
| `CmsMedia` | کتابخانه فایل‌های رسانه‌ای CMS | نام ذخیره‌شده، نام اصلی، MIME، حجم، URL، دسته، alt، عنوان، توضیح و مدیر بارگذاری‌کننده. فایل واقعی در مسیر media نگهداری می‌شود. |
| `CmsMigration` | علامت اجرای migrationهای محتوایی | هر migration با شناسه یکتا ثبت می‌شود تا دوباره روی محتوای موجود اعمال نشود. |
| `SiteDocument` | اسناد قابل انتشار سایت | نوع سند، عنوان، URL، نام اصلی، MIME، حجم، مدیر بارگذاری‌کننده و زمان‌ها؛ نوع سند به‌صورت یکتا نگهداری می‌شود. |

در CMS دو وضعیت اصلی وجود دارد: `draft` برای ویرایش و `published` برای نمایش عمومی. تغییر draft تا زمان انتشار نباید نسخه عمومی را تغییر دهد. اجرای migrationهای CMS باید idempotent باشد؛ یعنی اجرای دوباره نباید صفحه یا محتوای کاربر را بی‌دلیل پاک کند.

### ۴.۵ مانیتورینگ و cache پروازها

| جدول | نقش | اطلاعات مهم و نگهداری |
|---|---|---|
| `ExternalFlightSnapshot` | snapshot پروازهای دریافت‌شده از provider | منبع، شناسه پرواز provider، مسیر، شماره پرواز، ایرلاین، زمان برنامه‌ای، وضعیت، دقیقه تأخیر، لغوشدن، payload خام و زمان دریافت. رکوردهای قدیمی‌تر از ۴۸ ساعت برای هر منبع پاک‌سازی می‌شوند. |
| `ExternalFlightCountSnapshot` | snapshot تعداد پروازهای اعلام‌شده provider | تعداد، payload خام و زمان دریافت. |
| `FlightFeedRun` | لاگ هر اجرای sync | منبع، وضعیت اجرا، تعداد کل/تأخیری/لغوشده، خطا، زمان شروع و پایان. برای تشخیص timeout یا خطای provider استفاده می‌شود. |
| `FlightStatus` | مسیر سازگاری برای وضعیت‌های قدیمی پرواز | ممکن است در نصب‌های قدیمی وجود داشته باشد؛ مسیرهای جدید monitor از snapshotها استفاده می‌کنند. حذف آن بدون بررسی migration مجاز نیست. |

sync پروازها با درخواست `GET` از provider انجام می‌شود و زمان‌بندی پیش‌فرض آن ۱۰ دقیقه است. در خطای provider، آخرین snapshot معتبر حفظ می‌شود و خطا در `FlightFeedRun` ثبت می‌گردد.

## ۵. انواع داده مهم و نحوه دسته‌بندی

### داده‌های حساس

موارد زیر باید محدود به backend و مدیران مجاز باشند:

- کد ملی و تلفن مسافر؛
- اطلاعات حساب، کارت و شبا در `ClaimBankDetails`؛
- تصاویر بلیت و مدارک در `UploadedFile`؛
- متن OCR و payloadهای خام پرواز؛
- متن تیکت‌های پشتیبانی؛
- hash توکن‌های دسترسی عمومی تیکت.

### داده‌های عمومی یا قابل انتشار

- صفحات منتشرشده CMS و SEO؛
- FAQهای دارای وضعیت `published`؛
- تنظیمات عمومی contact و لینک‌های سایت؛
- وضعیت خلاصه پروازهایی که endpoint عمومی اجازه نمایش آن‌ها را می‌دهد.

### داده‌های JSON متنی

برای سازگاری با نصب‌های قبلی، چند فیلد به شکل JSON serialize شده و در ستون متنی نگهداری می‌شوند، از جمله:

- `CmsPage.blocks`, `draftBlocks`, `publishedBlocks`, `seo` و نسخه‌های مرتبط؛
- `CmsGlobalLayout.draftBlocks` و `publishedBlocks`؛
- `AdminUser.permissions` و `accessLevels`؛
- `AppSetting.smsTemplates`؛
- `Claim.extractedTicketData`؛
- `ExternalFlightSnapshot.rawPayload` و `ExternalFlightCountSnapshot.rawPayload`.

ویرایش مستقیم این فیلدها با SQL خام توصیه نمی‌شود؛ چون ساختار JSON و سازگاری نسخه‌های frontend/backend باید هم‌زمان حفظ شود.

## ۶. قواعد ثبت، ویرایش و حذف

۱. تغییرات پرونده از API احراز هویت‌شده و با کنترل نقش انجام می‌شود، نه با دست‌کاری مستقیم جدول.
۲. تغییر وضعیت پرونده باید همراه با ثبت `ClaimStatusHistory` باشد.
۳. ارجاع پرونده به کارشناس در `Claim.assignedAdminId` ذخیره می‌شود و مقدار خالی به معنی لغو تخصیص است.
۴. حذف پرونده عملیاتی حساس است؛ سرویس حذف وابستگی‌های فایل، پرسشنامه، تاریخچه، یادداشت، بانک و اعلان را در transaction مدیریت می‌کند.
۵. جایگزینی سند CMS باید رکورد metadata را به‌روزرسانی و cleanup فایل قدیمی را فقط پس از commit انجام دهد.
۶. فایل فیزیکی را نباید فقط با حذف رکورد دیتابیس حذف کرد؛ مسیر ذخیره‌سازی و ارجاع‌های دیگر باید بررسی شوند.
۷. migrationها باید قبل از اجرا backup داشته باشند و روی محیط آزمایشی تست شوند.
۸. هر تغییر schema باید به‌صورت idempotent و با بررسی وجود جدول/ستون اجرا شود.

## ۷. migrationها و وضعیت schema

در repository یک فایل schema واحد برای بازسازی کل دیتابیس وجود ندارد؛ بخشی از جدول‌های پایه از قبل در دیتابیس نصب شده‌اند و migrationهای مرحله‌ای ستون‌ها و جدول‌های تکمیلی را اضافه می‌کنند. migrationهای مهم موجود عبارت‌اند از:

| فایل/مسیر | مسئولیت |
|---|---|
| `backend/scripts/runCmsMigration.js` | آماده‌سازی draft/published برای `CmsPage` و seed محتوای CMS. |
| `backend/scripts/runLegalDocumentsMigration.js` | اضافه‌کردن و backfill فیلدهای اسناد حقوقی در `AppSetting`. |
| `backend/scripts/runRound5Migration.js` | الزامی‌بودن فایل بلیت و جدول `SiteDocument`. |
| `backend/scripts/runRound6Migration.js` | FAQ، inquiry، مجوزها و تکمیل ستون‌های پشتیبانی. |
| `backend/scripts/runEmployerRevisionMigration.js` | ستون‌های کارشناسان، OCR، اطلاعات تماس، CMS، پیامک و نقش‌های سازمانی. |
| `backend/services/flightCacheService.js` | ایجاد/تکمیل جدول‌های snapshot پرواز و اجرای cache. |
| `backend/services/adminPermissionService.js` | تکمیل ستون‌های مجوز `AdminUser` در صورت نبودن. |

قبل از اجرای هر migration:

- از دیتابیس و پوشه upload backup تهیه شود؛
- وضعیت فعلی `SHOW CREATE TABLE` ثبت شود؛
- migration روی staging اجرا و تست شود؛
- log اجرای migration نگهداری شود؛
- در صورت خطا، transaction و rollback بررسی شود.

## ۸. بازبینی دیتابیس روی سرور

دستورهای زیر برای MySQL/MariaDB هستند. رمز را در command line ننویسید؛ گزینه `-p` باعث می‌شود ابزار آن را تعاملی دریافت کند.

### اتصال و شناسایی دیتابیس

```sql
SELECT VERSION();
SELECT DATABASE();
SHOW TABLES;
```

### فهرست جدول‌ها، موتور و حجم تقریبی

```sql
SELECT
  TABLE_NAME,
  ENGINE,
  TABLE_ROWS,
  DATA_LENGTH,
  INDEX_LENGTH,
  CREATE_TIME,
  UPDATE_TIME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME;
```

`TABLE_ROWS` در بعضی موتورهای MySQL تخمینی است؛ برای شمارش قطعی از `SELECT COUNT(*)` استفاده شود.

### مشاهده ستون‌ها و کلیدها

```sql
SHOW COLUMNS FROM Claim;
SHOW INDEX FROM Claim;
SHOW CREATE TABLE Claim;
```

همین سه دستور برای جدول‌های حساس زیر نیز توصیه می‌شود:

```sql
SHOW CREATE TABLE Customer;
SHOW CREATE TABLE FlightInfo;
SHOW CREATE TABLE UploadedFile;
SHOW CREATE TABLE AdminUser;
SHOW CREATE TABLE CmsPage;
SHOW CREATE TABLE AppSetting;
```

### شمارش رکوردهای کلیدی

```sql
SELECT 'Customer' AS table_name, COUNT(*) AS total FROM Customer
UNION ALL SELECT 'Claim', COUNT(*) FROM Claim
UNION ALL SELECT 'FlightInfo', COUNT(*) FROM FlightInfo
UNION ALL SELECT 'UploadedFile', COUNT(*) FROM UploadedFile
UNION ALL SELECT 'AdminUser', COUNT(*) FROM AdminUser
UNION ALL SELECT 'CmsPage', COUNT(*) FROM CmsPage;
```

### بررسی پرونده‌های بدون کارشناس مسئول

```sql
SELECT id, trackingCode, status, createdAt
FROM Claim
WHERE assignedAdminId IS NULL OR assignedAdminId = ''
ORDER BY createdAt DESC;
```

این query فقط برای گزارش است و هیچ رکوردی را تغییر نمی‌دهد.

## ۹. backup و بازیابی

### backup دیتابیس

نمونه عمومی برای MySQL/MariaDB:

```bash
mysqldump --single-transaction --routines --triggers --events \
  -h DB_HOST -P DB_PORT -u DB_USER -p DB_NAME > flysos-db-YYYY-MM-DD.sql
```

پارامترهای `DB_HOST`، `DB_PORT`، `DB_USER` و `DB_NAME` باید از environment سرور خوانده شوند. فایل backup باید خارج از web root، رمزگذاری‌شده و با دسترسی محدود نگهداری شود.

### بازیابی

```bash
mysql -h DB_HOST -P DB_PORT -u DB_USER -p DB_NAME < flysos-db-YYYY-MM-DD.sql
```

بازیابی باید ابتدا روی محیط آزمایشی انجام شود. بعد از restore، health endpoint، ورود مدیر، فهرست پرونده‌ها، یک صفحه CMS و مسیر فایل‌های upload بررسی شوند.

### backup فایل‌ها

همراه backup دیتابیس، مسیر واقعی `UPLOAD_DIR` و به‌خصوص زیرمسیرهای پرونده و CMS نیز باید backup شوند. دیتابیس فقط metadata و مسیر را نگه می‌دارد و بدون فایل فیزیکی، رکورد `UploadedFile` یا `CmsMedia` به‌تنهایی برای بازیابی فایل کافی نیست.

## ۱۰. اگر واقعاً Microsoft SQL Server مدنظر باشد

Microsoft SQL Server با MySQL/MariaDB تفاوت فنی دارد. برنامه فعلی برای MySQL/MariaDB نوشته شده و موارد زیر مستقیماً قابل انتقال نیستند:

- درایور و pool اتصال فعلی `mysql2` است؛
- placeholder و API اجرای query بر مبنای MySQL است؛
- syntaxهایی مانند backtick، `NOW(3)`، `ON DUPLICATE KEY UPDATE` و `DATE_SUB` مخصوص قرارداد فعلی هستند؛
- migrationهای موجود با `information_schema` و syntax MySQL نوشته شده‌اند.

برای مهاجرت به Microsoft SQL Server باید پروژه جداگانه‌ای شامل طراحی mapping نوع داده، تبدیل queryها، migration جدید، تست transaction، تبدیل JSON/LONGTEXT، بررسی indexها و تغییر درایور اجرا شود. تا زمانی که چنین پروژه‌ای انجام نشده، دیتابیس سامانه را MySQL/MariaDB معرفی کنید.

معادل اولیه بازبینی در SQL Server، فقط برای دیتابیس‌هایی است که واقعاً روی SQL Server ساخته شده‌اند:

```sql
SELECT @@VERSION;
SELECT DB_NAME();
SELECT TABLE_SCHEMA, TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_SCHEMA, TABLE_NAME;
```

این دستورها نباید روی دیتابیس فعلی FlySOS اجرا یا به‌عنوان migration استفاده شوند.

## ۱۱. مسئولیت‌های عملیاتی کارفرما و پشتیبان

- credential دیتابیس فقط در اختیار پشتیبان مجاز و مدیر فنی باشد.
- دسترسی کاربر دیتابیس برنامه حداقلی باشد؛ کاربر برنامه نباید برای استفاده روزمره دسترسی حذف schema داشته باشد.
- backup روزانه، نگهداری چند نسخه و تست restore دوره‌ای تعریف شود.
- backup دیتابیس و uploadها هم‌زمان و با یک شناسه زمانی نگهداری شوند.
- logهای حاوی کد ملی، شماره کارت، token و متن کامل مدارک عمومی نشوند.
- migration و تغییر مستقیم SQL در زمان کم‌ترافیک و پس از backup انجام شود.
- برای تغییر محتوای سایت از پنل مدیریت محتوا استفاده شود؛ SQL مستقیم برای اصلاح متن‌ها توصیه نمی‌شود.
- بعد از هر تغییر زیرساختی، `GET /api/health` و یک مسیر read-only مانند فهرست پرونده‌ها یا صفحات CMS بررسی شود.

## ۱۲. محدودیت این سند

این راهنما بر اساس source code، routeها، queryها و migrationهای موجود در repository تهیه شده است. در زمان تهیه سند، credential دیتابیس production برای استخراج مستقیم `SHOW CREATE TABLE` در اختیار این سند قرار نگرفته است؛ بنابراین مقدار واقعی row count، collation، engine، Foreign Keyها و indexهای نصب فعلی باید با دستورهای بخش ۸ از خود سرور ثبت و به این سند پیوست شود.

**نتیجه:** ساختار عملیاتی فعلی FlySOS یک دیتابیس رابطه‌ای MySQL/MariaDB با حوزه‌های پرونده، کاربران مدیریتی، CMS، پشتیبانی، پیامک و cache پرواز است. برای تحویل به کارفرما، این فایل همراه با خروجی بازبینی production و برنامه backup/restore نگهداری شود.

</div>
