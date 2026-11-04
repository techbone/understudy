// Read-only snapshot of what the database is doing: open sessions, lock waits,
// and the timeout settings. Run it while the live site is stalling.
// Usage: set -a; . ./.env; set +a; node scripts/db-activity.mjs "$PROD_MIGRATE_URL"
import postgres from "postgres";

const url = process.argv[2];
if (!url) {
  console.error("Pass a database URL.");
  process.exit(1);
}
const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 10 });
try {
  console.log("Sessions (oldest transaction first):");
  console.table(
    await sql`
      select pid, application_name as app, state, wait_event_type as wait_type, wait_event,
             extract(epoch from now() - xact_start)::int as xact_s,
             extract(epoch from now() - state_change)::int as state_s,
             left(regexp_replace(query, '\\s+', ' ', 'g'), 90) as query
      from pg_stat_activity
      where datname = current_database() and pid <> pg_backend_pid()
      order by xact_start nulls last`,
  );
  console.log("Waiting or exclusive locks:");
  console.table(
    await sql`
      select l.pid, l.mode, l.granted, c.relname as relation
      from pg_locks l left join pg_class c on c.oid = l.relation
      where not l.granted or l.mode like '%Exclusive%'
      limit 30`,
  );
  console.log("Settings:");
  console.table(
    await sql`
      select name, setting from pg_settings
      where name in ('max_connections', 'idle_in_transaction_session_timeout', 'statement_timeout', 'lock_timeout')`,
  );
} finally {
  await sql.end();
}
