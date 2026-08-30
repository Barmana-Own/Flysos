# UI Architecture — Passenger Rights Document Delivery Fix

## Role-based surfaces

| Role | Surface | Required behavior |
| --- | --- | --- |
| Supervisor | General settings → downloadable user documents | Upload a PDF, save the returned media URL, reopen settings, and download the persisted document. |
| Public visitor | Passenger rights page | Load the public legal-document contract and show a download action when a document is configured. |
| Other admin roles | General settings/document controls | No new privilege is introduced; existing server-side supervisor/CMS permissions remain authoritative. |

## Flow mapping

1. Supervisor selects `آیین‌نامه حقوق مسافر` PDF.
2. Browser posts multipart data to the protected CMS media endpoint.
3. API validates file metadata/content, stores a CMS media record, and returns a URL.
4. Browser patches settings with `passengerRightsUrl`.
5. Settings GET returns the normalized value after reload.
6. Public legal-document GET returns the same value.
7. Public rights page resolves `/uploads/...` through the API path and offers the PDF download.

## State matrix

| State | Admin behavior | Public behavior |
| --- | --- | --- |
| Loading | Disable duplicate submission and show progress. | Keep the page usable while legal documents load. |
| Empty | Show that no passenger-rights document is configured. | Show the existing not-yet-uploaded message. |
| Success | Show the persisted link and normal save feedback. | Render a download link. |
| Validation error | Keep the selected settings usable and show a safe error. | Treat an invalid/missing response as unavailable. |
| Unauthorized/forbidden | Use existing auth/permission handling. | Not applicable to the public read endpoint. |
| Degraded/offline | Allow retry without losing unrelated settings. | Keep the page readable and omit the unavailable download action. |

## Responsive rules

- Preserve the current stacked mobile settings layout.
- Keep file controls and save actions full-width when the available width is narrow.
- Prevent long URLs from overflowing; use a bounded link label rather than exposing the full path as required content.
- Do not replace the existing public page route or admin navigation.

## Accessibility and localization

- Keep Persian RTL layout and existing labels.
- Preserve LTR behavior for URLs and file names.
- Use semantic form controls, visible focus, text feedback, and keyboard-accessible download links.

## Handoff to Stage 03

The active prebuilt bundles already implement the required states and contract. Stage 03 verifies the bundle references and avoids an unverified frontend rebuild.
