import { pool } from '../config/db.js';

const migrationId = 'brand-builder-update-20260722-v1';
const replacements = [
  [/فالی[\s\u200c]*اس[\s\u200c]*او[\s\u200c]*اس/g, 'Flysos'],
  [/فالی[\s\u200c]*سوس/g, 'Flysos'],
  [/فلای[\s\u200c]*اس[\s\u200c]*او[\s\u200c]*اس/g, 'Flysos'],
  [/فلای[\s\u200c]*سوس/g, 'Flysos'],
  [/\bFlySOS\b/g, 'Flysos'],
];

function normalizeBrand(value) {
  if (value == null) return value;
  let next = String(value);
  for (const [pattern, replacement] of replacements) next = next.replace(pattern, replacement);
  return next;
}

async function tableExists(connection, table) {
  const [rows] = await connection.execute(
    'SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? LIMIT 1',
    [table]
  );
  return rows.length > 0;
}

async function existingColumns(connection, table, columns) {
  const [rows] = await connection.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME IN (?)`,
    [table, columns]
  );
  return new Set(rows.map((row) => row.COLUMN_NAME));
}

async function normalizeTable(connection, table, columns) {
  if (!(await tableExists(connection, table))) return 0;
  const available = await existingColumns(connection, table, ['id', ...columns]);
  if (!available.has('id')) return 0;
  const selected = columns.filter((column) => available.has(column));
  if (!selected.length) return 0;

  const [rows] = await connection.query(
    `SELECT \`id\`, ${selected.map((column) => `\`${column}\``).join(', ')} FROM \`${table}\``
  );
  let changedRows = 0;
  for (const row of rows) {
    const updates = {};
    for (const column of selected) {
      const next = normalizeBrand(row[column]);
      if (next !== row[column]) updates[column] = next;
    }
    const entries = Object.entries(updates);
    if (!entries.length) continue;
    await connection.query(
      `UPDATE \`${table}\` SET ${entries.map(([column]) => `\`${column}\`=?`).join(', ')} WHERE \`id\`=?`,
      [...entries.map(([, value]) => value), row.id]
    );
    changedRows += 1;
  }
  return changedRows;
}

const targets = {
  AppSetting: ['siteName'],
  CmsPage: ['title', 'blocks', 'seo', 'draftBlocks', 'publishedBlocks', 'draftSeo', 'publishedSeo'],
  CmsPageVersion: ['title', 'blocks', 'seo'],
  CmsGlobalLayout: ['title', 'draftBlocks', 'publishedBlocks'],
  CmsMedia: ['title', 'description', 'altText'],
  FaqQuestion: ['question', 'answer'],
  MessageTemplate: ['title', 'body', 'subject'],
  SiteDocument: ['title'],
};

async function main() {
const connection = await pool.getConnection();
try {
  await connection.beginTransaction();
  if (await tableExists(connection, 'CmsMigration')) {
    const [done] = await connection.execute('SELECT 1 FROM `CmsMigration` WHERE `id`=? LIMIT 1', [migrationId]);
    if (done.length) {
      await connection.rollback();
      console.log('Flysos brand/page-builder update was already applied.');
      process.exitCode = 0;
      return;
    }
  }

  const summary = {};
  for (const [table, columns] of Object.entries(targets)) {
    summary[table] = await normalizeTable(connection, table, columns);
  }

  if (await tableExists(connection, 'CmsMigration')) {
    await connection.execute('INSERT IGNORE INTO `CmsMigration` (`id`) VALUES (?)', [migrationId]);
  }
  await connection.commit();
  console.log(`Flysos brand/page-builder update completed: ${JSON.stringify(summary)}`);
} catch (error) {
  await connection.rollback();
  console.error(`Flysos brand/page-builder update failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  connection.release();
  await pool.end();
}

}

await main();
