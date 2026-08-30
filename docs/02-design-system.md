# Design System — Passenger Rights Document Delivery Fix

## Status

**STAGE_02_STATUS: PASS**

This task preserves the existing Flysos browser application and its Persian RTL design. No visual redesign or generated-asset replacement was required because the active UI already contains the supervisor upload control and the public download state.

## Visual foundations

- Direction: Persian RTL at document level; technical values, URLs, and file names retain their natural LTR treatment.
- Brand anchor: deep navy `#0c2a5c`, already used by the active site metadata and visual hierarchy.
- Interaction accent: the existing sky-blue action family is retained for upload, save, and link actions.
- Feedback: success, warning, error, and informational states use both text/icon and color so status is not color-only.
- Density: compact operational controls in the admin panel; readable single-purpose content on the public rights page.
- Motion: existing short transitions are retained; document upload feedback must not depend on animation.

## Component rules relevant to this change

- File controls expose the accepted PDF format and show a loading state during upload/save.
- A persisted document is represented by an explicit download link; an absent document has an explanatory empty state.
- Server validation errors are surfaced as recoverable form feedback without exposing paths or stack traces.
- The public link is a normal keyboard-accessible anchor and must work at the API-backed upload path.

## Responsive and accessibility contract

- The settings form remains usable at mobile, tablet, and desktop widths.
- File selection and save controls retain visible focus and touch-safe sizing.
- Labels and error messages remain associated with the file control.
- Long Persian text, URLs, and file names wrap or scroll without clipping.
- Reduced-motion preferences do not remove essential status feedback.

## Handoff to Stage 03

The implementation must preserve the active asset pair, use the existing API client, and keep the document field names compatible with the server response. The server is responsible for validation and persistence; the browser is only a usability layer.
