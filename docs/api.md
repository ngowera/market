# API contract

All responses use JSON except hosted provider redirects. Mutations require same-origin requests and verified Supabase sessions stored in HttpOnly cookies. Browser-supplied prices never control purchases. Database RPCs enforce authorization even when bypassing the web layer.

| Endpoint | Authority / operation |
| --- | --- |
| `GET /api/catalog` | Public-safe published catalogue |
| `GET /api/listings/:uuid` | Public-safe current state and masked bid history |
| `POST /api/auth/login`, `/signup`, `/recover`, `/refresh`, `/logout`, `/mfa` | Supabase Auth; no custom password database |
| `GET /api/session`, `/api/account` | Current identity / own records |
| `POST /api/bids` | `{listing_id, amount, terms:true}`; atomic verified bid |
| `POST /api/offers` | `{listing_id, amount, note, terms:true}` |
| `POST /api/offers/accept` | `{offer_id}`; accept own open seller counteroffer |
| `POST /api/orders` | `{listing_id, terms:true}`; server-price reservation |
| `POST /api/watchlist` | `{listing_id}`; toggle own saved listing |
| `POST /api/payments/checkout` | `{order_id}`; authoritative order total; one active attempt |
| `POST /api/payments/webhook` | PayChangu raw body authenticated by SHA-256 HMAC Signature |
| `GET /api/admin/data` | Active staff level/MFA; RLS-scoped data |
| `POST /api/admin/asset`, `/listing`, `/authorization` | Level 2 preparation requests; collateral may omit `external_loan_id` for a standalone sale |
| `POST /api/admin/approve` | `{request_id, decision, reason}`; independent eligible checker |
| `POST /api/admin/offer` | `{offer_id, decision, amount?, reason}`; Level 3 |
| `POST /api/admin/prepare-release` | `{order_id, collector_name, collector_ref, reason}`; paid-only approval request |
| `POST /api/admin/release` | `{order_id, release_code, collector_name, collector_ref, notes}`; single-use approved handover |
| `POST /api/admin/settlement` | `{settlement_id}`; balance/approval request |
| `POST /api/admin/staff`, `/settings`, `/fee-rule` | Independent Level 4 maker-checker |
| `POST /api/admin/verify-payment` | `{order_id}`; verified provider reconciliation |
| `POST /api/integration/collateral` | Service bearer; minimal snapshot with source_system, external_loan_id, outstanding_amount, currency=MWK, recovery_status, source_version |
| `POST /api/jobs/auctions`, `/reconcile`, `/loan-sync` | Protected operational jobs; external scheduler required |

Loan outbound endpoint: `POST <LOAN_API_URL>/integration/recovery`, bearer `LOAN_API_TOKEN`, durable `Idempotency-Key`. Recipient must deduplicate the recovery event and implement its agreed posting rules.

External documentation checked during implementation: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [PayChangu checkout](https://developer.paychangu.com/docs/standard-checkout), [webhooks](https://developer.paychangu.com/docs/webhooks), [verification](https://developer.paychangu.com/docs/transaction-verification).
