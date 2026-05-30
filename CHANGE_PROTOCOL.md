Before touching any code:

1. Connect to both databases and verify the current state:
   - Production: postgresql://postgres.iryiobhmmvdnvwfovuye:...@aws-1-us-west-2.pooler.supabase.com:6543/postgres
   - Test: postgresql://postgres.ebxmitfsjbarknigcdsp:...@aws-1-us-west-2.pooler.supabase.com:6543/postgres

2. Apply changes to BOTH databases. Never touch only one.

3. After every database change, download both schemas:
   pg_dump ... -f schema.sql
   pg_dump ... -f test_schema.sql
   Both must be identical in the affected areas.

4. Update tyflow_sql/ files to match schema.sql exactly.

5. Then and only then, update the Python backend top to bottom:
   domain → application → infrastructure → presentation

6. Update the /test folder last:
   - Unit tests: adjust any entity field names, DTO shapes,
     or use case inputs that changed.
   - Integration tests: update fixtures and assertions to
     match the new database columns.
   - E2E tests: update request bodies and response field
     assertions to match the new API contract.

7. Verify zero remaining references to removed fields across
   all updated files — backend and tests — before declaring done.