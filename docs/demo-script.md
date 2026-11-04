# Demo script (target 2:30)

Shot list: time, screen, narration, and what must be true before recording.
Timings come from real runs of Muse Spark 1.3 on the live site (an agent turn takes 25-55 s, about $0.17-0.19). Nothing is sped up. Where a turn is long, the video cuts to the result and says "cut" on screen.

## Before every take

1. Sign in, open the runbook, menu (...) then **Reset demo data**. This puts every step back where the seed history left it: Pull, Draft and Log on Auto, Exceptions on Approve at 2/3, Send on Approve (capped), Escalate on Shadow at 1/3.
2. Outbox is empty after reset. Chat history is clear.
3. Model is Muse Spark 1.3. The account is under its spend cap (Settings > usage).
4. One action at a time: never click Run now or Approve while the agent is still working, or the turn is cut off.

## Shots

| Time | Screen | Narration | Precondition / what to verify |
|---|---|---|---|
| 0:00 | Runbook page, ladder visible | "Every Monday I chase overdue invoices. I showed Understudy once. Now each step sits where it has earned." | Reset done; ladder shows the six rungs and the lock on Send |
| 0:15 | Click **Run now**; chat streams, step 1 fills in | "Pulling invoices is Auto, so it just happens. The next step it hasn't earned, so it stops and waits for me." | Real run, about 35 s; step 2 shows "Needs your OK" |
| 0:45 | Approve step 2 | "That's three clean approvals in a row, so it asks to move up. It never promotes itself." | Promotion banner appears on step 2 |
| 1:00 | Click **Promote** | "I accept. Exceptions is now Auto." | Step 2 shows Auto |
| 1:10 | Click **Run now** again | "Next Monday: it checks exceptions on its own, drafts the reminders on its own, and stops at the first step that messages a client." | About 35 s; step 4 shows "Needs your OK" (cut to result) |
| 1:35 | Edit one reminder's wording, then **Approve** | "I soften Fable's tone. An edit resets that step's streak. Send can never go above Approve, because it messages clients." | Streak on step 4 resets; lock icon visible |
| 1:55 | Outbox | "Nothing really leaves the app. This outbox stands in for the billing inbox." | Reminders and the founder escalation are listed |
| 2:05 | Chat: "just send them all now" | "Even if I ask the agent to skip approval, the framework's gate stops it. That gate is in the action, not in a prompt." | VERIFY on the live site before recording; see the e2e check "gate holds" |
| 2:20 | Click a step, evidence drawer | "Every level links to the approvals that earned it." | `?step=<id>` opens evidence |
| 2:30 | Clip, then runbook | "And it all started from one recording." | Pending: Clip import (M2) needs the public Clip link |

## Recording

- Browser capture of the live site, 1440x900, no browser chrome clutter, light cursor highlight.
- Captions are burned in from `docs/demo-captions.txt`, one line per shot, describing what is on screen.
- Voice is added afterwards from the narration column.
- If the model does not work for a fresh account on the live site, record on a local build of the same code with the real Muse Spark model, and say so on screen.
