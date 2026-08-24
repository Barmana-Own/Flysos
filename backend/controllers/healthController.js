import { query } from '../config/db.js';

export async function health(_req, res) {
  await query('SELECT 1');

  res.json({
    ok: true,
    service: 'FlySOS Direct MySQL API',
    database: 'connected',
    timestamp: new Date().toISOString(),
  });
}
