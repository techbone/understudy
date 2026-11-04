# Recording the chore in Clips

The runbook was built from one recording of the Monday invoice chase. This folder holds the props for that recording, so the Clip matches the seeded demo exactly.

1. Import `invoices.csv` and `client-notes.csv` into a Google Sheet (one tab each). These are the same invoices and notes the demo seeds.
2. Open a blank email draft from a billing address in another tab.
3. Record at https://clips.agent-native.com and read the script below while doing each step on screen (about 1:30).
4. Share the clip as **Public** and copy its share link.

Script (from `DEMO_TRANSCRIPT` in `server/lib/demo.ts`; the timestamps are where each runbook step links back to the Clip):

| At | Say | On screen |
|---|---|---|
| 0:00 | Every Monday morning I chase overdue invoices. Here's exactly how I do it. | The invoices tab |
| 0:08 | First I open invoices and filter to anything open and past its due date. | Filter Status = Open, sort by days overdue |
| 0:21 | Then I check the client notes. Some clients have exceptions. Right now Acme's AP contact is on leave, so I don't chase Acme this week. | The client notes tab |
| 0:40 | Anything at least seven days overdue gets a reminder. Under three weeks, friendly. Three weeks or more, firmer, with the invoice number and amount. Fable is a key account, so I keep that one warm no matter what. No late-fee language with them. | Point at the days overdue column |
| 1:05 | I send the reminders from the billing inbox. | Type one reminder in the draft |
| 1:15 | Then I log what I did against each invoice so the team can see it. | Fill the Last action column |
| 1:25 | Anything forty-five days or more I don't chase myself. I flag it to the founder so they can call the client. | Point at INV-1029 |
