import { randomUUID } from 'node:crypto';

import { pool, query, transaction } from '../config/db.js';
import { env, FLIGHT_IMPORT_SECRET_MIN_LENGTH } from '../config/env.js';
import { getExternalFlightsCount, normalizeFlights } from './externalFlightService.js';

const DEFAULT_SYNC_INTERVAL_MS = 10 * 60 * 1000;
const DEFAULT_LIMIT = 500;
const PROVIDER_TIMEOUT_MS = 45_000;
const PROVIDER_RETRIES = 2;
const MAX_FLIGHTS_PER_FEED = 10_000;
export const PUSHED_FLIGHT_FEED_SOURCES = Object.freeze([
  'all_recent',
  'cancelled_last_24h',
  'delayed_last_24h',
]);
const MAX_PROVIDER_COUNT = 2_147_483_647;
let schedulerStarted = false;
let syncInProgress = false;
let syncTimer = null;
let flightCacheTablesPromise = null;

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function invalidPushedFlightPayload() {
  const error = new Error('Invalid flight import payload.');
  error.code = 'INVALID_FLIGHT_IMPORT_PAYLOAD';
  return error;
}

export function validatePushedFlightPayload(payload = {}) {
  if (!isPlainObject(payload) || !isPlainObject(payload.feeds)) {
    throw invalidPushedFlightPayload();
  }

  const feedNames = Object.keys(payload.feeds);
  if (
    !feedNames.includes('all_recent') ||
    feedNames.some((sourceName) => !PUSHED_FLIGHT_FEED_SOURCES.includes(sourceName))
  ) {
    throw invalidPushedFlightPayload();
  }

  for (const sourceName of feedNames) {
    const feed = payload.feeds[sourceName];
    if (!Array.isArray(feed) && !isPlainObject(feed)) {
      throw invalidPushedFlightPayload();
    }
  }

  const providerCount = payload.providerCount ?? null;
  if (
    providerCount !== null &&
    (!Number.isSafeInteger(providerCount) || providerCount < 0 || providerCount > MAX_PROVIDER_COUNT)
  ) {
    throw invalidPushedFlightPayload();
  }

  return { feeds: payload.feeds, providerCount };
}

function emptyFlightCounts() {
  return { totalFlights: 0, delayedFlights: 0, cancelledFlights: 0 };
}

function nowDate() {
  return new Date();
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function asBool(value, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function parseInteger(value, fallback, min = 1, max = 10000) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min) return fallback;
  return Math.min(parsed, max);
}

function parseJsonFeeds(value) {
  if (!value || !String(value).trim()) return [];

  try {
    const parsed = JSON.parse(value);
    const list = Array.isArray(parsed) ? parsed : [parsed];

    return list
      .map((item, index) => {
        if (typeof item === 'string') {
          return { name: `feed_${index + 1}`, url: item };
        }

        if (item && typeof item === 'object' && typeof item.url === 'string') {
          return {
            name: String(item.name || `feed_${index + 1}`).trim(),
            url: item.url.trim(),
          };
        }

        return null;
      })
      .filter(Boolean);
  } catch {
    return String(value)
      .split(',')
      .map((url, index) => ({ name: `feed_${index + 1}`, url: url.trim() }))
      .filter((item) => item.url);
  }
}

function withPathSuffix(rawUrl, suffix) {
  try {
    const url = new URL(rawUrl);
    const basePath = url.pathname.replace(/\/+$/, '');
    url.pathname = `${basePath}${suffix}`;
    return url.toString();
  } catch {
    return rawUrl;
  }
}

function configuredFeeds() {
  const fromJsonOrCsv = parseJsonFeeds(process.env.EXTERNAL_FLIGHT_FEEDS);
  const fromIndexed = [1, 2, 3, 4]
    .map((index) => {
      const url = process.env[`EXTERNAL_FLIGHT_FEED_URL_${index}`]?.trim();
      if (!url) return null;
      return {
        name: process.env[`EXTERNAL_FLIGHT_FEED_NAME_${index}`]?.trim() || `feed_${index}`,
        url,
      };
    })
    .filter(Boolean);

  const feeds = [...fromJsonOrCsv, ...fromIndexed];

  // If the user only configures the provider base URL + username/password,
  // automatically connect the three list endpoints:
  // /flights, /flights/cancelled-last-24h, /flights/delayed-last-24h.
  // The /count endpoint is stored separately in ExternalFlightCountSnapshot.
  if (!feeds.length && env.externalFlightsBaseUrl) {
    feeds.push(
      { name: 'all_recent', url: env.externalFlightsBaseUrl },
      { name: 'cancelled_last_24h', url: withPathSuffix(env.externalFlightsBaseUrl, '/cancelled-last-24h') },
      { name: 'delayed_last_24h', url: withPathSuffix(env.externalFlightsBaseUrl, '/delayed-last-24h') },
    );
  }

  const seen = new Set();
  return feeds.filter((feed) => {
    const key = `${feed.name}:${feed.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function buildProviderUrl(feed, limit) {
  const url = new URL(feed.url);

  if (env.externalFlightsUsername && !url.searchParams.has('username')) {
    url.searchParams.set('username', env.externalFlightsUsername);
  }

  if (env.externalFlightsPassword && !url.searchParams.has('password')) {
    url.searchParams.set('password', env.externalFlightsPassword);
  }

  if (limit && !url.searchParams.has('limit')) {
    url.searchParams.set('limit', String(limit));
  }

  return url;
}

function maskedProviderUrl(url) {
  const safeUrl = new URL(url);
  if (safeUrl.searchParams.has('password')) safeUrl.searchParams.set('password', '***');
  return safeUrl.toString();
}

function normalizeSourceName(value) {
  return String(value || 'feed')
    .trim()
    .replace(/[^a-zA-Z0-9_\-:\u0600-\u06FF]/g, '_')
    .slice(0, 90) || 'feed';
}

function serializable(value) {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return null;
  }
}

function providerErrorMessage(error) {
  if (error?.name === 'AbortError') return 'Flight provider request timed out.';
  const cause = error?.cause;
  if (cause?.code) return `${error?.message || 'Flight provider request failed.'} (${cause.code})`;
  return error?.message || 'Flight feed failed.';
}

async function initializeFlightCacheTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS ExternalFlightSnapshot (
      id VARCHAR(191) NOT NULL,
      sourceName VARCHAR(100) NOT NULL,
      providerFlightId VARCHAR(191) NULL,
      routeFrom VARCHAR(191) NULL,
      routeTo VARCHAR(191) NULL,
      route VARCHAR(383) NULL,
      flightNumber VARCHAR(191) NULL,
      airline VARCHAR(191) NULL,
      scheduledTime VARCHAR(191) NULL,
      statusText VARCHAR(191) NULL,
      statusType VARCHAR(50) NOT NULL DEFAULT 'ontime',
      delayMinutes INTEGER NULL,
      cancelled BOOLEAN NOT NULL DEFAULT false,
      rawPayload LONGTEXT NULL,
      fetchedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      INDEX ExternalFlightSnapshot_source_fetched_idx (sourceName, fetchedAt),
      INDEX ExternalFlightSnapshot_status_idx (statusType),
      INDEX ExternalFlightSnapshot_flight_idx (flightNumber, scheduledTime),
      PRIMARY KEY (id)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  // Older installations are upgraded only when a column is actually missing.
  // Re-running ALTER TABLE on every public request can acquire an expensive
  // metadata lock and make cached flight responses appear unavailable.
  const columns = await query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ExternalFlightSnapshot'`,
  );
  const columnNames = new Set(columns.map((column) => column.COLUMN_NAME));
  if (!columnNames.has('delayMinutes')) {
    await query('ALTER TABLE ExternalFlightSnapshot ADD COLUMN delayMinutes INTEGER NULL AFTER statusType');
  }
  if (!columnNames.has('cancelled')) {
    await query('ALTER TABLE ExternalFlightSnapshot ADD COLUMN cancelled BOOLEAN NOT NULL DEFAULT false AFTER delayMinutes');
  }
  if (!columnNames.has('route')) {
    await query('ALTER TABLE ExternalFlightSnapshot ADD COLUMN route VARCHAR(383) NULL AFTER routeTo');
  }

  await query(`
    CREATE TABLE IF NOT EXISTS FlightFeedRun (
      id VARCHAR(191) NOT NULL,
      sourceName VARCHAR(100) NOT NULL,
      status VARCHAR(50) NOT NULL,
      totalFlights INTEGER NOT NULL DEFAULT 0,
      delayedFlights INTEGER NOT NULL DEFAULT 0,
      cancelledFlights INTEGER NOT NULL DEFAULT 0,
      errorMessage TEXT NULL,
      startedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      finishedAt DATETIME(3) NULL,
      INDEX FlightFeedRun_source_started_idx (sourceName, startedAt),
      INDEX FlightFeedRun_started_idx (startedAt),
      PRIMARY KEY (id)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ExternalFlightCountSnapshot (
      id VARCHAR(191) NOT NULL,
      providerCount INTEGER NOT NULL DEFAULT 0,
      rawPayload LONGTEXT NULL,
      fetchedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      INDEX ExternalFlightCountSnapshot_fetched_idx (fetchedAt)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
}

async function ensureFlightCacheTables() {
  if (!flightCacheTablesPromise) {
    flightCacheTablesPromise = initializeFlightCacheTables().catch((error) => {
      flightCacheTablesPromise = null;
      throw error;
    });
  }
  return flightCacheTablesPromise;
}

async function withFlightSyncLock(callback, { skipIfInProgress = true } = {}) {
  if (syncInProgress && skipIfInProgress) {
    return { ok: true, skipped: true, reason: 'sync_in_progress' };
  }

  const lockName = 'flysos_flight_feed_sync';
  const lockConnection = await pool.getConnection();
  let lockAcquired = false;
  let ownsSyncInProgress = false;

  try {
    const [lockRows] = await lockConnection.query(
      'SELECT GET_LOCK(?, 0) AS acquired',
      [lockName],
    );
    lockAcquired = Number(lockRows[0]?.acquired) === 1;

    if (!lockAcquired) {
      return { ok: true, skipped: true, reason: 'sync_running_on_another_worker' };
    }

    syncInProgress = true;
    ownsSyncInProgress = true;
    return await callback();
  } finally {
    if (ownsSyncInProgress) {
      syncInProgress = false;
    }
    if (lockAcquired) {
      await lockConnection.query('SELECT RELEASE_LOCK(?)', [lockName]).catch(() => undefined);
    }
    lockConnection.release();
  }
}

async function insertRun({ sourceName, status, totalFlights = 0, delayedFlights = 0, cancelledFlights = 0, errorMessage = null, startedAt, finishedAt }) {
  await query(
    'INSERT INTO FlightFeedRun (id, sourceName, status, totalFlights, delayedFlights, cancelledFlights, errorMessage, startedAt, finishedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      `ffrun-${randomUUID()}`,
      sourceName,
      status,
      totalFlights,
      delayedFlights,
      cancelledFlights,
      errorMessage ? String(errorMessage).slice(0, 1200) : null,
      startedAt,
      finishedAt,
    ],
  );
}

async function fetchFeed(feed, limit) {
  const url = buildProviderUrl(feed, limit);
  let lastError;

  for (let attempt = 0; attempt <= PROVIDER_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: 'GET', signal: controller.signal,
        headers: { Accept: 'application/json', 'User-Agent': 'FlySOS-Backend/1.0' },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const error = new Error(`Flight provider returned HTTP ${response.status}.`);
        error.httpStatus = response.status;
        throw error;
      }
      return payload;
    } catch (error) {
      lastError = error;
      console.warn('[flight-cache] feed sync failed', {
        feed: feed.name, attempt: attempt + 1, url: maskedProviderUrl(url),
        status: error?.httpStatus || null, error: providerErrorMessage(error),
      });
      if (attempt < PROVIDER_RETRIES) await wait(750 * (attempt + 1));
    } finally {
      clearTimeout(timeout);
    }
  }

  if (lastError?.name === 'AbortError' || lastError?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT') {
    throw new Error('Provider connection timeout');
  }
  throw new Error(providerErrorMessage(lastError));
}

async function saveFeedFlights(sourceName, payload, fetchedAt) {
  const flights = normalizeFlights(payload, sourceName);
  if (flights.length > MAX_FLIGHTS_PER_FEED) {
    throw new Error(`Flight feed contains more than ${MAX_FLIGHTS_PER_FEED} records.`);
  }

  const delayedFlights = flights.filter((flight) => flight.statusType === 'delay').length;
  const cancelledFlights = flights.filter((flight) => flight.statusType === 'cancelled').length;

  await transaction(async (tx) => {
    await tx.query(
      'DELETE FROM ExternalFlightSnapshot WHERE sourceName = ? AND fetchedAt < DATE_SUB(NOW(3), INTERVAL 48 HOUR)',
      [sourceName],
    );

    if (!flights.length) return;

    for (const flight of flights) {
      await tx.query(
        `INSERT INTO ExternalFlightSnapshot
          (id, sourceName, providerFlightId, routeFrom, routeTo, route, flightNumber, airline, scheduledTime, statusText, statusType, delayMinutes, cancelled, rawPayload, fetchedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `ffsnap-${randomUUID()}`,
          sourceName,
          flight.id || null,
          flight.routeFrom || null,
          flight.routeTo || null,
          flight.route || null,
          flight.flightNumber || null,
          flight.airline || null,
          flight.scheduledTime || null,
          flight.statusText || null,
          flight.statusType || 'ontime',
          flight.delayMinutes,
          flight.cancelled ? 1 : 0,
          serializable(flight.rawPayload || flight),
          fetchedAt,
        ],
      );
    }
  });

  return flights.length
    ? { totalFlights: flights.length, delayedFlights, cancelledFlights }
    : emptyFlightCounts();
}

async function syncProviderCountSnapshot() {
  const startedAt = nowDate();
  try {
    const count = await getExternalFlightsCount();
    const finishedAt = nowDate();
    await query(
      'INSERT INTO ExternalFlightCountSnapshot (id, providerCount, rawPayload, fetchedAt) VALUES (?, ?, ?, ?)',
      [`ffcnt-${randomUUID()}`, Number(count) || 0, serializable({ count }), finishedAt],
    );
    await insertRun({ sourceName: 'provider_count', status: 'success', totalFlights: Number(count) || 0, startedAt, finishedAt });
    return { ok: true, count: Number(count) || 0, lastSuccessfulSyncAt: finishedAt, lastAttemptAt: finishedAt, lastFailedSyncAt: null };
  } catch (error) {
    const finishedAt = nowDate();
    await insertRun({ sourceName: 'provider_count', status: 'error', errorMessage: error?.message || 'count_failed', startedAt, finishedAt }).catch(() => undefined);
    return { ok: false, errorMessage: error?.message || 'count_failed', lastAttemptAt: finishedAt, lastFailedSyncAt: finishedAt };
  }
}

async function getCachedSyncState() {
  const sources = PUSHED_FLIGHT_FEED_SOURCES;
  const entries = await Promise.all(sources.map(async (sourceName) => {
    const rows = await query(
      `SELECT COUNT(*) AS total, MAX(fetchedAt) AS lastSuccessfulSyncAt FROM ExternalFlightSnapshot
       WHERE sourceName = ?
         AND fetchedAt >= DATE_SUB((SELECT MAX(fetchedAt) FROM ExternalFlightSnapshot WHERE sourceName = ?), INTERVAL 2 SECOND)`,
      [sourceName, sourceName],
    );
    return [sourceName, { total: Number(rows[0]?.total || 0), lastSuccessfulSyncAt: rows[0]?.lastSuccessfulSyncAt || null }];
  }));
  const [countRows, runRows] = await Promise.all([
    query(`SELECT providerCount, fetchedAt FROM ExternalFlightCountSnapshot
     WHERE rawPayload IS NULL OR rawPayload NOT LIKE '%"error"%'
     ORDER BY fetchedAt DESC LIMIT 1`),
    query(`SELECT sourceName, status, errorMessage, startedAt, finishedAt
           FROM FlightFeedRun ORDER BY startedAt DESC LIMIT 200`),
  ]);
  const meta = {};
  for (const sourceName of [...sources, 'provider_count']) {
    const sourceRuns = runRows.filter((row) => row.sourceName === sourceName);
    const latest = sourceRuns[0];
    const failed = sourceRuns.find((row) => row.status === 'error');
    meta[sourceName] = {
      lastAttemptAt: latest?.finishedAt || latest?.startedAt || null,
      lastFailedSyncAt: failed?.finishedAt || failed?.startedAt || null,
      lastError: latest?.status === 'error' ? latest.errorMessage : null,
    };
  }
  return {
    rows: Object.fromEntries(entries.map(([sourceName, value]) => [sourceName, value.total])),
    successfulAt: Object.fromEntries(entries.map(([sourceName, value]) => [sourceName, value.lastSuccessfulSyncAt])),
    providerCount: countRows[0] ? Number(countRows[0].providerCount) : null,
    providerSuccessfulAt: countRows[0]?.fetchedAt || null,
    meta,
  };
}

export async function syncFlightFeeds({ limit = DEFAULT_LIMIT, force = false } = {}) {
  await ensureFlightCacheTables();

  return withFlightSyncLock(async () => {
    const feeds = configuredFeeds();
    const startedAt = nowDate();
    const results = {};
    const cachedState = await getCachedSyncState();
    const countPromise = syncProviderCountSnapshot();

    if (!feeds.length) {
      const countResult = await countPromise;
      await insertRun({
        sourceName: 'not_configured',
        status: 'skipped',
        errorMessage: 'No external flight feed URLs are configured.',
        startedAt,
        finishedAt: nowDate(),
      });

      return {
        ok: false,
        configured: false,
        results: {
          all_recent: { ok: false, saved: 0, error: 'Flight provider is not configured.', usedCache: cachedState.rows.all_recent > 0, cachedRows: cachedState.rows.all_recent },
          cancelled_last_24h: { ok: false, saved: 0, error: 'Flight provider is not configured.', usedCache: cachedState.rows.cancelled_last_24h > 0, cachedRows: cachedState.rows.cancelled_last_24h },
          delayed_last_24h: { ok: false, saved: 0, error: 'Flight provider is not configured.', usedCache: cachedState.rows.delayed_last_24h > 0, cachedRows: cachedState.rows.delayed_last_24h },
          provider_count: { ok: false, count: null, error: countResult.errorMessage || 'Flight provider is not configured.', usedCache: cachedState.providerCount !== null, cachedCount: cachedState.providerCount },
        },
      };
    }

    await Promise.all(feeds.slice(0, 8).map(async (feed) => {
      const sourceName = normalizeSourceName(feed.name);
      const feedStartedAt = nowDate();

      try {
        const payload = await fetchFeed(feed, limit);
        const finishedAt = nowDate();
        const counts = await saveFeedFlights(sourceName, payload, finishedAt);

        await insertRun({
          sourceName,
          status: 'success',
          ...counts,
          startedAt: feedStartedAt,
          finishedAt,
        });

        results[sourceName] = {
          ok: true, saved: counts.totalFlights, error: null, usedCache: false,
          lastSuccessfulSyncAt: finishedAt, lastAttemptAt: finishedAt, lastFailedSyncAt: cachedState.meta[sourceName]?.lastFailedSyncAt || null,
        };
      } catch (error) {
        const message = error?.name === 'AbortError'
          ? 'Flight feed request timed out.'
          : error?.message || 'Flight feed failed.';

        const finishedAt = nowDate();
        await insertRun({
          sourceName,
          status: 'error',
          errorMessage: message,
          startedAt: feedStartedAt,
          finishedAt,
        });

        const cachedRows = cachedState.rows[sourceName] || 0;
        results[sourceName] = {
          ok: false, saved: 0, error: message, usedCache: cachedRows > 0, cachedRows,
          lastSuccessfulSyncAt: cachedState.successfulAt[sourceName] || null,
          lastAttemptAt: finishedAt, lastFailedSyncAt: finishedAt,
        };
      }
    }));

    const countResult = await countPromise;
    results.provider_count = countResult.ok
      ? { ok: true, count: countResult.count, error: null, usedCache: false, lastSuccessfulSyncAt: countResult.lastSuccessfulSyncAt, lastAttemptAt: countResult.lastAttemptAt, lastFailedSyncAt: countResult.lastFailedSyncAt }
      : { ok: false, count: null, error: countResult.errorMessage || 'Count feed failed.', usedCache: cachedState.providerCount !== null, cachedCount: cachedState.providerCount, lastSuccessfulSyncAt: cachedState.providerSuccessfulAt, lastAttemptAt: countResult.lastAttemptAt, lastFailedSyncAt: countResult.lastFailedSyncAt };
    return { ok: Object.values(results).some((result) => result.ok), results };
  }, { skipIfInProgress: !force });
}

export async function importPushedFlightFeeds(payload = {}) {
  const { feeds, providerCount } = validatePushedFlightPayload(payload);
  await ensureFlightCacheTables();

  return withFlightSyncLock(async () => {
    const cachedState = await getCachedSyncState();
    const results = {};

    for (const sourceName of PUSHED_FLIGHT_FEED_SOURCES) {
      if (!Object.prototype.hasOwnProperty.call(feeds, sourceName)) {
        continue;
      }

      const feedStartedAt = nowDate();

      try {
        const finishedAt = nowDate();
        const counts = await saveFeedFlights(sourceName, feeds[sourceName], finishedAt);

        await insertRun({
          sourceName,
          status: 'success',
          ...counts,
          startedAt: feedStartedAt,
          finishedAt,
        });

        results[sourceName] = {
          ok: true,
          saved: counts.totalFlights,
          error: null,
          usedCache: false,
          lastSuccessfulSyncAt: finishedAt,
          lastAttemptAt: finishedAt,
          lastFailedSyncAt: cachedState.meta[sourceName]?.lastFailedSyncAt || null,
        };
      } catch (error) {
        const finishedAt = nowDate();
        const message = error?.message || 'Flight feed import failed.';

        await insertRun({
          sourceName,
          status: 'error',
          errorMessage: message,
          startedAt: feedStartedAt,
          finishedAt,
        }).catch(() => undefined);

        const cachedRows = cachedState.rows[sourceName] || 0;
        results[sourceName] = {
          ok: false,
          saved: 0,
          error: message,
          usedCache: cachedRows > 0,
          cachedRows,
          lastSuccessfulSyncAt: cachedState.successfulAt[sourceName] || null,
          lastAttemptAt: finishedAt,
          lastFailedSyncAt: finishedAt,
        };
      }
    }

    if (providerCount !== null) {
      const startedAt = nowDate();

      try {
        const finishedAt = nowDate();
        await query(
          'INSERT INTO ExternalFlightCountSnapshot (id, providerCount, rawPayload, fetchedAt) VALUES (?, ?, ?, ?)',
          [`ffcnt-${randomUUID()}`, providerCount, serializable({ count: providerCount }), finishedAt],
        );
        await insertRun({
          sourceName: 'provider_count',
          status: 'success',
          totalFlights: providerCount,
          startedAt,
          finishedAt,
        });
        results.provider_count = {
          ok: true,
          count: providerCount,
          error: null,
          usedCache: false,
          lastSuccessfulSyncAt: finishedAt,
          lastAttemptAt: finishedAt,
          lastFailedSyncAt: cachedState.meta.provider_count?.lastFailedSyncAt || null,
        };
      } catch (error) {
        const finishedAt = nowDate();
        const message = error?.message || 'Provider count import failed.';

        await insertRun({
          sourceName: 'provider_count',
          status: 'error',
          errorMessage: message,
          startedAt,
          finishedAt,
        }).catch(() => undefined);

        results.provider_count = {
          ok: false,
          count: null,
          error: message,
          usedCache: cachedState.providerCount !== null,
          cachedCount: cachedState.providerCount,
          lastSuccessfulSyncAt: cachedState.providerSuccessfulAt,
          lastAttemptAt: finishedAt,
          lastFailedSyncAt: finishedAt,
        };
      }
    }

    return {
      ok: Object.values(results).some((result) => result.ok),
      mode: 'push_https_async',
      results,
    };
  });
}

export async function getFlightPushStatus() {
  await ensureFlightCacheTables();
  const state = await getCachedSyncState();

  return {
    ok: true,
    mode: 'push_https_async',
    importConfigured: Boolean(
      env.flightImportSecret &&
      env.flightImportSecret.length >= FLIGHT_IMPORT_SECRET_MIN_LENGTH
    ),
    schedulerEnabled: asBool(process.env.FLIGHT_CACHE_ENABLED, true),
    syncInProgress,
    feeds: Object.fromEntries(PUSHED_FLIGHT_FEED_SOURCES.map((sourceName) => [
      sourceName,
      {
        rows: state.rows[sourceName] || 0,
        lastSuccessfulSyncAt: state.successfulAt[sourceName] || null,
        ...state.meta[sourceName],
      },
    ])),
    providerCount: {
      count: state.providerCount,
      lastSuccessfulSyncAt: state.providerSuccessfulAt,
      ...state.meta.provider_count,
    },
  };
}

export async function getCachedFlightStatuses(limit = 100) {
  await ensureFlightCacheTables();

  const parsedLimit = parseInteger(limit, 100, 1, 1000);

  const latestRows = await query(
    `SELECT MAX(fetchedAt) AS latestFetchedAt
     FROM ExternalFlightSnapshot
     WHERE sourceName = 'all_recent'`
  );
  const latestFetchedAt = latestRows[0]?.latestFetchedAt;

  if (!latestFetchedAt) {
    return [];
  }

  const rows = await query(
    `SELECT *
     FROM ExternalFlightSnapshot
     WHERE sourceName = 'all_recent'
       AND fetchedAt >= DATE_SUB(?, INTERVAL 2 SECOND)
     ORDER BY scheduledTime ASC, flightNumber ASC
     LIMIT ?`,
    [latestFetchedAt, parsedLimit],
  );

  return rows.map((row) => ({
    id: row.id,
    sourceName: row.sourceName,
    routeFrom: row.routeFrom || '',
    routeTo: row.routeTo || '',
    route: row.route || '',
    flightNumber: row.flightNumber || '',
    airline: row.airline || '',
    scheduledTime: row.scheduledTime || '',
    statusText: row.statusText || '',
    statusType: row.statusType || 'ontime',
    delayMinutes: row.delayMinutes == null ? null : Number(row.delayMinutes),
    cancelled: Boolean(row.cancelled),
    fetchedAt: row.fetchedAt,
  }));
}

export async function getFlightCacheSummary() {
  await ensureFlightCacheTables();

  const [latestRows, statusRows, sourceRows, recentRows, runRows, countRows] = await Promise.all([
    query('SELECT COUNT(*) AS total, MAX(fetchedAt) AS latestFetchedAt FROM ExternalFlightSnapshot'),
    query('SELECT statusType, COUNT(*) AS total FROM ExternalFlightSnapshot WHERE fetchedAt >= DATE_SUB(NOW(3), INTERVAL 12 HOUR) GROUP BY statusType'),
    query('SELECT sourceName, COUNT(*) AS total, MAX(fetchedAt) AS latestFetchedAt FROM ExternalFlightSnapshot GROUP BY sourceName ORDER BY latestFetchedAt DESC'),
    query('SELECT * FROM ExternalFlightSnapshot ORDER BY fetchedAt DESC, scheduledTime ASC LIMIT 80'),
    query('SELECT * FROM FlightFeedRun ORDER BY startedAt DESC LIMIT 200'),
    query(`SELECT * FROM ExternalFlightCountSnapshot
           WHERE rawPayload IS NULL OR rawPayload NOT LIKE '%"error"%'
           ORDER BY fetchedAt DESC LIMIT 20`),
  ]);

  const byStatus = Object.fromEntries(
    statusRows.map((row) => [row.statusType || 'unknown', Number(row.total) || 0]),
  );

  const feedConfig = [
    ['allRecent', 'all_recent'],
    ['cancelledLast24h', 'cancelled_last_24h'],
    ['delayedLast24h', 'delayed_last_24h'],
  ];
  const feedSnapshots = Object.fromEntries(await Promise.all(feedConfig.map(async ([, sourceName]) => {
    const latest = await query(
      'SELECT MAX(fetchedAt) AS latestFetchedAt FROM ExternalFlightSnapshot WHERE sourceName = ?',
      [sourceName],
    );
    const latestFetchedAt = latest[0]?.latestFetchedAt || null;
    if (!latestFetchedAt) return [sourceName, { total: 0, latestFetchedAt: null, rows: [] }];

    const [countResult, rows] = await Promise.all([
      query(
        'SELECT COUNT(*) AS total FROM ExternalFlightSnapshot WHERE sourceName = ? AND fetchedAt >= DATE_SUB(?, INTERVAL 2 SECOND)',
        [sourceName, latestFetchedAt],
      ),
      query(
        'SELECT * FROM ExternalFlightSnapshot WHERE sourceName = ? AND fetchedAt >= DATE_SUB(?, INTERVAL 2 SECOND) ORDER BY scheduledTime ASC, flightNumber ASC LIMIT 12',
        [sourceName, latestFetchedAt],
      ),
    ]);
    return [sourceName, { total: Number(countResult[0]?.total || 0), latestFetchedAt, rows }];
  })));
  const flightCache = {};

  for (const [responseKey, sourceName] of feedConfig) {
    const snapshot = feedSnapshots[sourceName];
    const sourceRuns = runRows.filter((row) => row.sourceName === sourceName);
    const latestRun = sourceRuns[0];
    const latestFailedRun = sourceRuns.find((row) => row.status === 'error');
    const lastAttemptAt = latestRun?.finishedAt || latestRun?.startedAt || null;
    const lastFailedSyncAt = latestFailedRun?.finishedAt || latestFailedRun?.startedAt || null;
    const latestAttemptFailed = latestRun?.status === 'error';
    flightCache[responseKey] = {
      total: snapshot.total,
      lastFetchedAt: snapshot.latestFetchedAt || null,
      lastSuccessfulSyncAt: snapshot.latestFetchedAt || null,
      lastAttemptAt,
      lastFailedSyncAt,
      lastError: latestAttemptFailed ? latestRun.errorMessage : null,
      hasCachedData: snapshot.total > 0,
      isStaleFromFailedRefresh: snapshot.total > 0 && latestAttemptFailed,
      latestAttemptFailed,
      error: latestAttemptFailed ? latestRun.errorMessage : null,
      chartData: runRows.filter((row) => row.sourceName === sourceName).slice(0, 10).reverse().map((row) => ({
        at: row.finishedAt || row.startedAt,
        total: Number(row.totalFlights) || 0,
      })),
      rows: snapshot.rows.map((row) => ({
        id: row.id, routeFrom: row.routeFrom || '', routeTo: row.routeTo || '', route: row.route || '',
        flightNumber: row.flightNumber || '', airline: row.airline || '',
        scheduledTime: row.scheduledTime || '', statusText: row.statusText || '',
        statusType: row.statusType || 'ontime',
        delayMinutes: row.delayMinutes == null ? null : Number(row.delayMinutes),
        cancelled: Boolean(row.cancelled), fetchedAt: row.fetchedAt,
      })),
    };
  }

  const providerRuns = runRows.filter((row) => row.sourceName === 'provider_count');
  const latestProviderRun = providerRuns[0];
  const latestFailedProviderRun = providerRuns.find((row) => row.status === 'error');
  const providerAttemptFailed = latestProviderRun?.status === 'error';
  flightCache.providerCount = {
    current: countRows[0] ? Number(countRows[0].providerCount) : null,
    lastFetchedAt: countRows[0]?.fetchedAt || null,
    lastSuccessfulSyncAt: countRows[0]?.fetchedAt || null,
    lastAttemptAt: latestProviderRun?.finishedAt || latestProviderRun?.startedAt || null,
    lastFailedSyncAt: latestFailedProviderRun?.finishedAt || latestFailedProviderRun?.startedAt || null,
    lastError: providerAttemptFailed ? latestProviderRun.errorMessage : null,
    hasCachedData: Boolean(countRows[0]),
    isStaleFromFailedRefresh: Boolean(countRows[0]) && providerAttemptFailed,
    latestAttemptFailed: providerAttemptFailed,
    error: providerAttemptFailed ? latestProviderRun.errorMessage : null,
    history: countRows.map((row) => ({ count: Number(row.providerCount) || 0, fetchedAt: row.fetchedAt || null })),
  };

  return {
    ...flightCache,
    totalSnapshots: Number(latestRows[0]?.total || 0),
    latestFetchedAt: latestRows[0]?.latestFetchedAt || null,
    byStatus,
    countHistory: countRows.map((row) => ({
      id: row.id,
      count: Number(row.providerCount) || 0,
      fetchedAt: row.fetchedAt || null,
    })),
    sources: sourceRows.map((row) => ({
      sourceName: row.sourceName,
      total: Number(row.total) || 0,
      latestFetchedAt: row.latestFetchedAt || null,
    })),
    recentFlights: recentRows.map((row) => ({
      id: row.id,
      sourceName: row.sourceName,
      routeFrom: row.routeFrom || '',
      routeTo: row.routeTo || '',
      flightNumber: row.flightNumber || '',
      airline: row.airline || '',
      scheduledTime: row.scheduledTime || '',
      statusText: row.statusText || '',
      statusType: row.statusType || 'ontime',
      fetchedAt: row.fetchedAt,
    })),
    runs: runRows.map((row) => ({
      id: row.id,
      sourceName: row.sourceName,
      status: row.status,
      totalFlights: Number(row.totalFlights) || 0,
      delayedFlights: Number(row.delayedFlights) || 0,
      cancelledFlights: Number(row.cancelledFlights) || 0,
      errorMessage: row.errorMessage || null,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
    })),
  };
}

export function startFlightCacheScheduler() {
  if (schedulerStarted) {
    return;
  }

  schedulerStarted = true;

  if (!asBool(process.env.FLIGHT_CACHE_ENABLED, true)) {
    console.log('[flight-cache] scheduler disabled by FLIGHT_CACHE_ENABLED=false');
    return;
  }

  const intervalMs = parseInteger(
    process.env.FLIGHT_CACHE_INTERVAL_MS,
    env.flightCacheIntervalMs || DEFAULT_SYNC_INTERVAL_MS,
    60_000,
    24 * 60 * 60 * 1000,
  );

  const run = () => {
    syncFlightFeeds({ limit: env.externalFlightsLimit })
      .then((result) => {
        if (result?.skipped) return;
        console.log('[flight-cache] sync completed');
      })
      .catch((error) => {
        console.warn(`[flight-cache] sync failed: ${error.message}`);
      });
  };

  setTimeout(run, 1500).unref?.();
  syncTimer = setInterval(run, intervalMs);
  syncTimer.unref?.();
}

export function stopFlightCacheScheduler() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}
