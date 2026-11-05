# Build log

Surprises from the framework and our code: the dead end, the path we chose, and the test that guards it.

## 2026-11-02 — The gate has to be the framework's, not ours

- **Dead end:** putting "don't act above your level" in the system prompt. A prompt is a suggestion, and an MCP client never sees it.
- **Path:** `defineAction({ needsApproval })` accepts a predicate `(args, ctx) => boolean | Promise<boolean>`, and `preparedCallNeedsApproval` checks it on every surface (agent loop, MCP, HTTP). `perform-step` reads the step's earned level from the DB, so the gate and the ladder share one source of truth. A predicate that throws fails closed and asks.
- **Guard:** `server/lib/trust.spec.ts` (ladder rules) plus the e2e "gate holds" check.

## 2026-11-02 — The agent must not be able to approve itself

- **Path:** `decide-step` and `respond-promotion` set `uiOnly: true`, so they exist for the UI (and HTTP) but are never offered to the agent as tools.

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

## 2026-11-03 — A failed submit stopped the whole run

- **Dead end:** the live agent sent the escalation step without a subject. `submit-step` rejected it, and the framework then refused to retry ("an earlier attempt may have already saved changes") because it can't tell a rejected write from one that landed. The person had to type "continue".
- **Path:** `submit-step` now declares `retrySafe: true`. That is true here: the output is validated before anything is written, the write is one transaction, and a second submit of the same step is refused. The validation error also names the failing field, so the model fixes the right thing.
- **Guard:** the e2e run still passes. Re-run the escalation step on the live site and confirm a bad first call recovers without a stop.

## 2026-11-03 — The shared demo runs on one funded model key

- **Dead end:** looking for a spend limit in the framework. It records cost per user and can raise alerts, but nothing refuses a run, and the turn-start hook swallows errors, so it can't block either.
- **Path:** `start-run` refuses to start a new run once an account's recorded model spend reaches $5 (about 30 runs at $0.17). A run already in progress can always finish. Free-form chat is not capped; the usage alert and the Meta credit balance are the backstop there.
- **Guard:** `server/lib/usage-cap.spec.ts`.

## 2026-11-04 — A judge's new account had no model

- **Dead end:** the Meta provider added under Settings > Model is saved in the signed-in account's own workspace. A fresh signup gets an empty workspace and the chat says "Connect AI to start chatting". Only the account that configured it could run the agent.
- **Path:** carry the model on the deployment. `OPENAI_API_KEY` and `OPENAI_BASE_URL` (Meta's endpoint) plus `AGENT_MODEL=muse-spark-1.3` as environment variables make every account chat-eligible on Muse Spark 1.3 with nothing saved. `AGENT_MAX_ITERATIONS=40` and `AGENT_MAX_RUN_INPUT_TOKENS=1000000` replace the framework's 400-iteration and 20M-token defaults so one bad run cannot spend much.
- **Guard:** a second local instance on an empty database with only those variables: engine status `chatEligible: true`, model `muse-spark-1.3`, and a real tool-using chat. That run also showed the agent searching docs when a new account had not loaded the demo, so the system prompt now says to point the person at "Load the demo" instead.

## 2026-11-04 — Long agent turns died on the live site

- **Symptom:** on a fresh live account the run stopped three times with "The agent stopped before it could finish" (`stale_run`: the run's heartbeat stopped mid-turn), and the person had to press Continue or send a message each time. The local recording never hit it.
- **Cause:** a time-limit mismatch. The framework stops a hosted agent turn at 40 s and continues it in a fresh request, and its Vercel docs assume the function may run for 300 s, Vercel's default. While debugging signup we had turned Fluid Compute off and capped the function at 60 s, so a slow model call started near the 40 s mark was still running when Vercel killed the function.
- **Path:** turn Fluid Compute back on (it was never the signup cause: the pool of 1 was) and set `maxDuration` to 300 in `scripts/vercel-function-config.mjs`.
- **Guard:** a full run on a fresh live account with no Continue presses.

## 2026-11-04 — Approving while the agent was still talking stalled the run

- **Symptom:** on the live site, approving step 2 while the agent was still finishing its turn left "I've reviewed the waiting step. Carry on with the run." in the chat queue (a "Send now" bar). The turn ended still believing step 2 was waiting, the queued message never went, and the run sat at step 3.
- **Path:** the run view no longer sends that message into a busy chat. It watches `useAgentChatGenerating()` and sends it once the agent has been quiet for 2 s, so the agent reads the run after the decision has landed.
- **Guard:** a scripted local check approves step 2 0.1 s after it appears, mid-turn. The run reached step 4 on its own and no queue bar appeared.

## 2026-11-05 — Fluid Compute starved the database; a stale link showed "Runbook not found"

- **Symptom:** after the 300 s / Fluid deploy, a fresh live run showed "The database is temporarily unavailable" in chat. Separately, signing up straight after logging out landed on "Runbook not found".
- **Cause (database):** Vercel logs showed queries timing out at 8 s (`CONNECT_TIMEOUT`) while one Fluid instance was serving 33 requests through a pool of 5. Before Fluid each request had its own instance and the database was steady.
- **Cause (not found):** sign-in returned the new account to the URL the old account was on, a runbook it doesn't own, and the page had a dead end for a 404.
- **Path:** Fluid off and `maxDuration` back to 60 s, with `agent.runSoftTimeoutMs` at 25 s so a turn hands off with 35 s to spare (the earlier `stale_run` came from a 40 s hand-off inside a 60 s cap). A 404 on a runbook now redirects to `/runbooks`; any other load error shows "Try again".
- **Guard:** a scripted local check opens another account's runbook URL and lands on the account's own runbooks. Live guard: a full fresh-account run with no Continue presses.
