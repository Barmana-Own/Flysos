import { app } from './app.js';
import { env } from './config/env.js';
import { pool } from './config/db.js';
import { startFlightCacheScheduler, stopFlightCacheScheduler } from './services/flightCacheService.js';
import { seedCmsPageContent } from './services/cmsSeedService.js';

async function synchronizeCmsEditor() {
  const connection = await pool.getConnection();
  try {
    await seedCmsPageContent(connection);
  } finally {
    connection.release();
  }
}

async function start() {
  try {
    await synchronizeCmsEditor();
  } catch (error) {
    // A CMS draft migration must never take the public API offline. The error
    // remains visible in stderr for diagnosis while the service starts normally.
    console.error(`CMS editor synchronization failed: ${error.message}`);
  }

  const server = app.listen(env.port, () => {
    console.log('FlySOS Direct MySQL API is running on:');
    console.log(`http://localhost:${env.port}/api`);
    startFlightCacheScheduler();
  });

  server.on('error', (error) => {
    console.error(`Could not start API server: ${error.message}`);
    process.exit(1);
  });

  let shuttingDown = false;

  function shutdown(signal) {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;

    console.log(`${signal} received. Closing FlySOS API...`);

    server.close(async () => {
      stopFlightCacheScheduler();
      await pool.end().catch(() => undefined);
      process.exit(0);
    });

    setTimeout(() => {
      process.exit(1);
    }, 10000).unref();
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

void start();
