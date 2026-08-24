import { pool } from '../config/db.js';

async function columnExists(connection, table, column) {
  const [rows] = await connection.execute(
    'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=? LIMIT 1',
    [table, column]
  );
  return rows.length > 0;
}

async function addColumn(connection, table, column, definition) {
  if (!(await columnExists(connection, table, column))) {
    await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  }
}

const connection = await pool.getConnection();
try {
  await connection.beginTransaction();

  await addColumn(connection, 'AppSetting', 'requireTicketFile', 'BOOLEAN NOT NULL DEFAULT true');
  await connection.query(
    'UPDATE AppSetting SET requireTicketFile = COALESCE(requireTicketFile, requireNationalId, true) WHERE id = ?',
    ['default']
  );

  await connection.query(`CREATE TABLE IF NOT EXISTS \`SiteDocument\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`documentType\` VARCHAR(60) NOT NULL,
    \`title\` VARCHAR(191) NOT NULL,
    \`url\` LONGTEXT NOT NULL,
    \`originalName\` VARCHAR(500) NULL,
    \`mimetype\` VARCHAR(100) NULL,
    \`size\` BIGINT NULL,
    \`uploadedByAdminId\` VARCHAR(191) NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE INDEX \`SiteDocument_documentType_key\` (\`documentType\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

  await connection.commit();
  console.log('Round 5 settings, documents and publishing migration completed successfully.');
} catch (error) {
  await connection.rollback();
  console.error(`Round 5 migration failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  connection.release();
  await pool.end();
}
