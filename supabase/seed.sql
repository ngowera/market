-- Core no-fee rule and policy defaults are seeded transactionally by the migration.
-- Real staff, loans and assets MUST NOT be seeded using shared passwords or public identities.
-- Import approved staging loan snapshots via the signed integration endpoint, then
-- create collateral and approvals using separately provisioned staff test accounts.
select version from public.fee_rules where is_active;
