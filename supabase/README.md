# Install in Supabase

1. Open your project's SQL Editor and create a new query.
2. Paste **all of `setup.sql`** and click Run (postgres role).
3. Visit the marketplace. Browsing, searching and viewing published listings require no account. Accounts are required for bids, offers, purchases and staff administration.

The installer is transactional and safe to rerun. It refuses conflicting existing tables/types/private schema rather than overwriting another application's data. If you already installed the original foundation migration, use migrations instead of this installer. No fake loan or sale records are seeded. An empty live catalogue stays empty; listings appear only after staff publish them through the approval process.

For a new Supabase project, run [`setup.sql`](setup.sql) in **Supabase Dashboard → SQL Editor** as the database owner. For the already-connected project, do not rerun the full installer: run [`20261009163000_listing_photo_storage.sql`](migrations/20261009163000_listing_photo_storage.sql) there to configure the listing image bucket and staff upload policy. Before the Level 4 listing policies, apply [`20261009240000_listing_image_galleries.sql`](migrations/20261009240000_listing_image_galleries.sql) to add listing gallery columns, then run [`20261009250000_level4_direct_listing_publish.sql`](migrations/20261009250000_level4_direct_listing_publish.sql), [`20261009270000_level4_authorization_bypass.sql`](migrations/20261009270000_level4_authorization_bypass.sql), [`20261009280000_listing_management.sql`](migrations/20261009280000_listing_management.sql), [`20261009290000_active_settings_policy.sql`](migrations/20261009290000_active_settings_policy.sql), and [`20261009300000_release_buyer_handover_reporting.sql`](migrations/20261009300000_release_buyer_handover_reporting.sql) in order. Reapply the latter migrations in that order if the gallery migration was applied after them. Level 4 staff can publish without sale authorization, edit listing details/photos, archive listings, and propose policy changes; policy changes take effect only after independent Level 4 approval. The configured high-value release threshold requires Level 4 approval for releases at or above the amount. Levels 2 and 3 still need approved sale authorization and independent publication approval. Archived listings disappear from the public website while transaction and audit history is retained. The 2500 migration also publishes existing pending listings by active Level 4 staff when their sale authorization is approved, and cancels the obsolete listing-review requests. Collection codes are currently delivered to the buyer in an in-account notification; no SMS provider is configured. The GitHub Pages frontend calls the Supabase Edge Function at `functions/v1/api` for authenticated account and staff workflows. GitHub Actions deploys the function when `SUPABASE_PROJECT_REF` and the `SUPABASE_ACCESS_TOKEN` secret are configured. Set `SUPABASE_PUBLISHABLE_KEY` as a repository variable for browser calls. The Pages origin is restricted to `https://ngowera.github.io`; custom domains require updating `ALLOWED_ORIGIN` in the workflow.

Collateral can be linked to a synchronized loan or created as a standalone sale by leaving the external loan ID blank. Level 2 and Level 3 staff need an approved sale authorization, then independent Level 3+ publication approval. Level 4 staff may publish immediately with or without a sale authorization. Standalone sale proceeds are recorded as owner surplus after approved fees; no loan recovery is generated.

Level 3+ staff can record an in-person fixed-price cash sale with a receipt reference and buyer name. The transaction marks the item sold and records a balanced settlement and audit event; collection still follows the separate staff-approval process. Auctions and unapproved listings cannot be recorded as cash sales.

## First staff accounts

Create two real users through Supabase Authentication or the website signup screen. Confirm their email addresses. Then edit and run the following SQL with their actual emails. Use separate people for maker/checker approvals.

```sql
-- Replace the email before running. Repeat for the second staff member.
insert into public.staff_profiles(user_id,full_name,security_level,is_active)
select id, 'Administrator', 4, true
from auth.users where lower(email)=lower('REPLACE-WITH-STAFF-EMAIL');
```

Check that one row was inserted. Level 3 and Level 4 staff require MFA by default. An institution owner may explicitly set `mfa_required=false` for a named exception; this allows high-privilege sign-in without the second factor and reduces account protection. Keep Supabase service-role and PayChangu secrets server-only; the anon key only permits public catalogue reads and the authenticated user's authorized operations. Payment and loan integration need their separate server credentials.

To regenerate the installer after editing the canonical migration, run `node scripts/generate-supabase-setup.mjs`. Never use the installer to upgrade an existing installation.
