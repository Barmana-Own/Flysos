import { pool } from '../config/db.js';

async function tableExists(connection, table) {
  const [rows] = await connection.execute(
    'SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? LIMIT 1',
    [table]
  );
  return rows.length > 0;
}
async function columnExists(connection, table, column) {
  const [rows] = await connection.execute(
    'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=? LIMIT 1',
    [table, column]
  );
  return rows.length > 0;
}
async function addColumn(connection, table, column, definition) {
  if (await tableExists(connection, table) && !(await columnExists(connection, table, column))) {
    await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  }
}

const connection = await pool.getConnection();
try {
  await connection.beginTransaction();

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
    \`supportTicketId\` VARCHAR(191) NULL,
    \`answer\` LONGTEXT NULL,
    \`answeredAt\` DATETIME(3) NULL,
    \`answeredByAdminId\` VARCHAR(191) NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    INDEX \`FaqInquiry_status_created_idx\` (\`status\`, \`createdAt\`),
    INDEX \`FaqInquiry_supportTicket_idx\` (\`supportTicketId\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

  await addColumn(connection, 'FaqInquiry', 'supportTicketId', 'VARCHAR(191) NULL');
  await addColumn(connection, 'FaqInquiry', 'answer', 'LONGTEXT NULL');
  await addColumn(connection, 'FaqInquiry', 'answeredAt', 'DATETIME(3) NULL');
  await addColumn(connection, 'FaqInquiry', 'answeredByAdminId', 'VARCHAR(191) NULL');
  await addColumn(connection, 'SupportTicket', 'contactEmail', 'VARCHAR(191) NULL');
  await addColumn(connection, 'SupportTicket', 'contactPhone', 'VARCHAR(50) NULL');
  await addColumn(connection, 'SupportMessage', 'channel', "VARCHAR(30) NOT NULL DEFAULT 'website'");
  await addColumn(connection, 'SupportMessage', 'attachmentFileId', 'VARCHAR(191) NULL');

  const fullPermissions = JSON.stringify([
    'dashboard.view','claims.view','claims.edit','claims.assign','claims.files.replace','claims.ocr.rerun',
    'claims.notes','messages.send','messages.view','users.manage','roles.manage','settings.manage',
    'cms.pages','cms.articles','cms.footer','faq.manage','support.manage','reports.view','flights.sync'
  ]);
  await connection.query(
    `UPDATE AdminUser SET permissions=?
     WHERE accessLevel='all' OR role IN ('main_admin','supervisor','admin','manager')`,
    [fullPermissions]
  );

  await connection.commit();
  console.log('Round 6 stability, FAQ/support and permissions migration completed successfully.');
} catch (error) {
  await connection.rollback();
  console.error(`Round 6 migration failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  connection.release();
  await pool.end();
}
