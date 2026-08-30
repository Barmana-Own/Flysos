import { Router } from 'express';

import {
  addClaimNote,
  adminCancelledFlightsLast24h,
  adminDelayedFlightsLast24h,
  adminExternalFlights,
  adminExternalFlightsCount,
  adminFlightCacheSummary,
  adminLogin,
  adminSyncFlightCache,
  downloadClaimFile,
  getClaim,
  listClaims,
  replaceClaimFile,
  updateClaim,
  updateClaimStatus,
} from '../controllers/adminController.js';

import { adminFlightPushStatus } from '../controllers/flightImportController.js';

import {
  createExpert,
  dashboard,
  deleteExpert,
  getSettings,
  listExperts,
  listNotifications,
  listUsers,
  markNotificationRead,
  updateExpert,
  updateSettings,
  updateUser,
  sendUserSms,
} from '../controllers/platformController.js';

import {
  addAdminSupportMessage,
  getAdminSupportTicket,
  listAdminSupportTickets,
  updateAdminSupportTicketStatus,
} from '../controllers/supportController.js';

import {
  requireAdminAuth,
  requireClaimEditor,
  requireCmsEditor,
  requirePassengerManager,
  requireSupervisor,
} from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { cmsUpload, upload } from '../middleware/upload.js';
import {
  createCmsPage,
  deleteCmsMedia,
  deleteCmsPage,
  duplicateCmsPage,
  getCmsPage,
  listCmsMedia,
  listCmsPages,
  listCmsPageVersions,
  publishCmsPage,
  restoreCmsPageVersion,
  updateCmsMedia,
  updateCmsPage,
  uploadCmsMedia,
  unpublishCmsPage,
  listCmsGlobalLayouts,
  getCmsGlobalLayout,
  updateCmsGlobalLayout,
  publishCmsGlobalLayout,
} from '../controllers/cmsController.js';

export const adminRoutes = Router();

adminRoutes.post('/login', asyncHandler(adminLogin));

adminRoutes.use(requireAdminAuth);

adminRoutes.get('/dashboard', asyncHandler(dashboard));

adminRoutes.get('/users', requirePassengerManager, asyncHandler(listUsers));
adminRoutes.patch('/users/:id', requirePassengerManager, asyncHandler(updateUser));
adminRoutes.post('/users/:id/sms', requirePassengerManager, asyncHandler(sendUserSms));

adminRoutes.get('/experts', requireSupervisor, asyncHandler(listExperts));
adminRoutes.post('/experts', requireSupervisor, asyncHandler(createExpert));
adminRoutes.patch('/experts/:id', requireSupervisor, asyncHandler(updateExpert));
adminRoutes.delete('/experts/:id', requireSupervisor, asyncHandler(deleteExpert));

adminRoutes.get('/notifications', asyncHandler(listNotifications));

adminRoutes.patch(
  '/notifications/:id/read',
  asyncHandler(markNotificationRead)
);

adminRoutes.get('/settings', requireSupervisor, asyncHandler(getSettings));

adminRoutes.patch(
  '/settings',
  requireSupervisor,
  asyncHandler(updateSettings)
);

adminRoutes.get('/files/:fileId/download', asyncHandler(downloadClaimFile));

adminRoutes.get('/claims', asyncHandler(listClaims));
adminRoutes.get('/claims/:id', asyncHandler(getClaim));

adminRoutes.patch('/claims/:id', requireClaimEditor, asyncHandler(updateClaim));

adminRoutes.post(
  '/claims/:id/files',
  requirePassengerManager,
  upload.single('file'),
  asyncHandler(replaceClaimFile)
);

adminRoutes.patch(
  '/claims/:id/status',
  requireClaimEditor,
  asyncHandler(updateClaimStatus)
);

adminRoutes.post(
  '/claims/:id/notes',
  asyncHandler(addClaimNote)
);

adminRoutes.get(
  '/support/tickets',
  asyncHandler(listAdminSupportTickets)
);

adminRoutes.get(
  '/support/tickets/:id',
  asyncHandler(getAdminSupportTicket)
);

adminRoutes.post(
  '/support/tickets/:id/messages',
  asyncHandler(addAdminSupportMessage)
);

adminRoutes.patch(
  '/support/tickets/:id/status',
  asyncHandler(updateAdminSupportTicketStatus)
);

adminRoutes.get(
  '/flights/external',
  asyncHandler(adminExternalFlights)
);

adminRoutes.get(
  '/flights/cancelled-last-24h',
  asyncHandler(adminCancelledFlightsLast24h)
);

adminRoutes.get(
  '/flights/delayed-last-24h',
  asyncHandler(adminDelayedFlightsLast24h)
);

adminRoutes.get(
  '/flights/count',
  asyncHandler(adminExternalFlightsCount)
);

adminRoutes.get(
  '/flight-cache/summary',
  asyncHandler(adminFlightCacheSummary)
);

adminRoutes.post(
  '/flight-cache/sync',
  requireSupervisor,
  asyncHandler(adminSyncFlightCache)
);

adminRoutes.get(
  '/flight-cache/push-status',
  asyncHandler(adminFlightPushStatus)
);

adminRoutes.get('/cms/pages', requireCmsEditor, asyncHandler(listCmsPages));
adminRoutes.post('/cms/pages', requireCmsEditor, asyncHandler(createCmsPage));
adminRoutes.get('/cms/pages/:id', requireCmsEditor, asyncHandler(getCmsPage));
adminRoutes.patch('/cms/pages/:id', requireCmsEditor, asyncHandler(updateCmsPage));
adminRoutes.put('/cms/pages/:id', requireCmsEditor, asyncHandler(updateCmsPage));
adminRoutes.delete('/cms/pages/:id', requireCmsEditor, asyncHandler(deleteCmsPage));
adminRoutes.post('/cms/pages/:id/duplicate', requireCmsEditor, asyncHandler(duplicateCmsPage));
adminRoutes.post('/cms/pages/:id/publish', requireCmsEditor, asyncHandler(publishCmsPage));
adminRoutes.post('/cms/pages/:id/unpublish', requireCmsEditor, asyncHandler(unpublishCmsPage));
adminRoutes.get('/cms/globals', requireCmsEditor, asyncHandler(listCmsGlobalLayouts));
adminRoutes.get('/cms/globals/:type', requireCmsEditor, asyncHandler(getCmsGlobalLayout));
adminRoutes.put('/cms/globals/:type', requireCmsEditor, asyncHandler(updateCmsGlobalLayout));
adminRoutes.post('/cms/globals/:type/publish', requireCmsEditor, asyncHandler(publishCmsGlobalLayout));
adminRoutes.get('/cms/pages/:id/versions', requireCmsEditor, asyncHandler(listCmsPageVersions));
adminRoutes.post('/cms/pages/:id/versions/:versionId/restore', requireCmsEditor, asyncHandler(restoreCmsPageVersion));

adminRoutes.get('/cms/media', requireCmsEditor, asyncHandler(listCmsMedia));
adminRoutes.post('/cms/media', requireCmsEditor, cmsUpload.single('file'), asyncHandler(uploadCmsMedia));
adminRoutes.patch('/cms/media/:id', requireCmsEditor, asyncHandler(updateCmsMedia));
adminRoutes.delete('/cms/media/:id', requireCmsEditor, asyncHandler(deleteCmsMedia));
