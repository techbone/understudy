import { runMigrations } from "@agent-native/core/db";

export const runUnderstudyMigrations = runMigrations(
  [
    {
      version: 1,
      name: "runbooks-and-trust-ledger",
      sql: `CREATE TABLE IF NOT EXISTS runbooks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  clip_url TEXT,
  transcript TEXT,
  schedule TEXT,
  owner_email TEXT NOT NULL,
  org_id TEXT,
  created_at TEXT NOT NULL DEFAULT (now())
);
CREATE TABLE IF NOT EXISTS runbook_steps (
  id TEXT PRIMARY KEY,
  runbook_id TEXT NOT NULL REFERENCES runbooks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  instruction TEXT NOT NULL,
  effect TEXT NOT NULL CHECK (effect IN ('note', 'send_emails', 'log', 'escalate')),
  risk TEXT NOT NULL DEFAULT 'low' CHECK (risk IN ('low', 'high')),
  level TEXT NOT NULL DEFAULT 'shadow' CHECK (level IN ('shadow', 'approve', 'auto')),
  streak INTEGER NOT NULL DEFAULT 0,
  threshold INTEGER NOT NULL DEFAULT 3,
  promotion_offered_at TEXT,
  clip_at TEXT,
  owner_email TEXT NOT NULL,
  org_id TEXT,
  CHECK (NOT (risk = 'high' AND level = 'auto'))
);
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  runbook_id TEXT NOT NULL REFERENCES runbooks(id) ON DELETE CASCADE,
  trigger TEXT NOT NULL DEFAULT 'manual' CHECK (trigger IN ('manual', 'schedule')),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'waiting', 'done')),
  started_at TEXT NOT NULL,
  finished_at TEXT,
  owner_email TEXT NOT NULL,
  org_id TEXT
);
CREATE TABLE IF NOT EXISTS step_runs (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL REFERENCES runbook_steps(id) ON DELETE CASCADE,
  level_at_run TEXT NOT NULL CHECK (level_at_run IN ('shadow', 'approve', 'auto')),
  status TEXT NOT NULL CHECK (status IN ('suggested', 'proposed', 'approved', 'edited', 'rejected', 'auto_done', 'human_done', 'corrected')),
  proposal TEXT NOT NULL,
  final TEXT,
  feedback TEXT,
  created_at TEXT NOT NULL,
  decided_at TEXT,
  owner_email TEXT NOT NULL,
  org_id TEXT,
  UNIQUE (run_id, step_id)
);
CREATE TABLE IF NOT EXISTS trust_events (
  id TEXT PRIMARY KEY,
  step_id TEXT NOT NULL REFERENCES runbook_steps(id) ON DELETE CASCADE,
  step_run_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('clean_approval', 'edit', 'rejection', 'correction', 'promotion_offered', 'promoted', 'promotion_declined', 'demoted')),
  from_level TEXT,
  to_level TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  org_id TEXT
);
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL,
  client TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  due_on TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paid')),
  reminders_sent INTEGER NOT NULL DEFAULT 0,
  last_reminded_at TEXT,
  owner_email TEXT NOT NULL,
  org_id TEXT
);
CREATE TABLE IF NOT EXISTS client_notes (
  id TEXT PRIMARY KEY,
  client TEXT NOT NULL,
  note TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  org_id TEXT
);
CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY,
  run_id TEXT,
  step_run_id TEXT,
  invoice_id TEXT,
  to_address TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  org_id TEXT
);
CREATE TABLE IF NOT EXISTS ar_log (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  run_id TEXT,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  org_id TEXT
);
CREATE INDEX IF NOT EXISTS runbooks_owner_idx ON runbooks (owner_email, created_at);
CREATE INDEX IF NOT EXISTS runbook_steps_runbook_idx ON runbook_steps (runbook_id, position);
CREATE INDEX IF NOT EXISTS runs_runbook_started_idx ON runs (runbook_id, started_at);
CREATE INDEX IF NOT EXISTS step_runs_run_idx ON step_runs (run_id);
CREATE INDEX IF NOT EXISTS trust_events_step_idx ON trust_events (step_id, created_at);
CREATE INDEX IF NOT EXISTS invoices_owner_due_idx ON invoices (owner_email, due_on);
CREATE INDEX IF NOT EXISTS outbox_owner_sent_idx ON outbox (owner_email, sent_at)`,
    },
  ],
  { table: "understudy_app_migrations" },
);

export default runUnderstudyMigrations;
