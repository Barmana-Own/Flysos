import { adminRoutes } from './routes/adminRoutes.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { env } from './config/env.js';
import { startFlightCacheScheduler } from './services/flightCacheService.js';
import { publicRoutes } from './routes/publicRoutes.js';
import { serveLegacyCmsMedia } from './controllers/cmsController.js';
import { cmsUploadDirectory } from './middleware/upload.js';
import { asyncHandler } from './utils/asyncHandler.js';
import {
  errorHandler,
  notFoundHandler,
} from './middleware/errorHandler.js';

export const app = express();

// Production traffic reaches Express through the CDN and cPanel Passenger.
// Trust those two proxy hops so rate limiting uses the visitor IP instead of
// rejecting the X-Forwarded-For header supplied by the hosting stack.
app.set('trust proxy', 2);

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin',
    },
  })
);

app.use(
  cors({
    origin: env.corsOrigin === '*' ? true : env.corsOrigin,
  })
);

app.use('/api', (_req, res, next) => {
  res.set({
    'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
    'CDN-Cache-Control': 'no-store',
    'Surrogate-Control': 'no-store',
    Pragma: 'no-cache',
    Expires: '0',
  });
  next();
});

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 200,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Provider pushes contain three feed responses and can be larger than the
// ordinary API payload. Keep the larger bound limited to this authenticated
// secret-backed route; all other JSON APIs remain capped at 1 MB.
app.use('/api/flights/import', express.json({ limit: '5mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/uploads/cms', express.static(cmsUploadDirectory, { index: false, redirect: false }));
app.use('/api/uploads/cms', express.static(cmsUploadDirectory, { index: false, redirect: false }));
app.get('/uploads/:filename', asyncHandler(serveLegacyCmsMedia));
app.get('/api/uploads/:filename', asyncHandler(serveLegacyCmsMedia));

app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

// Start the ten-minute flight-cache scheduler from the app module as well as
// the normal index entrypoint.  cPanel/Passenger installations sometimes
// load app.js from a small wrapper; the scheduler has an internal one-shot
// guard, so this remains safe when index.js starts it too.
startFlightCacheScheduler();
