# Launch thread (draft)

For X or LinkedIn. One post per block; each is under 280 characters. Attach the demo video or the thumbnail (`docs/evidence/demo-thumb.png`) to post 1. Tag Builder.io's official account when you post.

---

**1**
Every Monday someone at a small agency chases overdue invoices by hand. They'd automate it, but not by handing a bot their client relationships all at once.

So I built Understudy: the agent doesn't get the keys. It earns them, one step at a time. 🧵

**2**
Each step of a chore sits on a trust ladder:
Shadow: the agent drafts, I do it.
Approve: it does it, I sign off.
Auto: it runs and logs it.

Three clean approvals in a row and it asks to move up. It never promotes itself.

**3**
Trust has to be easy to lose. An edit resets the streak. A reject drops a rung. An Auto step I correct goes back to Approve.

And anything that emails a client is capped at Approve, however good its record. A database CHECK enforces that, even against raw SQL.

**4**
Built on Builder.io's Agent-Native framework. The gate isn't in a prompt: it's a needsApproval predicate on the action, which the framework checks for every caller. The approve buttons are UI-only actions, so the agent can't approve itself.

**5**
The hard bug: signup worked on my laptop and died on Vercel with CONNECTION_ENDED. On serverless the framework's Postgres pool was 1 connection. One startup query held it, everything else timed out, and the pool closed.

A post-build patch raises it to 5. 10.7 s to 1.2 s.

**6**
The agent is a real model, Meta Muse Spark 1.3, calling the app's actions. About $0.18 a run. The only mock is the outbox, which stands in for email.

Not built yet: drafting the runbook from a recorded Clip, and a scheduled Monday run.

**7**
Try it: understudy-drab.vercel.app (sign up, Runbooks, Load the demo, Run now)
Demo: https://clips.agent-native.com/share/F0P4iKgswOlJ
Code: https://github.com/techbone/understudy

Built for the Builder.io Agent-Native Hackathon.
