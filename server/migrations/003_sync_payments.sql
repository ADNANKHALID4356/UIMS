-- Store sync subscription purchase metadata in payments

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS sync_tier_limit_records INTEGER;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS sync_months INTEGER NOT NULL DEFAULT 1;

