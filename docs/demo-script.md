# Demo script (as recorded, 2:17)

Published: https://clips.agent-native.com/share/F0P4iKgswOlJ

Recorded with a scripted browser (Playwright, 1440x900, dark theme) on a local build of this code with the real Muse Spark 1.3 model, on a fresh database. The first take on the live site hit a database stall, so the final take is local. An agent turn takes 25 to 70 seconds and costs about $0.17 to $0.19. Nothing is sped up: long agent turns are cut, and each cut is labelled on screen ("Cut: the agent worked for Ns").

## Before every take

1. Fresh account (or **Reset demo data** from the runbook's ... menu), then **Load the demo**. Seed state: Pull, Draft and Log on Auto, Exceptions on Approve at 2/3, Send on Approve (capped), Escalate on Shadow at 1/3.
2. Outbox empty, chat clear, model on Muse Spark 1.3, account under its $5 spend cap.
3. One action at a time: never click Run now or Approve while the agent is working.

## Shots

| Time | Screen | Narration | What must be true |
|---|---|---|---|
| 0:00 | Runbook, cursor walks the ladder | "Every Monday I chase overdue invoices. In Understudy that chore is a runbook: six steps, each at a level it has earned." | Six rungs, lock on Send |
| 0:13 | Ladder | "Shadow: it suggests and I do it. Approve: it does it and I sign off. Auto: it just runs and logs it." | |
| 0:22 | Click **Run now** | "Let's run this week." | Chat opens and streams |
| 0:28 | Run view (after a 19 s cut) | "Pulling invoices is on Auto, so it just happened. Checking exceptions isn't, so it stopped and waits for me." | Step 1 "Ran on its own", step 2 "Needs your OK" |
| 0:37 | Approve step 2 | "Its call looks right, so I approve. That's three clean approvals in a row, so it asks me to move up. It never promotes itself. I decide." | Promotion offer on step 2 |
| 0:50 | Click **Promote** | "Promote." | Step 2 shows Auto |
| 0:58 | Step 4 (after a 15 s cut) | "It drafted the reminders on its own. Sending is different. It emails clients, so it's capped at Approve." | Step 4 "Needs your OK", lock visible |
| 1:07 | Edit Fable's reminder, add a P.S. | "I'll soften Fable's note. An edit resets the streak, so trust is only earned on work I didn't have to fix." | Text appended at the end |
| 1:17 | **Approve** | "Approve." | "Approved with edits" |
| 1:24 | Step 6 (after a 41 s cut) | "Escalating to the founder is still Shadow. It drafts it, I do it." | Step 6 "Your step", then Done |
| 1:35 | Outbox | "Nothing really leaves the app. This outbox stands in for the billing inbox." | Three reminders and the escalation |
| 1:44 | Back to the runbook, **Run now** | "Next Monday." | |
| 1:54 | Run view (after a cut) | "This time exceptions ran on its own. It earned that. The step that emails clients still waits for me." | Step 2 "Ran on its own", step 4 waiting |
| 2:04 | Evidence drawer for step 2 | "And every level links to the evidence that earned it, approval by approval." | Ledger lists the promotion and approvals |
| 2:10 | End card with the live URL | "Understudy. Show it once. Let it earn the rest." | |

## Not in this video

- **The gate under pressure** ("just send them all now" in chat, or a call over MCP). It's covered by the e2e check "gate: perform-step on an Approve step needs a human", and hasn't been recorded.
- **Building the runbook from a Clip.** It isn't built. The demo runbook is seeded.

## How it was made

- `record.mjs` drives the browser, injects a visible cursor and the short on-screen labels, and writes a timestamp for each moment.
- `edit.mjs` cuts the agent's waits using those timestamps, and labels every cut.
- The voice is one take, split per line and placed at each line's moment, with the level normalised.
- The Clip's transcript is uploaded from the same text, with misheard product words corrected (runbook, auto, earned).
