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

The passenger-rights page, the admin settings panel, existing CMS media records, claim-file handling, current public/admin routes, and the existing frontend bundle behavior must remain available. Any storage-path change must preserve legacy CMS media access without making private claim files public.
