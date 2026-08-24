import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { pool } from '../config/db.js';

const recoveryFile = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../tmp/restore-claims.json',
);

export async function restoreClaimsRecovery(_req, res) {
  const statements = JSON.parse(await fs.readFile(recoveryFile, 'utf8'));

  if (!Array.isArray(statements) || statements.length === 0) {
    throw new Error('Claim recovery payload is empty or invalid.');
  }

  const connection = await pool.getConnection();

  try {
    const [[before]] = await connection.query(
      'SELECT (SELECT COUNT(*) FROM Claim) AS claims, ' +
      '(SELECT COUNT(*) FROM UploadedFile) AS files',
    );

    for (const statement of statements) {
      await connection.query(statement);
    }

    const [[after]] = await connection.query(
      'SELECT (SELECT COUNT(*) FROM Claim) AS claims, ' +
      '(SELECT COUNT(*) FROM UploadedFile) AS files',
    );

    res.json({ ok: true, before, after });
  } catch (error) {
    try {
      await connection.query('ROLLBACK');
      await connection.query('SET FOREIGN_KEY_CHECKS=1');
    } catch {
      // Keep the original recovery error.
    }
    throw error;
  } finally {
    connection.release();
  }
}
