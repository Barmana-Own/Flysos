import { pool } from '../config/db.js';

async function columnExists(connection, table, column) {
  const [rows] = await connection.execute(
    `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [table, column]
  );
  return rows.length > 0;
}

async function addColumn(connection, table, column, definition) {
  if (!(await columnExists(connection, table, column))) {
    await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  }
}

async function ensureIndex(connection, table, indexName, columnsSql) {
  const [rows] = await connection.execute(
    `SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
    [table, indexName]
  );
  if (!rows.length) {
    await connection.query(`CREATE INDEX \`${indexName}\` ON \`${table}\` (${columnsSql})`);
  }
}

const connection = await pool.getConnection();
try {
  await connection.beginTransaction();

  await addColumn(connection, 'AdminUser', 'permissions', 'LONGTEXT NULL');
  await addColumn(connection, 'AdminUser', 'accessLevels', 'LONGTEXT NULL');
  await addColumn(connection, 'AdminUser', 'positionTitle', 'VARCHAR(191) NULL');

  await addColumn(connection, 'Claim', 'ocrStatus', "VARCHAR(30) NOT NULL DEFAULT 'pending'");
  await addColumn(connection, 'Claim', 'ocrError', 'TEXT NULL');
  await addColumn(connection, 'Claim', 'ocrStartedAt', 'DATETIME(3) NULL');
  await addColumn(connection, 'Claim', 'ocrCompletedAt', 'DATETIME(3) NULL');

  await addColumn(connection, 'FlightInfo', 'ticketIssueDate', 'VARCHAR(100) NULL');

  await addColumn(connection, 'UploadedFile', 'questionId', 'VARCHAR(191) NULL');
  await addColumn(connection, 'UploadedFile', 'questionLabel', 'VARCHAR(500) NULL');
  await addColumn(connection, 'UploadedFile', 'replacedAt', 'DATETIME(3) NULL');
  await addColumn(connection, 'UploadedFile', 'replacedByAdminId', 'VARCHAR(191) NULL');

  await addColumn(connection, 'QuestionnaireAnswer', 'sortOrder', 'INTEGER NOT NULL DEFAULT 0');
  await addColumn(connection, 'ClaimNote', 'attachmentFileId', 'VARCHAR(191) NULL');

  await addColumn(connection, 'SupportTicket', 'contactEmail', 'VARCHAR(191) NULL');
  await addColumn(connection, 'SupportTicket', 'contactPhone', 'VARCHAR(50) NULL');
  await addColumn(connection, 'SupportMessage', 'attachmentFileId', 'VARCHAR(191) NULL');
  await addColumn(connection, 'SupportMessage', 'channel', "VARCHAR(30) NOT NULL DEFAULT 'website'");

  await addColumn(connection, 'AppSetting', 'contactPhone', "VARCHAR(50) NOT NULL DEFAULT '02128421314'");
  await addColumn(connection, 'AppSetting', 'contactEmail', "VARCHAR(191) NOT NULL DEFAULT 'info@flysos.ir'");
  await addColumn(connection, 'AppSetting', 'socialHandle', "VARCHAR(100) NOT NULL DEFAULT '@flysos'");
  await addColumn(connection, 'AppSetting', 'baleUrl', 'LONGTEXT NULL');
  await addColumn(connection, 'AppSetting', 'telegramUrl', 'LONGTEXT NULL');
  await addColumn(connection, 'AppSetting', 'linkedinUrl', 'LONGTEXT NULL');
  await addColumn(connection, 'AppSetting', 'instagramUrl', 'LONGTEXT NULL');
  await addColumn(connection, 'AppSetting', 'goftinoWidgetId', 'VARCHAR(191) NULL');
  await addColumn(connection, 'AppSetting', 'customHeadCode', 'LONGTEXT NULL');
  await addColumn(connection, 'AppSetting', 'rightsDocumentUrl', 'LONGTEXT NULL');
  await addColumn(connection, 'AppSetting', 'powerOfAttorneyDocumentUrl', 'LONGTEXT NULL');

  await addColumn(connection, 'CmsPage', 'pageType', "VARCHAR(30) NOT NULL DEFAULT 'page'");
  await addColumn(connection, 'CmsPage', 'category', 'VARCHAR(191) NULL');
  await addColumn(connection, 'CmsPage', 'tags', 'LONGTEXT NULL');
  await addColumn(connection, 'CmsPage', 'keywords', 'LONGTEXT NULL');
  await addColumn(connection, 'CmsPage', 'featuredImageUrl', 'LONGTEXT NULL');

  await connection.query(`CREATE TABLE IF NOT EXISTS \`FaqQuestion\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`category\` VARCHAR(100) NOT NULL DEFAULT 'general',
    \`question\` TEXT NOT NULL,
    \`answer\` LONGTEXT NOT NULL,
    \`sortOrder\` INTEGER NOT NULL DEFAULT 0,
    \`status\` VARCHAR(30) NOT NULL DEFAULT 'published',
    \`createdByAdminId\` VARCHAR(191) NULL,
    \`updatedByAdminId\` VARCHAR(191) NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    INDEX \`FaqQuestion_status_order_idx\` (\`status\`, \`sortOrder\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

  await connection.query(`CREATE TABLE IF NOT EXISTS \`FaqInquiry\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`question\` TEXT NOT NULL,
    \`contactEmail\` VARCHAR(191) NULL,
    \`contactPhone\` VARCHAR(50) NULL,
    \`status\` VARCHAR(30) NOT NULL DEFAULT 'new',
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    INDEX \`FaqInquiry_status_created_idx\` (\`status\`, \`createdAt\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

  await connection.query(`CREATE TABLE IF NOT EXISTS \`MessageLog\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`claimId\` VARCHAR(191) NULL,
    \`adminId\` VARCHAR(191) NULL,
    \`direction\` VARCHAR(20) NOT NULL DEFAULT 'outbound',
    \`channel\` VARCHAR(30) NOT NULL DEFAULT 'sms',
    \`recipient\` VARCHAR(191) NULL,
    \`body\` TEXT NOT NULL,
    \`status\` VARCHAR(30) NOT NULL DEFAULT 'queued',
    \`providerMessageId\` VARCHAR(191) NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    INDEX \`MessageLog_claim_created_idx\` (\`claimId\`, \`createdAt\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

  await connection.query(`CREATE TABLE IF NOT EXISTS \`OrganizationRole\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`title\` VARCHAR(191) NOT NULL,
    \`code\` VARCHAR(100) NOT NULL,
    \`permissions\` LONGTEXT NOT NULL,
    \`isSystem\` BOOLEAN NOT NULL DEFAULT false,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE INDEX \`OrganizationRole_code_key\` (\`code\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

  await ensureIndex(connection, 'QuestionnaireAnswer', 'QuestionnaireAnswer_claim_sort_idx', '`claimId`, `sortOrder`');
  await ensureIndex(connection, 'UploadedFile', 'UploadedFile_claim_question_idx', '`claimId`, `questionId`');

  const defaultPermissions = JSON.stringify([
    'dashboard.view','claims.view','claims.edit','claims.assign','claims.files.replace','claims.ocr.rerun',
    'claims.notes','messages.send','messages.view','users.manage','roles.manage','settings.manage',
    'cms.pages','cms.articles','cms.footer','faq.manage','support.manage','reports.view','flights.sync'
  ]);
  await connection.query(
    `UPDATE AdminUser SET permissions = COALESCE(NULLIF(permissions, ''), ?) WHERE role = 'supervisor' OR accessLevel = 'all'`,
    [defaultPermissions]
  );

  const roles = [
    ['role-main-admin', 'ادمین اصلی', 'main_admin', defaultPermissions, 1],
    ['role-content-admin', 'ادمین محتوایی', 'content_admin', JSON.stringify(['dashboard.view','cms.pages','cms.articles','cms.footer','faq.manage']), 1],
    ['role-passenger-admin', 'ادمین مدیریت مسافران', 'passenger_admin', JSON.stringify(['dashboard.view','claims.view','claims.edit','claims.assign','claims.files.replace','claims.ocr.rerun','claims.notes','messages.send','messages.view']), 1],
    ['role-senior-expert', 'کارشناس ارشد', 'senior_expert', JSON.stringify(['dashboard.view','claims.view','claims.edit','claims.notes','messages.view','reports.view']), 1],
    ['role-expert', 'کارشناس', 'expert', JSON.stringify(['dashboard.view','claims.view','claims.notes','messages.view']), 1],
  ];
  for (const role of roles) {
    await connection.query(
      `INSERT INTO OrganizationRole (id,title,code,permissions,isSystem) VALUES (?,?,?,?,?)
       ON DUPLICATE KEY UPDATE title=VALUES(title), permissions=VALUES(permissions), isSystem=VALUES(isSystem)`,
      role
    );
  }

  const faqRows = [
    ['faq-ticket-data', 'شروع و ثبت درخواست', 'آیا باید اطلاعات پرواز را وارد کنم؟', 'برای سهولت کار در صورتی که تصویر واضح بلیت خود را در سایت بارگذاری کرده باشید، دیگر نیازی نیست اطلاعات پرواز خود را وارد کنید. سیستم به صورت خودکار اطلاعات شما را از بلیت استخراج خواهد نمود.', 10],
    ['faq-after-submit', 'شروع و ثبت درخواست', 'چه اتفاقی بعد از ثبت درخواست می‌افتد؟', 'پس از ثبت درخواست، کارشناسان Flysos مدارک را بررسی می‌کنند. در صورتی که مشمول دریافت خسارت باشید، برای تکمیل وکالت و ادامه مراحل قانونی با شما تماس گرفته می‌شود.', 20],
    ['faq-tracking', 'شروع و ثبت درخواست', 'آیا امکان پیگیری درخواست وجود دارد؟', 'بله. از طریق صفحه اصلی، بخش ثبت/پیگیری پرونده، با وارد کردن کد ملی و کد پیگیری که برای شما پیامک شده است می‌توانید آخرین وضعیت پرونده را مشاهده کنید.', 30],
    ['faq-documents', 'مدارک و بارگذاری', 'چه مدارکی برای ثبت درخواست لازم است؟', 'تصویر واضح بلیت پرواز الزامی است. کارت پرواز فقط برای پرونده تاخیر پرواز و به صورت اختیاری قابل بارگذاری است.', 40],
    ['faq-fee', 'هزینه‌ها و حق‌الزحمه', 'هزینه‌ها و حق‌الزحمه چگونه محاسبه می‌شود؟', 'ثبت و پیگیری پرونده بدون هزینه اولیه انجام می‌شود. تمامی هزینه‌های پیگیری شامل هزینه وکلا، طرح شکایت و دادرسی بر عهده Flysos است. فقط در صورت موفقیت، کارمزد ۲۰ درصدی از مبلغ خسارت دریافتی کسر می‌شود.', 50],
    ['faq-duration', 'هزینه‌ها و حق‌الزحمه', 'مدت زمان بررسی و دریافت خسارت چقدر است؟', 'مدت زمان رسیدگی به شرایط پرونده و روند مراجع قانونی بستگی دارد و معمولاً بین ۱ تا ۳ ماه است.', 60],
  ];
  for (const row of faqRows) {
    await connection.query(
      `INSERT INTO FaqQuestion (id,category,question,answer,sortOrder,status) VALUES (?,?,?,?,?,'published')
       ON DUPLICATE KEY UPDATE category=VALUES(category), question=VALUES(question), answer=VALUES(answer), sortOrder=VALUES(sortOrder), status='published'`,
      row
    );
  }

  await connection.query(
    `UPDATE AppSetting SET siteName='Flysos / مرکز تخصصی پیگیری خسارت تأخیر و ابطال پرواز',
     contactPhone=COALESCE(NULLIF(contactPhone,''),'02128421314'),
     contactEmail=COALESCE(NULLIF(contactEmail,''),'info@flysos.ir'),
     socialHandle=COALESCE(NULLIF(socialHandle,''),'@flysos')`
  );

  const articleRows = [
    {
      id: 'article-delay-rights',
      title: 'خسارت تأخیر پرواز؛ حقوق مسافر و روش پیگیری',
      slug: 'flight-delay-compensation',
      category: 'خسارت تأخیر پرواز',
      tags: ['خسارت تأخیر پرواز','حقوق مسافر','تاخیر هواپیما'],
      keywords: ['خسارت پرواز','خسارت تاخیر','حقوق مسافر هوایی'],
      description: 'راهنمای تخصصی شرایط دریافت خسارت تأخیر پرواز و مدارک لازم برای پیگیری قانونی.',
      paragraphs: [
        'در صورت تأخیر پرواز، نوع خدمات و میزان غرامت به مدت تأخیر، علت آن و شرایط پرونده بستگی دارد. اطلاعات دقیق پرواز و تصویر واضح بلیت برای بررسی اولیه اهمیت دارد.',
        'Flysos پس از بررسی مدارک، در صورت احراز شرایط دریافت خسارت، مراحل حقوقی و قضایی را بدون دریافت هزینه اولیه پیگیری می‌کند. کارمزد ۲۰ درصدی فقط از خسارت وصول‌شده کسر می‌شود.'
      ]
    },
    {
      id: 'article-cancellation-rights',
      title: 'خسارت ابطال پرواز و مدارک مورد نیاز',
      slug: 'flight-cancellation-compensation',
      category: 'خسارت ابطال پرواز',
      tags: ['خسارت ابطال پرواز','لغو پرواز','بلیت هواپیما'],
      keywords: ['خسارت ابطال','پرواز لغو شده','پیگیری خسارت پرواز'],
      description: 'شرایط پیگیری خسارت ابطال پرواز، استرداد بلیت و مدارک مورد نیاز مسافر.',
      paragraphs: [
        'در پرونده ابطال پرواز، تصویر واضح بلیت مدرک اصلی ثبت اولیه است. پیامک ایرلاین، رسید استرداد و بلیت جایگزین نیز می‌تواند در بررسی پرونده مؤثر باشد.',
        'کارشناسان Flysos مدارک را بررسی کرده و در صورت مشمول بودن پرونده، مراحل وکالت و پیگیری قضایی را با مسافر هماهنگ می‌کنند.'
      ]
    }
  ];
  for (const article of articleRows) {
    const blocks = [
      { id: `${article.id}-heading`, type: 'heading', order: 0, visible: true, content: { text: article.title, level: 1 }, styles: {}, settings: {}, animations: {}, responsive: {}, children: [] },
      ...article.paragraphs.map((text, index) => ({ id: `${article.id}-p-${index}`, type: 'paragraph', order: index + 1, visible: true, content: { text }, styles: {}, settings: {}, animations: {}, responsive: {}, children: [] }))
    ];
    const seo = {
      metaTitle: `${article.title} | Flysos`,
      metaDescription: article.description,
      canonical: `https://flysos.ir/articles/${article.slug}`,
      robotsIndex: true,
      robotsFollow: true,
      openGraphTitle: article.title,
      openGraphDescription: article.description,
      openGraphImage: 'https://flysos.ir/assets/flysos-airport-passenger-hero.jpg'
    };
    await connection.query(
      `INSERT INTO CmsPage (id,title,slug,status,blocks,seo,draftBlocks,publishedBlocks,draftSeo,publishedSeo,publishedAt,pageType,category,tags,keywords,featuredImageUrl)
        VALUES (?,?,?,'published',?,?,?,?,?,?,NOW(3),'article',?,?,?,?)
       ON DUPLICATE KEY UPDATE title=VALUES(title),status='published',blocks=VALUES(blocks),seo=VALUES(seo),draftBlocks=VALUES(draftBlocks),publishedBlocks=VALUES(publishedBlocks),draftSeo=VALUES(draftSeo),publishedSeo=VALUES(publishedSeo),publishedAt=COALESCE(publishedAt,NOW(3)),pageType='article',category=VALUES(category),tags=VALUES(tags),keywords=VALUES(keywords),featuredImageUrl=VALUES(featuredImageUrl)`,
      [article.id, article.title, article.slug, JSON.stringify(blocks), JSON.stringify(seo), JSON.stringify(blocks), JSON.stringify(blocks), JSON.stringify(seo), JSON.stringify(seo), article.category, JSON.stringify(article.tags), JSON.stringify(article.keywords), '/assets/flysos-airport-passenger-hero.jpg']
    );
  }

  await connection.commit();
  console.log('Employer revision migration completed successfully.');
} catch (error) {
  await connection.rollback();
  console.error(`Employer revision migration failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  connection.release();
  await pool.end();
}
