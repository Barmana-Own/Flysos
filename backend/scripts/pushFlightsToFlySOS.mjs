/**
 * Run this file on the flight-data server (the server that can access localhost:3000).
 * It pushes data to FlySOS through HTTPS/443, so cPanel does not need outbound access to port 3000.
 */
const sourceBase = (process.env.SOURCE_FLIGHTS_BASE_URL || 'http://127.0.0.1:3000/api/flights').replace(/\/+$/, '');
const username = process.env.SOURCE_FLIGHTS_USERNAME;
const password = process.env.SOURCE_FLIGHTS_PASSWORD;
const target = process.env.FLYSOS_IMPORT_URL || 'https://flysos.ir/api/flights/import';
const secret = process.env.FLIGHT_IMPORT_SECRET;
const limit = Number(process.env.SOURCE_FLIGHTS_LIMIT || 500);

if (!username || !password || !secret) {
  console.error('SOURCE_FLIGHTS_USERNAME, SOURCE_FLIGHTS_PASSWORD and FLIGHT_IMPORT_SECRET are required.');
  process.exit(1);
}

async function getJson(path, includeLimit = true) {
  const url = new URL(`${sourceBase}${path}`);
  url.searchParams.set('username', username);
  url.searchParams.set('password', password);
  if (includeLimit) url.searchParams.set('limit', String(limit));
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
  const text = await response.text();
  if (!response.ok) throw new Error(`${url.pathname}: HTTP ${response.status} ${text.slice(0, 160)}`);
  try { return JSON.parse(text.replace(/^\uFEFF/, '').trim()); }
  catch { throw new Error(`${url.pathname}: response is not JSON`); }
}

const [allRecent, cancelled, delayed, countPayload] = await Promise.all([
  getJson(''),
  getJson('/cancelled-last-24h'),
  getJson('/delayed-last-24h'),
  getJson('/count', false),
]);

const providerCount = Number(
  typeof countPayload === 'number' ? countPayload
    : countPayload?.count ?? countPayload?.total ?? countPayload?.data?.count ?? countPayload?.data?.total
);

const response = await fetch(target, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-FlySOS-Import-Key': secret,
  },
  body: JSON.stringify({
    feeds: {
      all_recent: allRecent,
      cancelled_last_24h: cancelled,
      delayed_last_24h: delayed,
    },
    providerCount: Number.isFinite(providerCount) ? providerCount : null,
  }),
  signal: AbortSignal.timeout(120000),
});

const resultText = await response.text();
if (!response.ok) {
  console.error(`FlySOS import failed: HTTP ${response.status} ${resultText}`);
  process.exit(1);
}
console.log(`[${new Date().toISOString()}] FlySOS import successful: ${resultText}`);
