import { Router } from 'express';

import { health } from '../controllers/healthController.js';
import { publicFlightStatuses } from '../controllers/flightController.js';

import {
  saveQuestionnaire,
  startClaim,
  submitClaim,
  trackClaim,
  uploadClaimFiles,
} from '../controllers/claimController.js';

import {
  addPublicSupportMessage,
  createPublicSupportTicket,
  getPublicSupportTicket,
} from '../controllers/supportController.js';

import { upload } from '../middleware/upload.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getPublishedCmsPage, getPublishedCmsGlobalLayouts } from '../controllers/cmsController.js';
import { getPublicLegalDocuments } from '../controllers/platformController.js';

export const publicRoutes = Router();

publicRoutes.get('/health', asyncHandler(health));
publicRoutes.get('/pages/:slug', asyncHandler(getPublishedCmsPage));
publicRoutes.get('/globals', asyncHandler(getPublishedCmsGlobalLayouts));
publicRoutes.get('/legal-documents', asyncHandler(getPublicLegalDocuments));

publicRoutes.get(
  '/flights/status',
  asyncHandler(publicFlightStatuses)
);

publicRoutes.post(
  '/claims/start',
  asyncHandler(startClaim)
);

publicRoutes.post(
  '/claims/:id/files',
  upload.array('files', 4),
  asyncHandler(uploadClaimFiles)
);

publicRoutes.post(
  '/claims/:id/questionnaire',
  asyncHandler(saveQuestionnaire)
);

publicRoutes.post(
  '/claims/:id/submit',
  asyncHandler(submitClaim)
);

publicRoutes.get(
  '/claims/track',
  asyncHandler(trackClaim)
);

publicRoutes.post(
  '/support/tickets',
  asyncHandler(createPublicSupportTicket)
);

publicRoutes.get(
  '/support/tickets/:id',
  asyncHandler(getPublicSupportTicket)
);

publicRoutes.post(
  '/support/tickets/:id/messages',
  asyncHandler(addPublicSupportMessage)
);
