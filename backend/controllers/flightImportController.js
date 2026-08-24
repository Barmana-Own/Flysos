import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { importPushedFlightFeeds, getFlightPushStatus } from '../services/flightCacheService.js';

function requireImportSecret(req) {
  if (!env.flightImportSecret) {
    throw new AppError('FLIGHT_IMPORT_SECRET is not configured.', 503, 'FLIGHT_IMPORT_NOT_CONFIGURED');
  }
  const supplied = String(req.headers['x-flysos-import-key'] || '').trim();
  if (!supplied || supplied !== env.flightImportSecret) {
    throw new AppError('Invalid flight import key.', 401, 'INVALID_FLIGHT_IMPORT_KEY');
  }
}

export async function importFlightFeeds(req, res) {
  requireImportSecret(req);
  const feeds = req.body?.feeds;
  if (!feeds || typeof feeds !== 'object' || Array.isArray(feeds)) {
    throw new AppError('feeds object is required.', 400, 'INVALID_FLIGHT_IMPORT_PAYLOAD');
  }

  // Shared-host proxies may terminate a long-running import with HTTP 504 even
  // though the Node process is still working. Acknowledge the authenticated
  // payload immediately, then perform the database import in the background.
  const payload = {
    feeds,
    providerCount: req.body?.providerCount ?? null,
  };
  const acceptedAt = new Date().toISOString();

  res.status(202).json({
    ok: true,
    accepted: true,
    mode: 'push_https_async',
    acceptedAt,
    message: 'Flight import accepted and is processing in the background.',
  });

  setImmediate(() => {
    importPushedFlightFeeds(payload)
      .then((result) => {
        console.log('[flight-import] background import completed', result);
      })
      .catch((error) => {
        console.error('[flight-import] background import failed', {
          message: error?.message || String(error),
          stack: error?.stack || null,
        });
      });
  });
}

export async function adminFlightPushStatus(_req, res) {
  res.json(await getFlightPushStatus());
}
