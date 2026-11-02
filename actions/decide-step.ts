import { defineAction, fail } from "@agent-native/core/action";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import {
  applyStepOutcome,
  executeEffect,
  getStepRun,
  isUnchanged,
  nowIso,
  parsePayload,
  PENDING,
  refreshRunStatus,
  scopeOf,
  type Db,
} from "../server/lib/runbook.js";

export default defineAction({
  description:
    "A person's decision on one step: approve (optionally edited), reject, or correct an Auto result. UI only: the agent can never approve its own work.",
  schema: z.object({
    stepRunId: z.string().describe("Step run id"),
    decision: z.enum(["approve", "reject", "correct"]),
    output: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("Edited or corrected output; omit to approve as proposed"),
    feedback: z
      .string()
      .max(2000)
      .optional()
      .describe("Why, in the person's words"),
  }),
  uiOnly: true,
  run: async ({ stepRunId, decision, output, feedback }, ctx) => {
    const scope = scopeOf(ctx);
    const db = getDb();
    return db.transaction(async (tx) => {
      const { stepRun, step } = await getStepRun(tx, scope, stepRunId);
      const note = feedback?.trim() || null;
      const pending = (PENDING as readonly string[]).includes(stepRun.status);

      if (decision === "correct") {
        if (stepRun.status !== "auto_done") {
          fail("Only an Auto result can be corrected.", {
            errorCode: "not_correctable",
            statusCode: 409,
          });
        }
        const corrected = parsePayload(
          step.effect,
          output ??
            fail("Send the corrected output.", { errorCode: "invalid_output" }),
        );
        await tx
          .update(schema.stepRuns)
          .set({
            status: "corrected",
            final: JSON.stringify(corrected),
            feedback: note,
            decidedAt: nowIso(),
          })
          .where(eq(schema.stepRuns.id, stepRunId));
        const change = await applyStepOutcome(
          tx,
          scope,
          step,
          "correct",
          stepRunId,
          note,
        );
        return {
          stepRunId,
          status: "corrected" as const,
          ...change,
          runStatus: await refreshRunStatus(tx, stepRun.runId),
        };
      }

      if (!pending)
        fail(`This step is already ${stepRun.status.replace("_", " ")}.`, {
          errorCode: "not_pending",
          statusCode: 409,
        });

      if (decision === "reject") {
        await claim(tx, stepRunId, { status: "rejected", feedback: note });
        const change = await applyStepOutcome(
          tx,
          scope,
          step,
          "reject",
          stepRunId,
          note,
        );
        return {
          stepRunId,
          status: "rejected" as const,
          ...change,
          runStatus: await refreshRunStatus(tx, stepRun.runId),
        };
      }

      const final = output
        ? parsePayload(step.effect, output)
        : JSON.parse(stepRun.proposal);
      const unchanged = isUnchanged(stepRun.proposal, final);
      const status =
        stepRun.status === "suggested"
          ? "human_done"
          : unchanged
            ? "approved"
            : "edited";
      await claim(tx, stepRunId, {
        status,
        final: JSON.stringify(final),
        feedback: note,
      });
      await executeEffect(tx, scope, step, stepRun.runId, stepRunId, final);
      const change = await applyStepOutcome(
        tx,
        scope,
        step,
        unchanged ? "clean" : "edit",
        stepRunId,
        note,
      );
      return {
        stepRunId,
        status,
        ...change,
        runStatus: await refreshRunStatus(tx, stepRun.runId),
      };
    });
  },
});

/** Compare-and-set from a pending status, so two clicks can't both decide. */
async function claim(
  tx: Db,
  stepRunId: string,
  values: {
    status: "approved" | "edited" | "rejected" | "human_done";
    final?: string;
    feedback: string | null;
  },
) {
  const [row] = await tx
    .update(schema.stepRuns)
    .set({ ...values, decidedAt: nowIso() })
    .where(
      and(
        eq(schema.stepRuns.id, stepRunId),
        inArray(schema.stepRuns.status, [...PENDING]),
      ),
    )
    .returning({ id: schema.stepRuns.id });
  if (!row)
    fail("Someone already decided this step.", {
      errorCode: "not_pending",
      statusCode: 409,
    });
}
