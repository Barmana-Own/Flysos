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
async function indexExists(connection, table, indexName) {
  const [rows] = await connection.execute(
    'SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=? LIMIT 1',
    [table, indexName]
  );
  return rows.length > 0;
}

const connection = await pool.getConnection();
try {
  await connection.beginTransaction();
  await addColumn(connection, 'FaqInquiry', 'supportTicketId', 'VARCHAR(191) NULL');
  await addColumn(connection, 'FaqInquiry', 'answer', 'LONGTEXT NULL');
  await addColumn(connection, 'FaqInquiry', 'answeredAt', 'DATETIME(3) NULL');
  await addColumn(connection, 'FaqInquiry', 'answeredByAdminId', 'VARCHAR(191) NULL');
  if (!(await indexExists(connection, 'FaqInquiry', 'FaqInquiry_supportTicket_idx'))) {
    await connection.query('CREATE INDEX `FaqInquiry_supportTicket_idx` ON `FaqInquiry` (`supportTicketId`)');
  }
  await connection.commit();
  console.log('Round 2 FAQ/support migration completed successfully.');
} catch (error) {
  await connection.rollback();
  console.error(`Round 2 migration failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  connection.release();
  await pool.end();
}
