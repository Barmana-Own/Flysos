const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const backendRoot = path.resolve(__dirname, '..', 'backend');

function runTransactionProbe() {
  const script = String.raw`
    process.env.DB_NAME = 'db_connection_regression';
    process.env.DB_USER = 'db_connection_regression';
    process.env.DB_PASSWORD = '';
    process.env.JWT_SECRET = 'db-connection-regression-secret';

    const { runTransaction } = await import('./config/db.js');

    function fakeConnection(options = {}) {
      const events = [];
      return {
        events,
        async beginTransaction() {
          events.push('begin');
          if (options.beginError) throw options.beginError;
        },
        async execute() {
          events.push('query');
          return [[], []];
        },
        async commit() {
          events.push('commit');
          if (options.commitError) throw options.commitError;
        },
        async rollback() {
          events.push('rollback');
          if (options.rollbackError) throw options.rollbackError;
        },
        release() {
          events.push('release');
        },
        destroy() {
          events.push('destroy');
        },
      };
    }

    async function capture(pool, callback) {
      try {
        return { ok: true, value: await runTransaction(pool, callback) };
      } catch (error) {
        return { ok: false, code: error.code, message: error.message };
      }
    }

    const beginConnection = fakeConnection({
      beginError: Object.assign(new Error('begin failed'), { code: 'ECONNRESET', fatal: true }),
    });
    const beginResult = await capture(
      { getConnection: async () => beginConnection },
      async () => 'unreachable',
    );

    const rollbackConnection = fakeConnection({
      rollbackError: Object.assign(new Error('rollback failed'), { code: 'PROTOCOL_CONNECTION_LOST', fatal: true }),
    });
    const rollbackResult = await capture(
      { getConnection: async () => rollbackConnection },
      async () => {
        throw Object.assign(new Error('original failure'), { code: 'ORIGINAL_FAILURE' });
      },
    );

    const successConnection = fakeConnection();
    const successResult = await capture(
      { getConnection: async () => successConnection },
      async (tx) => {
        await tx.query('SELECT 1', []);
        return 'committed';
      },
    );

    console.log(JSON.stringify({
      beginResult,
      beginEvents: beginConnection.events,
      rollbackResult,
      rollbackEvents: rollbackConnection.events,
      successResult,
      successEvents: successConnection.events,
    }));
  `;

  return spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
    cwd: backendRoot,
    env: { ...process.env },
    encoding: 'utf8',
    timeout: 30_000,
  });
}

test('database transactions release failed connections and preserve the original error', () => {
  const result = runTransactionProbe();
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const line = result.stdout.trim().split(/\r?\n/).find((value) => value.startsWith('{'));
  assert.ok(line, result.stderr || result.stdout);
  const probe = JSON.parse(line);

  assert.deepEqual(probe.beginResult, {
    ok: false,
    code: 'ECONNRESET',
    message: 'begin failed',
  });
  assert.deepEqual(probe.beginEvents, ['begin', 'destroy']);

  assert.deepEqual(probe.rollbackResult, {
    ok: false,
    code: 'ORIGINAL_FAILURE',
    message: 'original failure',
  });
  assert.deepEqual(probe.rollbackEvents, ['begin', 'rollback', 'destroy']);

  assert.deepEqual(probe.successResult, { ok: true, value: 'committed' });
  assert.deepEqual(probe.successEvents, ['begin', 'query', 'commit', 'release']);
});
