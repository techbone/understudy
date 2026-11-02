import { defineAction, fail } from "@agent-native/core/action";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import {
  applyStepOutcome,
  executeEffect,
  getStepRun,
  nowIso,
  PENDING,
  refreshRunStatus,
  scopeOf,
} from "../server/lib/runbook.js";
import { runsUnattended } from "../server/lib/trust.js";

export default defineAction({
  description:
    "Carry out a pending step proposal exactly as proposed, right now. Only use when the person explicitly asks you to execute a waiting step from chat. The framework asks the person to approve unless the step has earned Auto.",
  schema: z.object({
    stepRunId: z.string().describe("Pending step run id from get-runbook"),
  }),
  // The trust ladder is the gate. Every caller (agent loop, MCP, HTTP, CLI)
  // checks this predicate, so a step runs unattended only when it has earned
  // Auto. A lookup that throws fails closed and asks.
  needsApproval: async ({ stepRunId }, ctx) => {
    const { step } = await getStepRun(getDb(), scopeOf(ctx), stepRunId);
    return !runsUnattended(step);
  },
  allowPersistentApproval: false,
  run: async ({ stepRunId }, ctx) => {
    const scope = scopeOf(ctx);
    const db = getDb();
    return db.transaction(async (tx) => {
      const { stepRun, step } = await getStepRun(tx, scope, stepRunId);
      if (!(PENDING as readonly string[]).includes(stepRun.status)) {
        fail(`This step is already ${stepRun.status.replace("_", " ")}.`, {
          errorCode: "not_pending",
          statusCode: 409,
        });
      }
      const status = stepRun.status === "suggested" ? "human_done" : "approved";
      const [updated] = await tx
        .update(schema.stepRuns)
        .set({ status, final: stepRun.proposal, decidedAt: nowIso() })
        .where(
          and(
            eq(schema.stepRuns.id, stepRunId),
            inArray(schema.stepRuns.status, [...PENDING]),
          ),
        )
        .returning({ id: schema.stepRuns.id });
      if (!updated)
        fail("Someone already decided this step.", {
          errorCode: "not_pending",
          statusCode: 409,
        });
      await executeEffect(
        tx,
        scope,
        step,
        stepRun.runId,
        stepRunId,
        JSON.parse(stepRun.proposal),
      );
      // Reaching here on a gated step means a person approved this exact call.
      const change = runsUnattended(step)
        ? null
        : await applyStepOutcome(
            tx,
            scope,
            step,
            "clean",
            stepRunId,
            "Approved in chat",
          );
      const runStatus = await refreshRunStatus(tx, stepRun.runId);
      return {
        stepRunId,
        status,
        level: change?.level ?? step.level,
        runStatus,
      };
    });
  },
});
