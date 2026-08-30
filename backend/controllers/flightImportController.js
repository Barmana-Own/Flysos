import { timingSafeEqual } from 'node:crypto';

import { env, FLIGHT_IMPORT_SECRET_MIN_LENGTH } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import {
  getFlightPushStatus,
  importPushedFlightFeeds,
  validatePushedFlightPayload,
} from '../services/flightCacheService.js';

function isImportSecretConfigured() {
  return Boolean(
    env.flightImportSecret &&
    env.flightImportSecret.length >= FLIGHT_IMPORT_SECRET_MIN_LENGTH
  );
}

function secretsMatch(supplied, expected) {
  const suppliedBuffer = Buffer.from(supplied, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');

  return suppliedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(suppliedBuffer, expectedBuffer);
}

function requireImportSecret(req) {
  if (!isImportSecretConfigured()) {
    throw new AppError('FLIGHT_IMPORT_SECRET is not configured.', 503, 'FLIGHT_IMPORT_NOT_CONFIGURED');
  }

  const headerValue = req.headers['x-flysos-import-key'];
  const supplied = typeof headerValue === 'string' ? headerValue.trim() : '';
  if (!supplied || !secretsMatch(supplied, env.flightImportSecret)) {
    throw new AppError('Invalid flight import key.', 401, 'INVALID_FLIGHT_IMPORT_KEY');
  }
}

export async function importFlightFeeds(req, res) {
  requireImportSecret(req);

  let validatedPayload;
  try {
    validatedPayload = validatePushedFlightPayload(req.body);
  } catch (error) {
    if (error?.code === 'INVALID_FLIGHT_IMPORT_PAYLOAD') {
      throw new AppError('Invalid flight import payload.', 400, 'INVALID_FLIGHT_IMPORT_PAYLOAD');
    }

    throw error;
  }

  const { feeds, providerCount } = validatedPayload;

  // Shared-host proxies may terminate a long-running import with HTTP 504 even
  // though the Node process is still working. Acknowledge the authenticated
  // payload immediately, then perform the database import in the background.
  const payload = {
    feeds,
    providerCount,
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
