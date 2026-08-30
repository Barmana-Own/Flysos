import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();
dotenv.config({
  path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env.sms'),
  override: true,
});

function readPort(value, fallback = 5050) {
  const port = Number(value ?? fallback);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid number between 1 and 65535.');
  }

  return port;
}

function readPositiveInteger(value, fallback, maximum = 10000) {
  const parsed = Number(value ?? fallback);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, maximum);
}

function optionalEnv(name) {
  const value = process.env[name];

  return typeof value === 'string' && value.trim()
    ? value.trim()
    : null;
}

export const FLIGHT_IMPORT_SECRET_MIN_LENGTH = 32;

function requiredEnv(name, fallback = null) {
  const value = optionalEnv(name);

  if (value) {
    return value;
  }

  if (fallback !== null) {
    return fallback;
  }

  throw new Error(`${name} is required.`);
}

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: readPort(process.env.PORT),
  corsOrigin: process.env.CORS_ORIGIN?.trim() || 'http://localhost:5036',

  dbHost: requiredEnv('DB_HOST', 'localhost'),
  dbPort: readPort(process.env.DB_PORT, 3306),
  dbName: requiredEnv('DB_NAME'),
  dbUser: requiredEnv('DB_USER'),
  dbPassword: process.env.DB_PASSWORD ?? '',

  jwtSecret: optionalEnv('JWT_SECRET'),
  flightImportSecret: optionalEnv('FLIGHT_IMPORT_SECRET'),
  uploadDir: process.env.UPLOAD_DIR?.trim() || 'uploads',

  smsApiBaseUrl: process.env.SMS_API_BASE_URL?.trim() || 'https://smsapi.pishgamrayan.com',
  smsApiToken: optionalEnv('SMS_API_TOKEN'),
  smsSenderNumber: optionalEnv('SMS_SENDER_NUMBER'),
  smsTimeoutMs: readPositiveInteger(process.env.SMS_TIMEOUT_MS, 10000, 60000),

  externalFlightsBaseUrl:
    optionalEnv('EXTERNAL_FLIGHTS_BASE_URL') ||
    optionalEnv('EXTERNAL_FLIGHTS_RELAY_URL'),
  externalFlightsUsername: optionalEnv('EXTERNAL_FLIGHTS_USERNAME'),
  externalFlightsPassword: optionalEnv('EXTERNAL_FLIGHTS_PASSWORD'),
  externalFlightsLimit: readPositiveInteger(
    process.env.EXTERNAL_FLIGHTS_LIMIT,
    500
  ),
  flightCacheIntervalMs: readPositiveInteger(
    process.env.FLIGHT_CACHE_INTERVAL_MS,
    600000,
    24 * 60 * 60 * 1000
  ),
});
