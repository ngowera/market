# nyasamarket.com

Built from the 47-page `Collateral_Marketplace_Recovery_Platform_Full_Build_Spec.pdf`.

## Run the system

Requires Node 22.13+ and npm.

```sh
npm ci
npm run dev
```

The production frontend is published to GitHub Pages and its dynamic account, marketplace, and staff APIs run as Supabase Edge Functions. The Pages workflow builds and deploys both parts through GitHub Actions. Local development can still use `npm run dev`; backend requests use the shared Supabase project.

GitHub Pages publishes the frontend; GitHub Actions deploys the dynamic API as a Supabase Edge Function. Set repository Actions variables `SUPABASE_PROJECT_REF` and `SUPABASE_PUBLISHABLE_KEY`, plus secret `SUPABASE_ACCESS_TOKEN`. The publishable key is public and included in the browser bundle; never use the service-role key there. The Pages workflow publishes the site and deploys `supabase/functions/api`; it also configures the allowed GitHub Pages origin and callback URL. Configure optional payment and loan integration secrets in Supabase Function Secrets, not in the frontend or Pages build. The Pages admin sign-in uses a tab-scoped bearer session because the API is hosted on a different origin.

The workspace includes `.env`. Your Supabase URL is filled in; add `SUPABASE_ANON_KEY` (or `SUPABASE_PUBLISHABLE_KEY`). Until that key is present, the application shows a clearly marked sample catalogue and read-only sample admin workspace. Sample records are never used by financial endpoints. `.env` and `.env.local` are ignored by Git.

## Connect services

1. Add the public connection and server secrets using `.env.example` as the reference. Never expose service-role or PayChangu keys using `NEXT_PUBLIC_` variables.
2. Review and apply `supabase/migrations/20261005182742_cmrp_foundation.sql` to a dedicated staging project first. This migration was **not** applied to your existing remote project. It creates tables in `public`, so check conflicts with an existing loan application before applying.
3. Enable email verification in Supabase Auth, configure redirect URLs, email delivery, rate limits and bot protection. Senior staff need a verified TOTP factor. Create the initial two Level 4 staff profiles through a controlled database/bootstrap process; subsequent changes require independent Level 4 approval. Never grant roles from user-editable metadata.
4. Set `APP_URL` to your real application origin. Set `PAYCHANGU_SECRET_KEY` and `PAYCHANGU_WEBHOOK_SECRET` server-side. Start with PayChangu **test credentials**. Configure `/api/payments/webhook` in the merchant dashboard.
5. Set `LOAN_API_URL`, `LOAN_API_TOKEN` and `INTEGRATION_JOB_SECRET`. Import minimal loan snapshots through `/api/integration/collateral`. The existing loan system remains the source of truth.
6. Schedule protected POST endpoints `/api/jobs/auctions` every minute, `/api/jobs/reconcile` at least every five minutes, and `/api/jobs/loan-sync` every minute. Set `Authorization: Bearer <INTEGRATION_JOB_SECRET>`. Job scheduling is an external operational setup step; it is not enabled by this repository.

## Implemented

- Responsive public catalogue, search, category/method/location/condition/price filters, sorting, asset details, enlargement, defects, bid history, sharing and buying instructions.
- Supabase buyer registration/sign-in/recovery requests, verified buyers, server cookies, watchlist, bids/offers/orders, notifications and checkout initiation.
- Staff portal with dashboard, collateral, listing preparation, sale authorization, maker-checker inbox, auctions, offers/counters, payments, release desk, settlements, audit, reporting, staff access and versioned policy requests.
- PostgreSQL grants and RLS, four staff levels, AAL2 for senior staff, restricted private evidence storage, append-only audit/bids, authoritative row-locked bid placement, anti-sniping, server auction closure and fixed/accepted-offer reservations.
- PayChangu hosted checkout adapter, SHA-256 HMAC webhook authentication, exact server verification, transactional/idempotent paid transition, settlement lines, approved settlement outbox and loan posting retries/dead-letter state.
- Public-safe Supabase realtime catalogue updates with a polling fallback. No raw borrower/loan/bidder tables are published.
- Configurable fee rules; no platform commission enabled by default. All financial computations happen in PostgreSQL NUMERIC or integer minor units.

## Verification

```sh
npm test
npm run typecheck
npm run build
deno check --config supabase/functions/api/deno.json supabase/functions/api/index.ts
```

The PostgreSQL suite uses PGlite with mocked Supabase `auth` and `storage` schemas. It executes the actual migration and checks private-data denial, unauthorized writes, staff levels, MFA, maker-checker, hidden drafts, bids/minimums/late-close rules, anti-sniping, winner idempotency, payment amount matching, settlement balance, outbox creation and single-use release. Unit tests check exact money arithmetic and webhook authentication.

The local engine serializes queries. It **does not prove production multi-connection concurrency**, Supabase Realtime delivery, GoTrue/MFA behavior, storage access against a live Supabase service, or PayChangu/loan-provider behavior. Run the live staging acceptance scenarios in `docs/acceptance.md` before launch. Browser visual QA was unavailable in this environment; HTTP rendering checks cover the principal routes.

## Production readiness

This is an implemented system foundation, not a signed-off production deployment. Credentials, remote migrations, merchant setup, initial staff provisioning, scheduled jobs and loan API agreement are still required. The remaining operational/product work is tracked in `docs/acceptance.md`, including full refund/dispute processing, enhanced bidder/deposit policies, legally approved final terms, email/SMS delivery, backup restore, monitoring and real multi-client concurrency tests.

## Assets

The four catalogue items are invented samples. Their reference photographs are not photos of actual collateral. Sources and reuse notes are recorded in `docs/assets.md`; replace them with owned asset photography before public launch.
