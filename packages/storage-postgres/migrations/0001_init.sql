-- @bonsai/storage-postgres — initial schema.
-- Ships as SQL only. Embedders can pipe this through any migration runner;
-- a lightweight `applyMigrations` helper is exported for tests and simple
-- deployments.

CREATE TABLE IF NOT EXISTS bonsai_projects (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS bonsai_branches (
  id                 TEXT PRIMARY KEY,
  project_id         TEXT NOT NULL REFERENCES bonsai_projects(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  parent_branch_id   TEXT REFERENCES bonsai_branches(id) ON DELETE SET NULL,
  fork_point         TEXT,
  lane               INTEGER NOT NULL,
  auto_named         BOOLEAN NOT NULL,
  merged_to_parent   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS bonsai_branches_project_idx
  ON bonsai_branches (project_id);

CREATE TABLE IF NOT EXISTS bonsai_messages (
  id                             TEXT PRIMARY KEY,
  branch_id                      TEXT NOT NULL REFERENCES bonsai_branches(id) ON DELETE CASCADE,
  role                           TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content                        TEXT NOT NULL,
  sequence                       INTEGER NOT NULL,
  parent_ids                     JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_message_id              TEXT,
  is_merge_commit                BOOLEAN NOT NULL DEFAULT FALSE,
  merged_branch_name             TEXT,
  merged_branch_id               TEXT,
  merged_source_last_message_id  TEXT,
  provider                       TEXT,
  adapter_metadata               TEXT,
  created_at                     TIMESTAMPTZ NOT NULL,
  UNIQUE (branch_id, sequence)
);
CREATE INDEX IF NOT EXISTS bonsai_messages_branch_seq_idx
  ON bonsai_messages (branch_id, sequence);
CREATE INDEX IF NOT EXISTS bonsai_messages_merge_commit_idx
  ON bonsai_messages (branch_id, merged_branch_id)
  WHERE is_merge_commit;

CREATE TABLE IF NOT EXISTS bonsai_merges (
  id                   TEXT PRIMARY KEY,
  source_branch_id     TEXT NOT NULL REFERENCES bonsai_branches(id) ON DELETE CASCADE,
  target_branch_id     TEXT NOT NULL REFERENCES bonsai_branches(id) ON DELETE CASCADE,
  status               TEXT NOT NULL CHECK (status IN ('proposed','summarized','applied')),
  summary              TEXT,
  applied_message_id   TEXT,
  applied_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS bonsai_distillations (
  id                TEXT PRIMARY KEY,
  branch_id         TEXT REFERENCES bonsai_branches(id) ON DELETE CASCADE,
  merge_id          TEXT REFERENCES bonsai_merges(id) ON DELETE CASCADE,
  wiki_page_slug    TEXT NOT NULL,
  wiki_page_title   TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL,
  CHECK ((branch_id IS NULL) <> (merge_id IS NULL))
);

CREATE TABLE IF NOT EXISTS bonsai_wiki_pages (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES bonsai_projects(id) ON DELETE CASCADE,
  slug         TEXT NOT NULL,
  title        TEXT NOT NULL,
  content      TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL,
  search_tsv   tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')),   'A') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'B')
  ) STORED,
  UNIQUE (project_id, slug)
);
CREATE INDEX IF NOT EXISTS bonsai_wiki_pages_search_idx
  ON bonsai_wiki_pages USING GIN (search_tsv);
