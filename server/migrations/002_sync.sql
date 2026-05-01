-- Sync subscription + API keys + monthly usage + audit

CREATE TABLE IF NOT EXISTS sync_keys (
  id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL REFERENCES devices(fingerprint) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  api_key_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_keys_hash ON sync_keys(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_sync_keys_fingerprint ON sync_keys(fingerprint);

CREATE TABLE IF NOT EXISTS sync_subscriptions (
  fingerprint TEXT PRIMARY KEY REFERENCES devices(fingerprint) ON DELETE CASCADE,
  tier_limit_records INTEGER NOT NULL DEFAULT 10000,
  paid_until TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'INACTIVE', -- ACTIVE | INACTIVE | PAST_DUE | SUSPENDED
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sync_usage_monthly (
  fingerprint TEXT NOT NULL REFERENCES devices(fingerprint) ON DELETE CASCADE,
  month_key TEXT NOT NULL, -- YYYY-MM
  last_record_count INTEGER NOT NULL DEFAULT 0,
  max_record_count INTEGER NOT NULL DEFAULT 0,
  pushes INTEGER NOT NULL DEFAULT 0,
  last_push_at TIMESTAMPTZ,
  PRIMARY KEY (fingerprint, month_key)
);

CREATE TABLE IF NOT EXISTS sync_audit (
  id TEXT PRIMARY KEY,
  fingerprint TEXT,
  user_id TEXT,
  action TEXT NOT NULL, -- VERIFY | PUSH | PULL
  ok BOOLEAN NOT NULL,
  message TEXT,
  record_count INTEGER,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

