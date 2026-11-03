// Connects the way the deployed app does and prints real errors.
// Usage: set -a; . ./.env; set +a; node scripts/db-check.mjs "$PROD_DATABASE_URL" "$PROD_MIGRATE_URL"
import postgres from "postgres";

const urls = process.argv.slice(2);
if (!urls.length) throw new Error("pass one or more connection urls");

const variants = [
  ["plain", {}],
  [
    "serverless startup params (what the deployed app sends)",
    {
      connection: {
        application_name: "agent-native:app",
        idle_in_transaction_session_timeout: 30_000,
      },
    },
  ],
];

for (const url of urls) {
  const label = new URL(url.replace(/^postgres(ql)?:/, "http:")).port;
  for (const [name, options] of variants) {
    const sql = postgres(url, {
      prepare: false,
      max: 1,
      connect_timeout: 15,
      idle_timeout: 20,
      onnotice: () => {},
      ...options,
    });
    try {
      await sql`select 1 as one`;
      await sql.begin(async (tx) => {
        await tx`create temp table _probe (id int) on commit drop`;
        await tx`insert into _probe values (1)`;
      });
      console.log(`ok   port ${label} · ${name}`);
    } catch (e) {
      console.log(`FAIL port ${label} · ${name}: ${e.code ?? ""} ${e.message}`);
    } finally {
      await sql.end({ timeout: 2 }).catch(() => {});
    }
  }
}
