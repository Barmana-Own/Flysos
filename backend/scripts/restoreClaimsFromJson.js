import fs from 'node:fs';
import path from 'node:path';
import { pool } from '../config/db.js';

const inputPath = path.resolve(process.argv[2] || '');

if (!process.argv[2]) {
  console.error('Usage: node scripts/restoreClaimsFromJson.js <restore-statements.json>');
  process.exit(1);
}

const statements = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const connection = await pool.getConnection();

try {
  const [[before]] = await connection.query(
    'SELECT (SELECT COUNT(*) FROM Claim) AS claims, ' +
    '(SELECT COUNT(*) FROM UploadedFile) AS files'
  );

  for (const statement of statements) {
    await connection.query(statement);
  }

  const [[after]] = await connection.query(
    'SELECT (SELECT COUNT(*) FROM Claim) AS claims, ' +
    '(SELECT COUNT(*) FROM UploadedFile) AS files'
  );

  console.log(JSON.stringify({
    ok: true,
    before,
    after,
    restoredClaims: Number(after.claims) - Number(before.claims),
    restoredFileRecords: Number(after.files) - Number(before.files),
  }));
} catch (error) {
  try {
    await connection.query('ROLLBACK');
    await connection.query('SET FOREIGN_KEY_CHECKS=1');
  } catch {
    // Preserve the original recovery failure.
  }
  throw error;
} finally {
  connection.release();
  await pool.end();
}
