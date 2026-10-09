# Install in Supabase

1. Open your project's SQL Editor and create a new query.
2. Paste **all of `setup.sql`** and click Run (postgres role).
3. Visit the marketplace. Browsing, searching and viewing published listings require no account. Accounts are required for bids, offers, purchases and staff administration.

The installer is transactional and safe to rerun. It refuses conflicting existing tables/types/private schema rather than overwriting another application's data. If you already installed the original foundation migration, use migrations instead of this installer. No fake loan or sale records are seeded. Listings appear only after staff publish them through the approval process.

Collateral can be linked to a synchronized loan or created as a standalone sale by leaving the external loan ID blank. Both kinds still require an approved sale authorization and independent listing approval. Standalone sale proceeds are recorded as owner surplus after approved fees; no loan recovery is generated.

## First staff accounts

Create two real users through Supabase Authentication or the website signup screen. Confirm their email addresses. Then edit and run the following SQL with their actual emails. Use separate people for maker/checker approvals.

```sql
-- Replace the email before running. Repeat for the second staff member.
insert into public.staff_profiles(user_id,full_name,security_level,is_active)
select id, 'Administrator', 4, true
from auth.users where lower(email)=lower('REPLACE-WITH-STAFF-EMAIL');
```

Check that one row was inserted. Senior staff must enroll and verify MFA in Account > Security before opening the admin workspace. Keep Supabase service-role and PayChangu secrets server-only; the anon key only permits public catalogue reads and the authenticated user's authorized operations. Payment and loan integration need their separate server credentials.

To regenerate the installer after editing the canonical migration, run `node scripts/generate-supabase-setup.mjs`. Never use the installer to upgrade an existing installation.
