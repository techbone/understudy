// End to end: one Monday run of the seeded runbook through the real actions,
// against an in-memory Postgres. Covers every rung move the demo shows and the
// gate that keeps the agent below its earned level.
import type { ActionRunContext } from "@agent-native/core/action";
import {
  closeDbExec,
  getDbExec,
  withMigrationRuntime,
} from "@agent-native/core/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import decideStep from "../actions/decide-step.js";
import getRunbook from "../actions/get-runbook.js";
import listInvoices from "../actions/list-invoices.js";
import listOutbox from "../actions/list-outbox.js";
import performStep from "../actions/perform-step.js";
import resetDemo from "../actions/reset-demo.js";
import respondPromotion from "../actions/respond-promotion.js";
import startRun from "../actions/start-run.js";
import submitStep from "../actions/submit-step.js";

const ctx = {
  userEmail: "e2e@understudy.test",
  orgId: null,
  caller: "frontend",
} as ActionRunContext;
const log: string[] = [];
const note = (line: string) => {
  log.push(line);
  console.log(`  ✓ ${line}`);
};

async function failure(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error as { errorCode?: string; message: string };
  }
  throw new Error("expected the call to fail");
}

beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "pglite:memory://");
  vi.stubEnv("DATABASE_URL_UNPOOLED", "pglite:memory://");
  const { runUnderstudyMigrations } = await import("../server/plugins/db.js");
  await withMigrationRuntime(() =>
    (runUnderstudyMigrations as unknown as (app: object) => Promise<void>)({}),
  );
});

afterAll(async () => {
  await closeDbExec();
  vi.unstubAllEnvs();
});

describe("Monday invoice chase", () => {
  it("moves the trust ladder up and down on evidence, and the gate holds", async () => {
    const { runbookId } = await resetDemo.run({}, ctx);
    const before = await getRunbook.run({ runbookId }, ctx);
    const step = (n: number) => {
      const found = before.steps[n - 1];
      if (!found) throw new Error(`no step ${n}`);
      return found;
    };
    expect(before.steps.map((s) => s.level)).toEqual([
      "auto",
      "approve",
      "auto",
      "approve",
      "auto",
      "shadow",
    ]);
    expect(step(2).streak).toBe(2);
    note(
      "seeded runbook: 6 steps, levels auto/approve/auto/approve/auto/shadow, step 2 streak 2/3",
    );

    const { runId } = await startRun.run({ runbookId, trigger: "manual" }, ctx);

    const { invoices } = await listInvoices.run({ includePaid: false }, ctx);
    const overdue = invoices.filter((i) => i.daysOverdue >= 7);
    expect(overdue.map((i) => i.number).sort()).toEqual([
      "INV-1029",
      "INV-1038",
      "INV-1040",
      "INV-1041",
      "INV-1044",
    ]);

    const s1 = await submitStep.run(
      {
        runId,
        stepId: step(1).id,
        output: {
          summary: "5 invoices 7+ days overdue.",
          items: overdue.map((i) => ({
            label: i.number,
            detail: `${i.daysOverdue} days`,
          })),
        },
      },
      ctx,
    );
    expect(s1.status).toBe("auto_done");
    note("step 1 (Auto) ran unattended");

    const outOfOrder = await failure(
      submitStep.run(
        { runId, stepId: step(3).id, output: { summary: "x", items: [] } },
        ctx,
      ),
    );
    expect(outOfOrder.errorCode).toBe("out_of_order");

    const s2 = await submitStep.run(
      {
        runId,
        stepId: step(2).id,
        output: {
          summary:
            "Skip Acme (AP on leave). Keep Fable warm. Dunmore goes to the founder.",
          items: [],
        },
      },
      ctx,
    );
    expect(s2.status).toBe("proposed");
    const blocked = await failure(
      submitStep.run(
        { runId, stepId: step(3).id, output: { summary: "x", items: [] } },
        ctx,
      ),
    );
    expect(blocked.errorCode).toBe("waiting_on_person");
    note(
      "step 2 (Approve) waits for the person; step 3 refused with waiting_on_person",
    );

    expect(
      await performStep.needsApproval?.({ stepRunId: s2.stepRunId }, ctx),
    ).toBe(true);
    note(
      "gate: perform-step on an Approve step needs a human (needsApproval predicate = true)",
    );

    const d2 = await decideStep.run(
      { stepRunId: s2.stepRunId, decision: "approve" },
      ctx,
    );
    expect(d2).toMatchObject({
      status: "approved",
      streak: 3,
      promotionOffered: true,
    });
    note(
      "step 2 approved unchanged: streak 3/3, promotion offered (not applied)",
    );

    const p2 = await respondPromotion.run(
      { stepId: step(2).id, accept: true },
      ctx,
    );
    expect(p2.level).toBe("auto");
    note("person accepted: step 2 promoted Approve → Auto");

    const fableDraft =
      "Hi Jo, a quick nudge on INV-1040 ($3,300). Pay now to avoid a late fee.";
    const s3 = await submitStep.run(
      {
        runId,
        stepId: step(3).id,
        output: {
          summary: "3 drafts",
          items: [{ label: "INV-1040", detail: fableDraft }],
        },
      },
      ctx,
    );
    expect(s3.status).toBe("auto_done");
    const c3 = await decideStep.run(
      {
        stepRunId: s3.stepRunId,
        decision: "correct",
        output: {
          summary: "3 drafts",
          items: [
            {
              label: "INV-1040",
              detail:
                "Hi Jo, hope the renewal planning is going well. Could you check where INV-1040 is?",
            },
          ],
        },
        feedback: "Fable is a key account. No late-fee language.",
      },
      ctx,
    );
    expect(c3).toMatchObject({
      status: "corrected",
      level: "approve",
      streak: 0,
    });
    note(
      "step 3 (Auto) corrected after the fact: demoted Auto → Approve, streak reset",
    );

    const fable = overdue.find((i) => i.number === "INV-1040");
    const brightline = overdue.find((i) => i.number === "INV-1038");
    if (!fable || !brightline) throw new Error("seed changed");
    const emails = [
      {
        invoiceId: brightline.id,
        to: brightline.contactEmail,
        subject: "INV-1038 is 34 days overdue",
        body: "Hi Omar, INV-1038 for $2,150.00 is now 34 days overdue.",
      },
      {
        invoiceId: fable.id,
        to: fable.contactEmail,
        subject: "Checking in on INV-1040",
        body: fableDraft,
      },
    ];
    const s4 = await submitStep.run(
      { runId, stepId: step(4).id, output: { emails } },
      ctx,
    );
    expect(s4.status).toBe("proposed");
    expect(
      await performStep.needsApproval?.({ stepRunId: s4.stepRunId }, ctx),
    ).toBe(true);
    const edited = [
      emails[0],
      {
        ...emails[1],
        body: "Hi Jo, could you check where INV-1040 is when you get a moment?",
      },
    ];
    const d4 = await decideStep.run(
      {
        stepRunId: s4.stepRunId,
        decision: "approve",
        output: { emails: edited },
      },
      ctx,
    );
    expect(d4).toMatchObject({ status: "edited", level: "approve", streak: 0 });
    const { messages } = await listOutbox.run({}, ctx);
    expect(messages).toHaveLength(2);
    expect(
      messages.find((m) => m.to === fable.contactEmail)?.body,
    ).not.toContain("late fee");
    note(
      "step 4 (Send, capped) sent the person's edited version to the mock outbox; edit reset its streak",
    );

    const s5 = await submitStep.run(
      {
        runId,
        stepId: step(5).id,
        output: {
          entries: [
            { invoiceId: brightline.id, note: "Reminded." },
            { invoiceId: fable.id, note: "Reminded, warm tone." },
          ],
        },
      },
      ctx,
    );
    expect(s5.status).toBe("auto_done");

    const s6 = await submitStep.run(
      {
        runId,
        stepId: step(6).id,
        output: {
          to: "founder@northlane.test",
          subject: "Dunmore & Sons: 52 days",
          body: "INV-1029, $7,400.00, 3 reminders. Hal Dunmore.",
        },
      },
      ctx,
    );
    expect(s6.status).toBe("suggested");
    const d6 = await decideStep.run(
      { stepRunId: s6.stepRunId, decision: "approve" },
      ctx,
    );
    expect(d6).toMatchObject({
      status: "human_done",
      runStatus: "done",
      streak: 2,
    });
    note(
      "step 6 (Shadow) done by the person with the agent's suggestion: streak 2/3; run done",
    );

    const reject = await failure(
      decideStep.run({ stepRunId: s4.stepRunId, decision: "approve" }, ctx),
    );
    expect(reject.errorCode).toBe("not_pending");

    const cap = await failure(
      getDbExec().execute({
        sql: "UPDATE runbook_steps SET level = 'auto' WHERE id = ?",
        args: [step(4).id],
      }),
    );
    expect(cap.message).toMatch(/check/i);
    note(
      "database CHECK refuses to put a high-risk step on Auto, even with raw SQL",
    );

    const after = await getRunbook.run({ runbookId }, ctx);
    expect(after.steps.map((s) => s.level)).toEqual([
      "auto",
      "auto",
      "approve",
      "approve",
      "auto",
      "shadow",
    ]);
    expect(after.latestRun?.status).toBe("done");
    note("final ladder: auto/auto/approve/approve/auto/shadow");
  });
});
