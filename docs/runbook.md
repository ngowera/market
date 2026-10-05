# Operations runbook

## Payments

Never override Paid from a buyer screenshot or redirect. Reconcile through the provider verification endpoint. A mismatch or late payment stays an exception requiring finance review; do not release the asset. Replay authentic webhook events only through the verification path. Duplicate confirmed events are safe. Webhook payload storage excludes card/bank details.

## Recovery posting

Payment confirmation creates one draft settlement. An independent approver checks the balance and releases its recovery outbox entry. The loan system must honor Idempotency-Key. Failures retry with capped exponential backoff and move to dead-letter after ten failures. Resolve provider outages, then replay the same outbox identifier; never create an unrelated replacement financial event.

## Release

Prepare collection with the approved collector name and masked reference. A separate qualified approver generates a release token whose hash is stored. The buyer receives the code in account notifications. A different staff member confirms the code, identity and signed physical handover. Never hand over before verified paid status. Tokens expire after seven days and cannot be reused.

## Initial staff

Create Supabase Auth users and enroll senior users with TOTP. Bootstrap two named Level 4 records through the controlled database owner process, recording approval evidence outside the bootstrap. Subsequent role/state changes use the portal's request + independent approval. User metadata never grants authority. Disabling the staff profile removes server/database staff authority immediately.

## Backups

Choose institutional RPO/RTO based on the actual Supabase plan. Database backup does not include Storage objects; back up evidence separately with access controls. Test database and evidence restore quarterly in an isolated project. Keep production keys outside backups of source code.

## Incident response

Disable compromised staff profiles, revoke Auth sessions and rotate affected provider credentials. Preserve immutable audit and payment events. Inspect approval, payment and release chains. Escalate according to the institution's approved privacy/breach response policy. Do not delete evidence to clean up an incident.
