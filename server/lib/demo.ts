import { eq } from "drizzle-orm";

import { getDb, schema } from "../db/index.js";
import type { Scope } from "./runbook.js";
import type { Level, TrustEventKind } from "./trust.js";

// A fictional agency ("Northlane Studio", .test addresses) so the demo never
// touches a real inbox. History is three past Monday runs plus older ledger
// rows that explain every step's current level.

export const FOUNDER_EMAIL = "founder@northlane.test";
export const BILLING_EMAIL = "billing@northlane.test";

export const DEMO_TRANSCRIPT = `0:00 Every Monday morning I chase overdue invoices. Here's exactly how I do it.
0:08 First I open invoices and filter to anything open and past its due date.
0:21 Then I check the client notes. Some clients have exceptions. Right now Acme's AP contact is on leave until the tenth, so I don't chase Acme this week.
0:40 Anything at least seven days overdue gets a reminder. Under three weeks, friendly. Three weeks or more, firmer, with the invoice number and amount. Fable is a key account, so I keep that one warm no matter what. No late-fee language with them.
1:05 I send the reminders from the billing inbox.
1:15 Then I log what I did against each invoice so the team can see it.
1:25 Anything forty-five days or more I don't chase myself. I flag it to the founder so they can call the client.`;

const DAY = 24 * 60 * 60 * 1000;

type StepRunStatus = (typeof schema.stepRuns.$inferInsert)["status"];

function daysFromNow(days: number) {
  return new Date(Date.now() + days * DAY);
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

interface SeedStep {
  key: string;
  title: string;
  instruction: string;
  effect: "note" | "send_emails" | "log" | "escalate";
  risk: "low" | "high";
  level: Level;
  streak: number;
  clipAt: string;
  /** Status of this step in the runs 3, 2 and 1 weeks ago (null = not yet in the runbook). */
  pastRuns: [string | null, string | null, string | null];
  /** Older ledger rows, weeks ago → kind. */
  ledger: [number, TrustEventKind, Level, Level, string | null][];
}

const STEPS: SeedStep[] = [
  {
    key: "pull",
    title: "Pull overdue invoices",
    instruction:
      "List every open invoice past its due date with days overdue, amount and reminders already sent. Ignore paid invoices.",
    effect: "note",
    risk: "low",
    level: "auto",
    streak: 0,
    clipAt: "0:08",
    pastRuns: ["auto_done", "auto_done", "auto_done"],
    ledger: [
      [7, "clean_approval", "approve", "approve", null],
      [6, "clean_approval", "approve", "approve", null],
      [5, "clean_approval", "approve", "approve", null],
      [5, "promotion_offered", "approve", "auto", null],
      [5, "promoted", "approve", "auto", null],
    ],
  },
  {
    key: "exceptions",
    title: "Check client exceptions",
    instruction:
      "Read the client notes. Say which overdue invoices to skip this week and why, and which need special handling.",
    effect: "note",
    risk: "low",
    level: "approve",
    streak: 2,
    clipAt: "0:21",
    pastRuns: ["edited", "approved", "approved"],
    ledger: [
      [7, "clean_approval", "shadow", "shadow", null],
      [6, "clean_approval", "shadow", "shadow", null],
      [5, "clean_approval", "shadow", "shadow", null],
      [5, "promotion_offered", "shadow", "approve", null],
      [5, "promoted", "shadow", "approve", null],
    ],
  },
  {
    key: "draft",
    title: "Draft reminders",
    instruction:
      "Draft one reminder per invoice that is 7–44 days overdue and not skipped. Friendly under 21 days; firmer from 21, with invoice number and amount. Key accounts stay warm with no late-fee language.",
    effect: "note",
    risk: "low",
    level: "auto",
    streak: 0,
    clipAt: "0:40",
    pastRuns: ["auto_done", "auto_done", "auto_done"],
    ledger: [
      [6, "clean_approval", "approve", "approve", null],
      [5, "clean_approval", "approve", "approve", null],
      [4, "clean_approval", "approve", "approve", null],
      [4, "promotion_offered", "approve", "auto", null],
      [4, "promoted", "approve", "auto", null],
    ],
  },
  {
    key: "send",
    title: "Send reminders",
    instruction: `Send the drafted reminders to each client's billing contact from ${BILLING_EMAIL}.`,
    effect: "send_emails",
    risk: "high",
    level: "approve",
    streak: 7,
    clipAt: "1:05",
    pastRuns: ["approved", "approved", "approved"],
    ledger: [
      [7, "clean_approval", "approve", "approve", null],
      [6, "clean_approval", "approve", "approve", null],
      [5, "clean_approval", "approve", "approve", null],
      [4, "clean_approval", "approve", "approve", null],
    ],
  },
  {
    key: "log",
    title: "Log in the AR tracker",
    instruction:
      "Add one line per invoice touched today: reminded, skipped (with reason) or escalated.",
    effect: "log",
    risk: "low",
    level: "auto",
    streak: 0,
    clipAt: "1:15",
    pastRuns: ["auto_done", "auto_done", "auto_done"],
    ledger: [
      [7, "clean_approval", "approve", "approve", null],
      [6, "clean_approval", "approve", "approve", null],
      [5, "clean_approval", "approve", "approve", null],
      [5, "promotion_offered", "approve", "auto", null],
      [5, "promoted", "approve", "auto", null],
    ],
  },
  {
    key: "escalate",
    title: "Escalate 45+ days to the founder",
    instruction: `Email ${FOUNDER_EMAIL} one summary of every invoice 45+ days overdue: client, contact, amount, days overdue and reminders sent, so they can call.`,
    effect: "escalate",
    risk: "low",
    level: "shadow",
    streak: 1,
    clipAt: "1:25",
    pastRuns: [null, "human_done:edit", "human_done"],
    ledger: [],
  },
];

const INVOICES = [
  [
    "INV-1041",
    "Acme Logistics",
    "Dana Whitfield",
    "dana@acme-logistics.test",
    480000,
    -12,
    1,
  ],
  [
    "INV-1038",
    "Brightline Health",
    "Omar Reyes",
    "omar@brightline.test",
    215000,
    -34,
    2,
  ],
  [
    "INV-1044",
    "Corvid Studio",
    "Priya Nair",
    "priya@corvid.test",
    95000,
    -8,
    0,
  ],
  [
    "INV-1029",
    "Dunmore & Sons",
    "Hal Dunmore",
    "hal@dunmore.test",
    740000,
    -52,
    3,
  ],
  [
    "INV-1046",
    "Elmwood Dental",
    "Sam Ortiz",
    "sam@elmwood.test",
    120000,
    -3,
    0,
  ],
  ["INV-1040", "Fable & Co", "Jo Mercer", "jo@fableco.test", 330000, -21, 1],
] as const;

function pastProposal(key: string, weeksAgo: number) {
  const n = 1030 + weeksAgo;
  switch (key) {
    case "pull":
      return {
        summary: `${weeksAgo + 2} open invoices past due.`,
        items: [
          {
            label: `INV-${n}`,
            detail: `${10 + weeksAgo * 6} days overdue, $${(2.4 + weeksAgo / 2).toFixed(2)}k`,
          },
          {
            label: "INV-1029",
            detail: `${52 - weeksAgo * 7} days overdue, $7.40k`,
          },
        ],
      };
    case "exceptions":
      return {
        summary: "Skip Acme while their AP contact is away. Keep Fable warm.",
        items: [
          { label: "Acme Logistics", detail: "Skip: AP contact on leave." },
          {
            label: "Fable & Co",
            detail: "Key account: warm tone, no late-fee language.",
          },
        ],
      };
    case "draft":
      return {
        summary: "2 reminders drafted.",
        items: [
          {
            label: `INV-${n}`,
            detail: "Friendly nudge with the invoice number and amount.",
          },
          { label: "INV-1040", detail: "Warm check-in, no late-fee language." },
        ],
      };
    case "send":
      return {
        emails: [
          {
            invoiceId: `INV-${n}`,
            to: "omar@brightline.test",
            subject: `A quick nudge on INV-${n}`,
            body: "Hi Omar, a friendly reminder that this invoice is now past due. Could you let me know when to expect payment?",
          },
        ],
      };
    case "log":
      return {
        entries: [
          { invoiceId: `INV-${n}`, note: "Reminded." },
          { invoiceId: "INV-1041", note: "Skipped: AP on leave." },
        ],
      };
    default:
      return {
        to: FOUNDER_EMAIL,
        subject: "Dunmore & Sons: 45+ days overdue",
        body: "INV-1029, $7,400.00, 3 reminders sent. Hal Dunmore, hal@dunmore.test.",
      };
  }
}

export async function resetDemo(scope: Scope) {
  const db = getDb();
  return db.transaction(async (tx) => {
    for (const table of [
      schema.trustEvents,
      schema.stepRuns,
      schema.runs,
      schema.runbookSteps,
      schema.runbooks,
      schema.outbox,
      schema.arLog,
      schema.invoices,
      schema.clientNotes,
    ]) {
      await tx.delete(table).where(eq(table.ownerEmail, scope.email));
    }

    const owner = { ownerEmail: scope.email, orgId: scope.orgId };
    const runbookId = crypto.randomUUID();
    await tx.insert(schema.runbooks).values({
      id: runbookId,
      title: "Monday invoice chase",
      summary:
        "Chase every invoice 7+ days overdue, respect client exceptions, escalate 45+ days to the founder.",
      clipUrl: null,
      transcript: DEMO_TRANSCRIPT,
      schedule: "0 9 * * 1",
      createdAt: daysFromNow(-56).toISOString(),
      ...owner,
    });

    const pastRuns = [3, 2, 1].map((weeksAgo) => ({
      id: crypto.randomUUID(),
      weeksAgo,
    }));
    await tx.insert(schema.runs).values(
      pastRuns.map(({ id, weeksAgo }) => ({
        id,
        runbookId,
        trigger: "schedule" as const,
        status: "done" as const,
        startedAt: daysFromNow(-7 * weeksAgo).toISOString(),
        finishedAt: new Date(
          daysFromNow(-7 * weeksAgo).getTime() + 20 * 60_000,
        ).toISOString(),
        ...owner,
      })),
    );

    for (const [position, step] of STEPS.entries()) {
      const stepId = crypto.randomUUID();
      await tx.insert(schema.runbookSteps).values({
        id: stepId,
        runbookId,
        position: position + 1,
        title: step.title,
        instruction: step.instruction,
        effect: step.effect,
        risk: step.risk,
        level: step.level,
        streak: step.streak,
        threshold: 3,
        promotionOfferedAt: null,
        clipAt: step.clipAt,
        ...owner,
      });

      const events: (typeof schema.trustEvents.$inferInsert)[] =
        step.ledger.map(([weeksAgo, kind, fromLevel, toLevel, note]) => ({
          id: crypto.randomUUID(),
          stepId,
          stepRunId: null,
          kind,
          fromLevel,
          toLevel,
          note,
          createdAt: daysFromNow(-7 * weeksAgo).toISOString(),
          ...owner,
        }));

      for (const [index, past] of step.pastRuns.entries()) {
        const pastRun = pastRuns[index];
        if (!past || !pastRun) continue;
        const { weeksAgo } = pastRun;
        const [status, flavour] = past.split(":") as [
          StepRunStatus,
          string | undefined,
        ];
        const at = new Date(
          daysFromNow(-7 * weeksAgo).getTime() + (position + 1) * 60_000,
        ).toISOString();
        const stepRunId = crypto.randomUUID();
        const levelAtRun: Level =
          status === "auto_done"
            ? "auto"
            : status === "human_done"
              ? "shadow"
              : "approve";
        const proposal = JSON.stringify(pastProposal(step.key, weeksAgo));
        await tx.insert(schema.stepRuns).values({
          id: stepRunId,
          runId: pastRun.id,
          stepId,
          levelAtRun,
          status,
          proposal,
          final: proposal,
          feedback:
            status === "edited"
              ? "Skipped Brightline too: they replied Friday promising payment."
              : flavour === "edit"
                ? "Include the client's phone number so the founder can call straight away."
                : null,
          createdAt: at,
          decidedAt: at,
          ...owner,
        });
        if (status === "auto_done") continue;
        const edited = status === "edited" || flavour === "edit";
        events.push({
          id: crypto.randomUUID(),
          stepId,
          stepRunId,
          kind: edited ? "edit" : "clean_approval",
          fromLevel: levelAtRun,
          toLevel: levelAtRun,
          note: null,
          createdAt: at,
          ...owner,
        });
      }
      if (events.length) await tx.insert(schema.trustEvents).values(events);
    }

    await tx.insert(schema.invoices).values([
      ...INVOICES.map(
        ([
          number,
          client,
          contactName,
          contactEmail,
          amountCents,
          dueIn,
          remindersSent,
        ]) => ({
          id: crypto.randomUUID(),
          number,
          client,
          contactName,
          contactEmail,
          amountCents,
          dueOn: dateOnly(daysFromNow(dueIn)),
          status: "open" as const,
          remindersSent,
          lastRemindedAt: remindersSent ? daysFromNow(-7).toISOString() : null,
          ...owner,
        }),
      ),
      {
        id: crypto.randomUUID(),
        number: "INV-1035",
        client: "Gristmill Coffee",
        contactName: "Lena Brooks",
        contactEmail: "lena@gristmill.test",
        amountCents: 64000,
        dueOn: dateOnly(daysFromNow(-15)),
        status: "paid" as const,
        remindersSent: 1,
        lastRemindedAt: daysFromNow(-8).toISOString(),
        ...owner,
      },
    ]);

    const leaveEnds = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(daysFromNow(8));
    await tx.insert(schema.clientNotes).values(
      (
        [
          [
            "Acme Logistics",
            `AP contact Dana is on leave until ${leaveEnds}. Don't chase before then.`,
          ],
          [
            "Fable & Co",
            "Key account, renewal talks in progress. Keep it warm. No late-fee language.",
          ],
          [
            "Dunmore & Sons",
            "Founder knows Hal personally and prefers to call him.",
          ],
        ] as const
      ).map(([client, note]) => ({
        id: crypto.randomUUID(),
        client,
        note,
        ...owner,
      })),
    );

    return { runbookId };
  });
}
