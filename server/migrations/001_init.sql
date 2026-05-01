-- UIMS VPS Backend schema (MVP)

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devices (
  fingerprint TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trial_ends_at TIMESTAMPTZ NOT NULL,
  license_status TEXT NOT NULL DEFAULT 'TRIAL', -- TRIAL | ACTIVE | EXPIRED | BLOCKED
  offline_paid BOOLEAN NOT NULL DEFAULT FALSE,
  offline_paid_at TIMESTAMPTZ,
  offline_price_pkr INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL REFERENCES devices(fingerprint) ON DELETE CASCADE,
  type TEXT NOT NULL, -- OFFLINE_ONE_TIME | SYNC_MONTHLY
  amount_pkr INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | PAID | FAILED | REFUNDED
  provider_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pricing (
  key TEXT PRIMARY KEY,
  value_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default pricing row(s)
INSERT INTO pricing(key, value_json)
VALUES (
  'pricing',
  jsonb_build_object(
    'offlineOneTimePrice', 0,
    'syncTiers', jsonb_build_array(
      jsonb_build_object('upTo', 10000, 'price', 5000),
      jsonb_build_object('upTo', 20000, 'price', 8000),
      jsonb_build_object('upTo', 35000, 'price', 10000),
      jsonb_build_object('upTo', 999999999, 'price', 15000)
    )
  )
)
ON CONFLICT (key) DO NOTHING;

