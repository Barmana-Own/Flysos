# Project Brief — Passenger Rights Document Delivery Fix

**STAGE_01_STATUS: PASS**

## Project identity

Flysos passenger-rights PDF upload, persistence, and public delivery repair.

## Objective

Make the super-admin setting for `آیین‌نامه حقوق مسافر` accept valid PDF files, persist the selected document URL, expose it through the public legal-document contract, and serve the resulting file at the URL consumed by the public site.

## Actors and journey

- **Supervisor:** selects a PDF in General Settings; the browser uploads CMS media and saves the returned URL in settings; the supervisor can reopen the panel and see the persisted document.
- **Public visitor:** opens the passenger-rights page and downloads the configured PDF.
- **System:** validates the file, stores CMS media separately from private claim files, persists the document reference, and serves legacy/new CMS paths safely.

## Scope

In scope: the upload MIME/signature path, CMS media storage and cleanup, settings schema/read/write/public mapping, compatible migration/backfill, public upload serving, regression tests, and deployment notes.

Out of scope: redesigning the existing page, changing claim workflow semantics, changing authentication roles, or launching to an external production target.

## Constraints and risks

The repository contains prebuilt browser bundles rather than frontend source. Existing database installations may use both `rightsDocumentUrl` and `powerOfAttorneyDocumentUrl` names. Claim uploads share the historical upload directory, so public CMS delivery must not expose that directory wholesale.

## Handoff to Stage 02

The existing UI already contains the required supervisor control and public download state. Stage 02 confirms the state/contract coverage; later stages repair the server and storage boundary without removing existing screens or routes.
