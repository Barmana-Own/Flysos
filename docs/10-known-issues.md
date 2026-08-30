# Known Issues — Passenger Rights Document Delivery Fix

## Non-blocking limitations

1. MySQL migration and a complete settings upload/persist/public-download transaction were not executed locally because no database service or credentials are available.
2. The frontend is distributed as prebuilt assets, so a source-level frontend build cannot be run from this repository.
3. Actual production deployment was not performed; it requires an authorized target and secrets managed by the deployment environment.

These items are environment verification requirements, not unresolved implementation defects.
