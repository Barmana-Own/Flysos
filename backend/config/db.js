import mysql from 'mysql2/promise';
import { env } from './env.js';

export const pool = mysql.createPool({
  host: env.dbHost,
  port: env.dbPort,
  database: env.dbName,
  user: env.dbUser,
  password: env.dbPassword,
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
});

// Parameterized query execution helper
export async function query(sql, params) {
  const [results] = await pool.execute(sql, params);
  return results;
}

// Simple and safe database transaction manager
export async function transaction(callback) {
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  try {
    const tx = {
      query: async (sql, params) => {
        const [results] = await connection.execute(sql, params);
        return results;
      }
    };
    const result = await callback(tx);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
