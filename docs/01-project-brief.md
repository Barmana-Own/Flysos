# Project Brief — Downloadable Legal-Document Replacement Fix

**STAGE_01_STATUS: PASS**

## Project identity

Flysos downloadable legal-document upload, replacement, persistence, and public delivery repair.

## Objective

Make the super-admin settings controls for `نمونه وکالت‌نامه رسمی` and `آیین‌نامه حقوق مسافر` accept valid PDF files, atomically activate the selected replacement, remove the previous managed physical file after a successful commit, expose the resulting URLs through the public legal-document contract, and serve the new files at the URLs consumed by the public site.

## Actors and journey

- **Supervisor:** selects a PDF in either downloadable-document control in General Settings; the browser uploads CMS media and saves the returned URL in settings; the supervisor can reopen the panel and see the persisted replacement.
- **Public visitor:** opens the passenger-rights page and downloads the configured PDF.
- **System:** validates the file, stores CMS media separately from private claim files, persists the document reference transactionally, removes only the previous unshared managed physical file after commit, and serves legacy/new CMS paths safely.

## Scope

In scope: the upload MIME/signature path, both downloadable legal-document slots, CMS media replacement/storage/cleanup, settings schema/read/write/public mapping, compatible migration/backfill, public upload serving, regression tests, and deployment notes. Database rows and unrelated settings remain preserved.

Out of scope: redesigning the existing page, changing claim workflow semantics, changing authentication roles, or launching to an external production target.

## Constraints and risks

The repository contains prebuilt browser bundles rather than frontend source. Existing database installations may use both `rightsDocumentUrl` and `powerOfAttorneyDocumentUrl` names. Claim uploads share the historical upload directory, so public CMS delivery must not expose that directory wholesale.

## Handoff to Stage 02

The existing UI already contains the required supervisor control and public download state. Stage 02 confirms the state/contract coverage; later stages repair the server and storage boundary without removing existing screens or routes.

## Flight monitoring scope extension — 2026-09-02

The admin dashboard must show the latest valid stored flight snapshot separately from the most recent connection attempt. When enabled, the backend checks the configured provider every ten minutes and retains the previous valid cache when the provider is unreachable. Direct provider connectivity and the authenticated HTTPS push fallback are deployment dependencies; no customer claim data is part of the flight-cache repair.
