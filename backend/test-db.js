import { pool } from './config/db.js';

try {
  const conn = await pool.getConnection();

  const [rows] = await conn.query(
    'SELECT DATABASE() AS db, CURRENT_USER() AS current_user'
  );

  console.log(rows);

  conn.release();
  process.exit(0);
} catch (err) {
  console.error(err);
  process.exit(1);
}
