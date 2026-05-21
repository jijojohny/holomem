CREATE TABLE IF NOT EXISTS customers (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email              TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

CREATE TABLE IF NOT EXISTS api_keys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  key_hash    TEXT NOT NULL UNIQUE,    -- sha256 hex of the raw key
  key_prefix  TEXT NOT NULL,          -- first 12 chars for display only
  env         TEXT NOT NULL DEFAULT 'live' CHECK (env IN ('live', 'test')),
  tier        TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'team', 'enterprise')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS api_keys_hash_idx ON api_keys (key_hash) WHERE revoked_at IS NULL;

-- Tracks every memory write so we can enforce quotas and show usage dashboards
CREATE TABLE IF NOT EXISTS usage_events (
  id          BIGSERIAL PRIMARY KEY,
  api_key_id  UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL CHECK (event_type IN ('write', 'read', 'delete', 'recall')),
  session_id  TEXT,
  entity_key  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS usage_events_key_day_idx
  ON usage_events (api_key_id, created_at);

-- Local index of memory entity keys (mirrors what's on Arkiv, enables fast session queries)
CREATE TABLE IF NOT EXISTS memory_index (
  entity_key   TEXT PRIMARY KEY,
  api_key_id   UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  session_id   TEXT NOT NULL,
  agent_id     TEXT,
  ttl_tier     TEXT NOT NULL CHECK (ttl_tier IN ('working', 'episodic', 'persistent')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL,
  deleted_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS memory_index_session_idx
  ON memory_index (api_key_id, session_id) WHERE deleted_at IS NULL;
