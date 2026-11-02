import { defineAction, fail } from "@agent-native/core/action";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import {
  executeEffect,
  getStep,
  nowIso,
  parsePayload,
  PENDING,
  refreshRunStatus,
  scopeOf,
} from "../server/lib/runbook.js";
import { runsUnattended } from "../server/lib/trust.js";

export default defineAction({
  description: `Hand over your output for one runbook step. The server applies the step's earned trust level:
- auto: carried out now and logged.
- approve: saved as a proposal; the person approves, edits or rejects it in the run view.
- shadow: saved as a suggestion; the person does the step themselves.
Steps go in order: a step waits until every earlier step is resolved (errorCode waiting_on_person). When that happens, stop and tell the person which step needs them. Never ask them to approve in chat instead.
output shape by step effect: note → {summary, items:[{label, detail}]}; send_emails → {emails:[{invoiceId, to, subject, body}]}; log → {entries:[{invoiceId, note}]}; escalate → {to, subject, body}.`,
  schema: z.object({
    runId: z.string().describe("Run id from start-run"),
    stepId: z.string().describe("Step id from start-run"),
    output: z
      .record(z.string(), z.unknown())
      .describe("The step's output, shaped by its effect (see description)"),
  }),
  run: async ({ runId, stepId, output }, ctx) => {
    const scope = scopeOf(ctx);
    const db = getDb();
    const result = await db.transaction(async (tx) => {
      const [run] = await tx
        .select()
        .from(schema.runs)
        .where(
          and(
            eq(schema.runs.id, runId),
            eq(schema.runs.ownerEmail, scope.email),
          ),
        )
        .for("update");
      if (!run)
        fail("Run not found.", { errorCode: "not_found", statusCode: 404 });
      if (run.status === "done")
        fail("This run is finished. Start a new one.", {
          errorCode: "run_finished",
          statusCode: 409,
        });

      const step = await getStep(tx, scope, stepId);
      if (step.runbookId !== run.runbookId)
        fail("That step belongs to another runbook.", {
          errorCode: "wrong_runbook",
          statusCode: 400,
        });

      const steps = await tx
        .select({
          id: schema.runbookSteps.id,
          position: schema.runbookSteps.position,
          title: schema.runbookSteps.title,
        })
        .from(schema.runbookSteps)
        .where(eq(schema.runbookSteps.runbookId, run.runbookId))
        .orderBy(asc(schema.runbookSteps.position));
      const submitted = await tx
        .select({
          stepId: schema.stepRuns.stepId,
          status: schema.stepRuns.status,
        })
        .from(schema.stepRuns)
        .where(eq(schema.stepRuns.runId, runId));
      if (submitted.some((row) => row.stepId === stepId)) {
        fail(`"${step.title}" was already submitted in this run.`, {
          errorCode: "already_submitted",
          statusCode: 409,
        });
      }
      for (const earlier of steps.filter((s) => s.position < step.position)) {
        const row = submitted.find((r) => r.stepId === earlier.id);
        if (!row) {
          fail(`Do step ${earlier.position} "${earlier.title}" first.`, {
            errorCode: "out_of_order",
            statusCode: 409,
          });
        }
        if ((PENDING as readonly string[]).includes(row.status)) {
          fail(
            `Waiting on the person to review step ${earlier.position} "${earlier.title}" in the run view.`,
            {
              errorCode: "waiting_on_person",
              statusCode: 409,
            },
          );
        }
      }

      const payload = parsePayload(step.effect, output);
      const unattended = runsUnattended(step);
      const stepRunId = crypto.randomUUID();
      const status = unattended
        ? "auto_done"
        : step.level === "approve"
          ? "proposed"
          : "suggested";
      const at = nowIso();
      await tx.insert(schema.stepRuns).values({
        id: stepRunId,
        runId,
        stepId,
        levelAtRun: step.level,
        status,
        proposal: JSON.stringify(payload),
        final: unattended ? JSON.stringify(payload) : null,
        feedback: null,
        createdAt: at,
        decidedAt: unattended ? at : null,
        ownerEmail: scope.email,
        orgId: scope.orgId,
      });
      if (unattended)
        await executeEffect(tx, scope, step, runId, stepRunId, payload);
      const runStatus = await refreshRunStatus(tx, runId);
      return { stepRunId, status, level: step.level, runStatus };
    });
    const next =
      result.status === "auto_done"
        ? "Done and logged. Continue with the next step."
        : result.status === "proposed"
          ? "Saved for review. Stop here and tell the person this step is waiting for them in the run view."
          : "Saved as a suggestion. Stop here: the person does this step themselves in the run view.";
    return { ...result, next };
  },
});
