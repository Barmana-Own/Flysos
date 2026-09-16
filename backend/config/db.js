import mysql from 'mysql2/promise';
import { env } from './env.js';

export const pool = mysql.createPool({
  host: env.dbHost,
  port: env.dbPort,
  database: env.dbName,
  user: env.dbUser,
  password: env.dbPassword,
  waitForConnections: true,
  connectionLimit: env.dbConnectionLimit,
  maxIdle: env.dbConnectionLimit,
  idleTimeout: env.dbIdleTimeoutMs,
  queueLimit: env.dbQueueLimit,
  connectTimeout: env.dbConnectTimeoutMs,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

// Parameterized query execution helper
export async function query(sql, params) {
  const [results] = await pool.execute(sql, params);
  return results;
}

const FATAL_CONNECTION_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'PROTOCOL_CONNECTION_LOST',
  'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR',
]);

function isFatalConnectionError(error) {
  return Boolean(
    error?.fatal || FATAL_CONNECTION_CODES.has(String(error?.code || '')),
  );
}

function destroyBrokenConnection(connection) {
  if (typeof connection?.destroy !== 'function') {
    return false;
  }

  try {
    connection.destroy();
    return true;
  } catch {
    return false;
  }
}

export async function runTransaction(poolLike, callback) {
  const connection = await poolLike.getConnection();
  let transactionStarted = false;
  let shouldRelease = true;

  try {
    await connection.beginTransaction();
    transactionStarted = true;

    const tx = {
      query: async (sql, params) => {
        const [results] = await connection.execute(sql, params);
        return results;
      }
    };
    const result = await callback(tx);
    await connection.commit();
    transactionStarted = false;
    return result;
  } catch (error) {
    if (transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        // Never replace the business/DB error that caused the rollback.
        console.error(
          `[DB] Transaction rollback failed (${String(rollbackError?.code || 'UNKNOWN_ERROR')}).`,
        );
        if (isFatalConnectionError(rollbackError)) {
          shouldRelease = false;
          destroyBrokenConnection(connection);
        }
      }
    }

    if (isFatalConnectionError(error)) {
      shouldRelease = false;
      destroyBrokenConnection(connection);
    }

    throw error;
  } finally {
    if (shouldRelease) {
      connection.release();
    }
  }
}

// Simple and safe database transaction manager
export async function transaction(callback) {
  return runTransaction(pool, callback);
}
