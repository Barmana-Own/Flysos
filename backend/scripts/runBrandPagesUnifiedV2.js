import { pool } from '../config/db.js';

const migrationId = 'brand-pages-unified-20260722-v2';
const replacements = [
  [/ف(?:ا|آ)ل(?:ی|ي)[\s\u200c\u200d-]*ا(?:س|ص)[\s\u200c\u200d-]*ا(?:و|ؤ)[\s\u200c\u200d-]*ا(?:س|ص)/gi, 'Flysos'],
  [/ف(?:ا|آ)ل(?:ی|ي)[\s\u200c\u200d-]*سوس/gi, 'Flysos'],
  [/فل(?:ا|آ)(?:ی|ي)[\s\u200c\u200d-]*ا(?:س|ص)[\s\u200c\u200d-]*ا(?:و|ؤ)[\s\u200c\u200d-]*ا(?:س|ص)/gi, 'Flysos'],
  [/فل(?:ا|آ)(?:ی|ي)[\s\u200c\u200d-]*سوس/gi, 'Flysos'],
  [/\bFlySOS\.ir\b/g, 'Flysos'],
  [/\bFlysos\.ir\b/g, 'Flysos'],
  [/\bFlySOS\b/g, 'Flysos'],
  [/\bFLYSOS\b/g, 'Flysos'],
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

async function textTables(connection) {
  const [rows] = await connection.query(
    `SELECT c.TABLE_NAME, c.COLUMN_NAME, c.DATA_TYPE
       FROM information_schema.COLUMNS c
       JOIN information_schema.COLUMNS pk
         ON pk.TABLE_SCHEMA=c.TABLE_SCHEMA
        AND pk.TABLE_NAME=c.TABLE_NAME
        AND pk.COLUMN_NAME='id'
      WHERE c.TABLE_SCHEMA=DATABASE()
        AND c.COLUMN_NAME<>'id'
        AND c.DATA_TYPE IN ('char','varchar','tinytext','text','mediumtext','longtext','json')
      ORDER BY c.TABLE_NAME,c.ORDINAL_POSITION`
  );
  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.TABLE_NAME)) grouped.set(row.TABLE_NAME, []);
    grouped.get(row.TABLE_NAME).push(row.COLUMN_NAME);
  }
  return grouped;
}

async function normalizeTable(connection, table, columns) {
  if (!columns.length) return 0;
  const quoted = columns.map((column) => `\`${column}\``).join(',');
  const [rows] = await connection.query(`SELECT \`id\`,${quoted} FROM \`${table}\``);
  let changed = 0;
  for (const row of rows) {
    const updates = [];
    const values = [];
    for (const column of columns) {
      const next = normalizeBrand(row[column]);
      if (next !== row[column]) {
        updates.push(`\`${column}\`=?`);
        values.push(next);
      }
    }
    if (!updates.length) continue;
    values.push(row.id);
    await connection.query(`UPDATE \`${table}\` SET ${updates.join(',')} WHERE \`id\`=?`, values);
    changed += 1;
  }
  return changed;
}

async function main() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const grouped = await textTables(connection);
    const summary = {};
    for (const [table, columns] of grouped.entries()) {
      summary[table] = await normalizeTable(connection, table, columns);
    }

    if (await tableExists(connection, 'CmsMigration')) {
      await connection.execute('INSERT IGNORE INTO `CmsMigration` (`id`) VALUES (?)', [migrationId]);
    }
    await connection.commit();
    console.log(`Flysos brand and public-page unification completed: ${JSON.stringify(summary)}`);
  } catch (error) {
    await connection.rollback();
    console.error(`Flysos brand and public-page unification failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    connection.release();
    await pool.end();
  }
}

await main();
