# Build log

Surprises from the framework and our code: the dead end, the path we chose, and the test that guards it.

## 2026-11-02 — The gate has to be the framework's, not ours

- **Dead end:** putting "don't act above your level" in the system prompt. A prompt is a suggestion, and an MCP client never sees it.
- **Path:** `defineAction({ needsApproval })` accepts a predicate `(args, ctx) => boolean | Promise<boolean>`, and `preparedCallNeedsApproval` checks it on every surface (agent loop, MCP, HTTP). `perform-step` reads the step's earned level from the DB, so the gate and the ladder share one source of truth. A predicate that throws fails closed and asks.
- **Guard:** `server/lib/trust.spec.ts` (ladder rules) plus the e2e "gate holds" check.

## 2026-11-02 — The agent must not be able to approve itself

- **Path:** `decide-step` and `respond-promotion` set `toolCallable: false`, so they exist for the UI (and HTTP) but are never offered to the agent as tools.

## 2026-11-03 — Run the agent on Meta's Muse Spark through an OpenAI-compatible endpoint

- **Dead end:** setting `OPENAI_API_KEY` and `OPENAI_BASE_URL` in `.env`. The chat unlocked, but the model picker only offered OpenAI model names, so every chat would have sent an unknown model id to Meta. A copied `.env` also pointed the base URL at `api.openai.com`, which would have sent the Meta key to OpenAI.
- **Path:** save the key and endpoint through Settings > Model > Add provider (OpenAI, with an endpoint URL). The form reads `GET /v1/models` from the endpoint and fills the model checklist (`muse-spark-1.3`, `muse-spark-1.1`). The framework treats `.env` values as a deployment fallback, not as a saved provider.
- **Guard:** the real run in `docs/evidence/05-real-agent-run.png`. Muse Spark 1.3 started the run, ran the Auto step, and stopped at the Approve step as `waiting_on_person`. Both `muse-spark-1.1` and `-1.3` returned valid tool calls in a direct check against `api.meta.ai/v1/chat/completions`.

## 2026-11-03 — Vercel Hobby rejects the framework's default cron

- **Dead end:** `vercel deploy` failed with "Hobby accounts are limited to daily cron jobs". The framework's Vercel preset writes a cron that runs more often than once a day.
- **Path:** build with `AGENT_NATIVE_VERCEL_CRON_SCHEDULE="0 9 * * *"` and set `CRON_SECRET` in the production env. The Monday chase only needs a daily tick.
- **Guard:** the deploy succeeds. The build command is in the README.

## 2026-11-03 — Live signup failed with CONNECTION_ENDED on Supabase

- **Dead ends:** blaming the host and the database, one setting at a time. Turning Fluid Compute off, moving from the session pooler (which then hit `EMAXCONNSESSION`, 15 clients on Nano) to the transaction pooler, and pinning the function to Dublin each changed the symptom but not the failure. `scripts/db-check.mjs` passed from a laptop the whole time.
- **Cause:** found by running the production build locally with `VERCEL=1` against the same Supabase database and logging every DB error and timeout. On serverless the framework caps its Postgres pool at **1** connection. A startup query holds that one connection while other queries queue behind it (`SELECT name FROM _org_migrations_named` timed out), so each one hits the 8 s timeout. The framework then ends the pool, and every later query fails with `write CONNECTION_ENDED`. It isn't Vercel or Supabase: it fails the same way on a laptop.
- **Path:** `pnpm build:vercel` runs `scripts/vercel-function-config.mjs` after the build. It raises the serverless pool to 5, which is safe behind the transaction pooler (port 6543), pins the function to `dub1` next to the database, and sets `maxDuration` to 60 s. The script throws if the framework code it patches moves, so a framework upgrade can't silently undo the fix.
- **Guard:** the same local repro went from a 500 after 10.7 s to a correct "email or password is incorrect" in 1.2 s. Signing up on the live site is the end-to-end check.
