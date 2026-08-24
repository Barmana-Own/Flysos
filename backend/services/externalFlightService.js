import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const CACHE_TTL_MS = 60 * 1000;
const PROVIDER_TIMEOUT_MS = 45_000;
const PROVIDER_RETRIES = 2;
const requestCache = new Map();

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function requireProviderConfig() {
  if (
    !env.externalFlightsBaseUrl ||
    !env.externalFlightsUsername ||
    !env.externalFlightsPassword
  ) {
    throw new AppError(
      'Flight provider configuration is incomplete.',
      503,
      'FLIGHT_PROVIDER_NOT_CONFIGURED'
    );
  }
}

export function parseFlightLimit(value) {
  const rawValue = value ?? env.externalFlightsLimit;
  const limit = Number(rawValue);

  if (!Number.isInteger(limit) || limit < 1 || limit > 10000) {
    throw new AppError(
      'limit must be an integer between 1 and 10000.',
      400,
      'INVALID_LIMIT'
    );
  }

  return limit;
}

function createProviderUrl(pathSuffix = '', limit) {
  const url = new URL(env.externalFlightsBaseUrl);

  const basePath = url.pathname.replace(/\/+$/, '');
  url.pathname = pathSuffix ? `${basePath}${pathSuffix}` : basePath;

  url.search = '';
  url.hash = '';

  url.searchParams.set('username', env.externalFlightsUsername);
  url.searchParams.set('password', env.externalFlightsPassword);

  if (typeof limit === 'number') {
    url.searchParams.set('limit', String(limit));
  }

  return url;
}

function safeProviderUrl(url) {
  const masked = new URL(url);
  masked.searchParams.set('password', '***');
  return masked.toString();
}

function providerErrorMessage(error) {
  if (error?.name === 'AbortError') return 'Flight provider request timed out.';
  if (error?.cause?.code) return `${error?.message || 'Flight provider request failed.'} (${error.cause.code})`;
  return error?.message || 'Flight provider request failed.';
}

async function requestProvider(pathSuffix, cacheKey, limit) {
  requireProviderConfig();

  const cached = requestCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const url = createProviderUrl(pathSuffix, limit);
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
      requestCache.set(cacheKey, { value: payload, expiresAt: Date.now() + CACHE_TTL_MS });
      return payload;
    } catch (error) {
      lastError = error;
      console.warn('[flight-provider] request failed', {
        feed: cacheKey, attempt: attempt + 1, url: safeProviderUrl(url),
        status: error?.httpStatus || null, error: providerErrorMessage(error),
      });
      if (attempt < PROVIDER_RETRIES) await wait(750 * (attempt + 1));
    } finally {
      clearTimeout(timeout);
    }
  }

  if (lastError?.name === 'AbortError' || lastError?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT') {
    throw new AppError('Provider connection timeout', 504, 'FLIGHT_PROVIDER_TIMEOUT');
  }
  throw new AppError(providerErrorMessage(lastError), 502, 'FLIGHT_PROVIDER_ERROR');
}

function findFlightsArray(value, depth = 0) {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value || typeof value !== 'object' || depth > 3) {
    return [];
  }

  for (const key of ['data', 'flights', 'items', 'results', 'records', 'result']) {
    if (key in value) {
      const found = findFlightsArray(value[key], depth + 1);

      if (found.length) {
        return found;
      }
    }
  }

  return [];
}

function pickValue(object, keys) {
  for (const key of keys) {
    const value = object?.[key];

    if (
      value !== undefined &&
      value !== null &&
      typeof value !== 'object' &&
      String(value).trim()
    ) {
      return String(value).trim();
    }
  }

  return '';
}

function getStatusType(record, statusText) {
  const rawStatus = [
    statusText,
    pickValue(record, [
      'status',
      'flightStatus',
      'flight_status',
      'state',
      'status_type',
    ]),
  ]
    .join(' ')
    .toLowerCase();

  const delayMinutes = Number(
    pickValue(record, ['delay_minutes', 'delayMinutes', 'delay'])
  );

  const isCancelled = ['true', '1', 'yes'].includes(
    pickValue(record, ['cancelled', 'canceled', 'isCancelled', 'is_canceled', 'is_cancelled'])
      .toLowerCase()
  );

  if (
    isCancelled ||
    /cancel|cancell|باطل|لغو/.test(rawStatus)
  ) {
    return 'cancelled';
  }

  if (
    delayMinutes > 0 ||
    /delay|delayed|تاخیر/.test(rawStatus)
  ) {
    return 'delay';
  }

  return 'ontime';
}

function normalizeFlight(record, index, sourceName = '') {
  const airportName = pickValue(record, [
    'airport_name',
    'airportName',
    'airport',
  ]);

  const flightType = pickValue(record, [
    'flight_type',
    'flightType',
    'type',
  ]);

  const normalizedFlightType = flightType.toLowerCase();

  const isDeparture = /خروج|departure|outbound/.test(
    normalizedFlightType
  );

  const isArrival = /ورود|arrival|inbound/.test(
    normalizedFlightType
  );

  const explicitRoute = pickValue(record, [
    'route',
    'path',
    'routeTitle',
    'route_title',
    'flightRoute',
    'flight_route',
  ]);

  const routeParts = explicitRoute
    .split(/\s*(?:→|←|->|<-|–|—| - |\/|\|| تا )\s*/u)
    .map((part) => part.trim())
    .filter(Boolean);

  const explicitRouteFrom = pickValue(record, [
    'routeFrom',
    'route_from',
    'origin',
    'originName',
    'origin_name',
    'originCity',
    'origin_city',
    'from',
    'departure',
    'departureAirport',
    'departure_airport',
    'departureCity',
    'departure_city',
    'source',
  ]);

  const explicitRouteTo = pickValue(record, [
    'routeTo',
    'route_to',
    'destination',
    'destinationName',
    'destination_name',
    'destinationCity',
    'destination_city',
    'to',
    'arrival',
    'arrivalAirport',
    'arrival_airport',
    'arrivalCity',
    'arrival_city',
  ]);

  const routeFrom =
    explicitRouteFrom || routeParts[0] || (isDeparture ? airportName : '');

  const routeTo =
    explicitRouteTo || routeParts[1] || (isArrival ? airportName : '');

  const flightNumber = pickValue(record, [
    'flightNumber',
    'flight_number',
    'flightNo',
    'flight_no',
    'number',
    'flight',
    'flight_id',
  ]);

  const airline = pickValue(record, [
    'airline',
    'airlineName',
    'airline_name',
    'company',
    'companyName',
    'carrier',
    'carrierName',
    'airline_fa',
    'airline_title',
  ]);

  const flightDay = pickValue(record, [
    'flight_day',
    'flightDay',
    'flight_date',
    'flightDate',
    'date',
  ]);

  const scheduledClock = pickValue(record, [
    'scheduledTime',
    'scheduled_time',
    'scheduleTime',
    'schedule_time',
    'departureTime',
    'departure_time',
    'flightTime',
    'scheduled',
    'dateTime',
    'time',
  ]);

  const scheduledTime = [flightDay, scheduledClock]
    .filter(Boolean)
    .join(' ');

  const rawStatusText = pickValue(record, [
    'statusText',
    'status_text',
    'status',
    'flightStatus',
    'flight_status',
    'state',
    'status_title',
    'description',
  ]);

  const statusType = sourceName === 'cancelled_last_24h'
    ? 'cancelled'
    : sourceName === 'delayed_last_24h'
      ? 'delay'
      : getStatusType(record, rawStatusText);
  const parsedDelayMinutes = Number(
    pickValue(record, ['delay_minutes', 'delayMinutes', 'delay'])
  );

  const fallbackStatusText = {
    cancelled: 'Cancelled',
    delay: 'Delayed',
    ontime: 'On time',
  };

  const providerId = pickValue(record, [
    'id',
    '_id',
    'flightId',
    'flight_id',
    'uuid',
    'flight_key',
  ]);

  return {
    id:
      providerId ||
      `${flightNumber || 'flight'}-${scheduledTime || index}-${routeFrom}-${routeTo}`,
    routeFrom,
    routeTo,
    route: explicitRoute || [routeFrom, routeTo].filter(Boolean).join(' - '),
    flightNumber,
    airline,
    scheduledTime,
    statusText: rawStatusText || fallbackStatusText[statusType],
    statusType,
    delayMinutes: Number.isFinite(parsedDelayMinutes) && parsedDelayMinutes >= 0
      ? parsedDelayMinutes
      : null,
    cancelled: statusType === 'cancelled',
    rawPayload: record,
  };
}
export function normalizeFlights(payload, sourceName = '') {
  return findFlightsArray(payload)
    .filter((item) => item && typeof item === 'object')
    .map((item, index) => normalizeFlight(item, index, sourceName));
}

function extractCount(payload) {
  if (typeof payload === 'number' && Number.isFinite(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== 'object') {
    throw new AppError(
      'Flight provider returned an invalid count response.',
      502,
      'INVALID_PROVIDER_RESPONSE'
    );
  }

  const candidates = [
    payload.count,
    payload.total,
    payload.totalCount,
    payload.data?.count,
    payload.data?.total,
    payload.data?.totalCount,
  ];

  for (const candidate of candidates) {
    const number = Number(candidate);

    if (Number.isFinite(number)) {
      return number;
    }
  }

  throw new AppError(
    'Flight provider returned an invalid count response.',
    502,
    'INVALID_PROVIDER_RESPONSE'
  );
}

export async function getExternalFlights(limit) {
  const payload = await requestProvider('', `all:${limit}`, limit);
  return normalizeFlights(payload);
}

export async function getCancelledFlightsLast24h(limit) {
  const payload = await requestProvider(
    '/cancelled-last-24h',
    `cancelled:${limit}`,
    limit
  );

  return normalizeFlights(payload);
}

export async function getDelayedFlightsLast24h(limit) {
  const payload = await requestProvider(
    '/delayed-last-24h',
    `delayed:${limit}`,
    limit
  );

  return normalizeFlights(payload);
}

export async function getExternalFlightsCount() {
  const payload = await requestProvider('/count', 'count');
  return extractCount(payload);
}
