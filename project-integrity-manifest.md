# Project Integrity Baseline

## Baseline

- **Revision:** `6dba406` (`main`)
- **Primary application:** Static Flysos browser application in `index.html` and `assets/`, with the admin experience lazy-loaded from the admin bundle.
- **Admin entry:** `admin/v2/login/index.html`; admin runtime is loaded from the shared public bundle and `assets/AdminPanel-CmsReadyAdminFix20260820.js`.
- **Backend:** Express/Node API under `backend/`, including claim workflows, admin routes, CMS pages/media, settings, authentication, and MySQL adapters.
- **Public routes:** CMS pages/globals, public legal documents, flight status, claim start/upload/track/submit, and public support.
- **Protected routes:** Admin login, settings, CMS editing/media, claims, users, experts, support, notifications, and file download.
- **Persistence domains:** `AppSetting`, claims/customers/passengers/flight data, uploaded claim files, CMS pages/globals/media/versions, support, notifications, and migration-created auxiliary tables.
- **Important configuration/deployment:** `backend/config/env.js`, `backend/app.js`, `backend/index.js`, `api/.htaccess`, backend package/lock files, and installation/migration notes.
- **Critical tests/assets:** `tests/claim-final-step-structure.test.cjs`, the two active browser bundles, CSS/font/static image assets, backend validation/middleware/controller modules, and migration scripts.

## Protected elements for this task

The passenger-rights page, both downloadable-document controls in the admin settings panel, existing CMS media records, claim-file handling, current public/admin routes, and the existing frontend bundle behavior must remain available. Replacement may remove an obsolete physical CMS file only after a committed replacement and only when it is not shared; database metadata and unrelated data must remain preserved. Any storage-path change must preserve legacy CMS media access without making private claim files public.

The admin claim list's supervisor-only delete action is also protected behavior: it must remain connected to `DELETE /api/admin/claims/:id` without weakening authorization or deleting shared customer/history records.

## Claim registration connection repair baseline extension — 2026-09-02

The claim registration path now also protects the existing upload, questionnaire, submit, OCR, and notification behavior across these components:

- `backend/config/db.js` and `backend/config/env.js` for pool/transaction lifecycle configuration;
- `backend/controllers/claimController.js` for the existing claim endpoints;
- `backend/services/ticketExtractionJobService.js` and `backend/services/claimNotificationJobService.js` for post-response work;
- `tests/db-connection-regression.test.cjs`, `tests/claim-upload-lifecycle-regression.test.cjs`, and `tests/claim-registration-connection-regression.test.cjs` for regression coverage.

No protected route, database entity, column, migration, stored record, user-visible flow, or existing data was removed or replaced. The server update changed only runtime code/configuration paths and was validated without a production claim mutation.

## Admin runtime module-graph repair baseline extension — 2026-09-02

The existing public/admin route pair and active bundle behavior remain protected. The canonical HTML entries and reciprocal bundle imports now share one exact cache-busted React module URL, preventing duplicate runtime instantiation without removing any older server asset or changing database contents. Regression coverage is recorded in `tests/admin-react-singleton-regression.test.cjs`.

## Inline claim assignment baseline extension — 2026-09-16

The admin claims table's existing row navigation, claim detail route, expert-management data, and authenticated `PATCH /api/admin/claims/:id` contract remain protected. The new supervisor-only selector is additive in the `کارشناس مسئول` cell, stops event propagation before assignment, and preserves the existing read-only label for other viewers. No claim, customer, file, route, database schema, or stored record was deleted or replaced.

## Registration SMS template baseline extension — 2026-09-02

The existing registration notification and SMS-template storage behavior remain protected. The active admin settings bundle now includes the editable `پیام ثبت پرونده` field while preserving the existing status, replacement-ticket, and bank-detail fields. The backend registration template contract, settings API, and post-commit notification path were reused; only the four canonical static entry/bundle files were deployed for this change. No database schema, stored setting, claim, file, route, or integration was removed or changed.
## Stage-two ticket-upload feedback baseline extension — 2026-09-15

The existing stage-two mandatory ticket upload, optional boarding-pass upload, step navigation, and stage-three questionnaire flow remain protected. The public entrypoint adds only the scoped `assets/ticket-upload-error-position-20260915.js` helper and its HTML reference; it does not remove a route, change an API contract, modify persistence, or alter the admin bundle. The lower React error node remains in the original component for compatibility but is hidden while the accessible top alert is displayed.

## Stage-four final receipt CMS baseline extension — 2026-09-15

The final claim-registration success flow and its generated receipt remain protected. The new `رسید نهایی` content group is additive to the existing `track-success` CMS block; the canvas bridge changes only static receipt text, while claim identifiers, passenger data, filenames, timestamps, submission behavior, and other page/canvas behavior remain unchanged. The existing generic admin editor, public track route, and CMS version/publish boundaries remain in place. No route, database entity, stored claim value, asset outside the scoped helper, or required feature was removed.
