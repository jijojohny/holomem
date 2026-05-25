CREATE EXTENSION IF NOT EXISTS vector;

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

ALTER TABLE memory_index ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE memory_index ADD COLUMN IF NOT EXISTS embedding vector(1536);

CREATE INDEX IF NOT EXISTS memory_index_session_idx
  ON memory_index (api_key_id, session_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS memory_index_agent_idx
  ON memory_index (api_key_id, agent_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS memory_index_embedding_idx
  ON memory_index USING hnsw (embedding vector_cosine_ops)
  WHERE deleted_at IS NULL AND embedding IS NOT NULL;

-- Team accounts (light version — shared quota, no invite flow needed)
CREATE TABLE IF NOT EXISTS teams (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  owner_customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
  team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (team_id, customer_id)
);

ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS api_keys_team_idx ON api_keys (team_id) WHERE team_id IS NOT NULL;

-- Webhook endpoints registered by customers
CREATE TABLE IF NOT EXISTS webhooks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id  UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  events      TEXT[] NOT NULL DEFAULT ARRAY['write','delete']::TEXT[],
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id  UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  status_code INTEGER,
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS webhook_deliveries_idx
  ON webhook_deliveries (webhook_id, created_at DESC);

-- Tracks relationship-edge entities (second Arkiv entity type — links between memory nodes)
CREATE TABLE IF NOT EXISTS edge_index (
  entity_key  TEXT PRIMARY KEY,
  api_key_id  UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  parent_key  TEXT NOT NULL,
  child_key   TEXT NOT NULL,
  edge_type   TEXT NOT NULL DEFAULT 'linked',
  session_id  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL,
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS edge_index_parent_idx
  ON edge_index (api_key_id, parent_key) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS edge_index_session_idx
  ON edge_index (api_key_id, session_id) WHERE deleted_at IS NULL;
