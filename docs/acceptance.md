# Launch acceptance and remaining work

## Already checked locally

- Core pages return HTTP 200 with product-specific content.
- PostgreSQL migration executes using a local PostgreSQL engine.
- Anonymous roles cannot read loans or collateral evidence.
- Direct financial and bid writes are denied to buyers.
- Level 2 cannot invoke approval actions; senior staff need MFA.
- Request makers cannot approve their own requests, including Level 4.
- Draft listings stay private; published projection has no borrower/loan fields.
- Minimum bids, late bids and anti-sniping are server-authoritative.
- Closing a finished auction twice creates one order.
- Another buyer cannot read the winner's order or mark payment paid.
- Exact payment/currency/reference checks, idempotent settlement and balanced ledger.
- Audit and bid records reject deletion.
- Paid assets require independent approved release, matching identity and valid single-use token.

## Required staging verification

- Apply migration to a clean staging Supabase project and run its security/database advisors. Review all grants against the existing project's schema; do not apply indiscriminately to the loan application.
- Test positive/negative RLS with real GoTrue-issued tokens for all four staff levels and two buyers, including account disablement during a session.
- Enroll/verify TOTP, refresh sessions and verify authentication emails and password recovery redirects.
- Start two independent connections. Submit simultaneous bids, duplicate Buy now requests, overlapping auction-close/bid requests, concurrent webhook deliveries and late payment versus expiry. Assert one committed order/settlement/release with no lost bid.
- Run PayChangu test checkout success, failure, pending, wrong amount/currency/reference, tampered signatures and duplicated/out-of-order notifications. No return-query parameter may mark paid.
- Validate private Storage policies using uploaded owned images/evidence. Check download/access isolation and audit sensitive exports.
- Test offline loan API, retries, duplicate idempotency keys, dead-letter recovery and daily financial reconciliation. Job credentials must never enter browser code.
- Verify public realtime fan-out and stale bid UI handling under network disruption.
- Review mobile layouts at 360px, keyboard focus, screen-reader semantics and WCAG contrast with a browser.

## Remaining product/operations work before production

- Institution-approved final seller identity, contacts, terms, privacy/retention notice, complaint escalation and lawful collateral-sale process. Current legal pages are drafts.
- Full refund/dispute state machines with approved provider refund integration. Disputes table exists, but no completed refund workflow is supplied.
- Optional enhanced bidder KYC, deposit-backed bidding and proxy bids are schema/architecture extensions; they are not active engines.
- Automated email/SMS adapter and delivery/retry monitoring. In-app notifications are implemented; outbound notification delivery is not configured.
- Full password-recovery callback, self-service TOTP enrollment and logout-all-devices UX need staging integration with your Auth settings.
- Staff invitations/onboarding, multi-angle media manager with image processing and evidence upload UX need institutional configuration. Existing user UUIDs can receive approved staff access.
- Scheduled publishing, approved cancellations/price reductions and exceptional auction controls need policy-specific workflows. No shortcut lets staff bypass the approval rules.
- Management KPIs and historical chart queries need your agreed reporting definitions and complete data; preview figures are samples, connected tables show actual authorized records.
- Production job scheduler, monitoring/alerts, backup/Storage retention, restore rehearsal, incident response, deployment pipeline and performance/load testing.
- DNS and TLS for the institution's chosen www/admin domains.

No live services were modified and no real payments were initiated during implementation.
