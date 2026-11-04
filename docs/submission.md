# Submission

**Understudy: you don't hand the agent the keys. It earns them, one step at a time.**

## Links

- Demo (public Clip, 2:17): https://clips.agent-native.com/share/F0P4iKgswOlJ
- Live app: https://understudy-drab.vercel.app
- Repo: https://github.com/techbone/understudy

## Paste-ready paragraph

Understudy is for anyone who does the same chore every week and won't trust a bot with all of it. The chore becomes a runbook, and every step sits on a trust ladder: Shadow (the agent drafts, I do it), Approve (the agent does it, I sign off) or Auto (it runs and logs it). After three clean approvals in a row the agent asks to move a step up, and I decide. An edit resets the streak, a reject drops a rung, and any step that emails a client is capped at Approve. The demo is a Monday invoice chase: a real model (Meta Muse Spark 1.3) runs it through actions, the pulling step runs on its own, the exceptions step earns Auto after three approvals, and on the next run it runs unattended while the send step still waits for me. It's built on Agent-Native: the level gate is a `needsApproval` predicate that the framework checks for every caller, the approve and promote actions are UI-only so the agent can't approve itself, and the run timeline updates live as the agent works. A database CHECK keeps high-risk steps off Auto even with raw SQL. To verify it, open the live app, create an account, press "Load the demo" under Runbooks, and press "Run now" with the model left on Muse Spark 1.3. `pnpm e2e` runs the whole ladder against a real Postgres (10 unit tests and 1 end-to-end test pass). What's simplified: the send step writes to a demo outbox and nothing is emailed; the runbook is seeded rather than built from a Clip; a scheduled Monday run and MCP access are not built. The demo video was recorded on a local build of the same code because the live database stalled once while I was recording, and every cut of the agent's working time is labelled on screen.

## Capabilities used

| Agent-Native capability | Where |
|---|---|
| Actions as agent tools and UI mutations | `actions/` |
| `needsApproval` predicate checked on every surface | `actions/perform-step.ts` |
| UI-only actions (the agent can't approve itself) | `decide-step`, `respond-promotion`, `reset-demo` |
| Context awareness (`view-screen`, navigation state) | `actions/view-screen.ts`, `explain-step` |
| Live sync of the run timeline | `app/routes/runbooks.$runbookId.tsx` |
| Deployment-level model config | Vercel env: `OPENAI_BASE_URL`, `AGENT_MODEL` |

## Before submitting

- [ ] Clip is Public and plays in a private window at 1x
- [ ] Repo is public and the README renders
- [ ] Live app: sign up with a fresh email, Load the demo, Run now
- [ ] Meta credit balance is topped up
