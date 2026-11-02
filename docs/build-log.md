# Build log

Surprises from the framework and our code: the dead end, the path we chose, and the test that guards it.

## 2026-11-02 — The gate has to be the framework's, not ours

- **Dead end:** putting "don't act above your level" in the system prompt. A prompt is a suggestion, and an MCP client never sees it.
- **Path:** `defineAction({ needsApproval })` accepts a predicate `(args, ctx) => boolean | Promise<boolean>`, and `preparedCallNeedsApproval` checks it on every surface (agent loop, MCP, HTTP). `perform-step` reads the step's earned level from the DB, so the gate and the ladder share one source of truth. A predicate that throws fails closed and asks.
- **Guard:** `server/lib/trust.spec.ts` (ladder rules) plus the e2e "gate holds" check.

## 2026-11-02 — The agent must not be able to approve itself

- **Path:** `decide-step` and `respond-promotion` set `toolCallable: false`, so they exist for the UI (and HTTP) but are never offered to the agent as tools.
