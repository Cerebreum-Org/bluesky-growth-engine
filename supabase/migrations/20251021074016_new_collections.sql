-- New Bluesky collections tables: feed generators, threadgates, starterpacks, labeler services

BEGIN;

CREATE TABLE IF NOT EXISTS bluesky_feed_generators (
  uri text PRIMARY KEY,
  owner_did text NOT NULL,
  display_name text,
  description text,
  avatar_link text,
  accepts_interactions boolean,
  labels jsonb,
  created_at timestamptz,
  indexed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feed_generators_owner ON bluesky_feed_generators(owner_did);

CREATE TABLE IF NOT EXISTS bluesky_threadgates (
  post_uri text PRIMARY KEY,
  owner_did text NOT NULL,
  allow jsonb,
  created_at timestamptz,
  indexed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_threadgates_owner ON bluesky_threadgates(owner_did);

CREATE TABLE IF NOT EXISTS bluesky_starterpacks (
  uri text PRIMARY KEY,
  owner_did text NOT NULL,
  name text,
  description text,
  list_uri text,
  feeds jsonb,
  joined_week_count integer,
  joined_all_time_count integer,
  labels jsonb,
  created_at timestamptz,
  indexed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_starterpacks_owner ON bluesky_starterpacks(owner_did);

CREATE TABLE IF NOT EXISTS bluesky_labeler_services (
  uri text PRIMARY KEY,
  owner_did text NOT NULL,
  policies jsonb NOT NULL,
  created_at timestamptz,
  indexed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_labeler_services_owner ON bluesky_labeler_services(owner_did);

COMMIT;
