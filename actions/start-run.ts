import { defineAction, fail } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { nowIso, scopeOf } from "../server/lib/runbook.js";
import { assertUnderCap, usedCents } from "../server/lib/usage-cap.js";

export default defineAction({
  description:
    "Start a run of a runbook, or resume the unfinished one. Returns the steps in order with their trust level. Then do each step in order and hand its output to submit-step.",
  schema: z.object({
    runbookId: z.string().describe("Runbook id from list-runbooks"),
    trigger: z
      .enum(["manual", "schedule"])
      .default("manual")
      .describe("schedule when started by the Monday job"),
  }),
  link: ({ args }) => ({
    url: buildDeepLink({
      view: "runbook",
      to: `/runbooks/${encodeURIComponent(args.runbookId)}`,
      params: { runbookId: args.runbookId },
    }),
    label: "Watch the run",
  }),
  run: async ({ runbookId, trigger }, ctx) => {
    const scope = scopeOf(ctx);
    const used = await usedCents(scope.email);
    const db = getDb();
    return db.transaction(async (tx) => {
      const [runbook] = await tx
        .select({ id: schema.runbooks.id, title: schema.runbooks.title })
        .from(schema.runbooks)
        .where(
          and(
            eq(schema.runbooks.id, runbookId),
            eq(schema.runbooks.ownerEmail, scope.email),
          ),
        )
        .for("update");
      if (!runbook)
        fail("Runbook not found.", { errorCode: "not_found", statusCode: 404 });

      const [latest] = await tx
        .select()
        .from(schema.runs)
        .where(eq(schema.runs.runbookId, runbookId))
        .orderBy(desc(schema.runs.startedAt))
        .limit(1);
      const resumed = Boolean(latest && latest.status !== "done");
      const run =
        latest && resumed
          ? latest
          : {
              id: crypto.randomUUID(),
              runbookId,
              trigger,
              status: "running" as const,
              startedAt: nowIso(),
              finishedAt: null,
              ownerEmail: scope.email,
              orgId: scope.orgId,
            };
      if (!resumed) {
        assertUnderCap(used);
        await tx.insert(schema.runs).values(run);
      }

      const steps = await tx
        .select({
          id: schema.runbookSteps.id,
          position: schema.runbookSteps.position,
          title: schema.runbookSteps.title,
          instruction: schema.runbookSteps.instruction,
          effect: schema.runbookSteps.effect,
          risk: schema.runbookSteps.risk,
          level: schema.runbookSteps.level,
        })
        .from(schema.runbookSteps)
        .where(eq(schema.runbookSteps.runbookId, runbookId))
        .orderBy(asc(schema.runbookSteps.position));
      const done = resumed
        ? await tx
            .select({
              stepId: schema.stepRuns.stepId,
              status: schema.stepRuns.status,
            })
            .from(schema.stepRuns)
            .where(eq(schema.stepRuns.runId, run.id))
        : [];
      return {
        runId: run.id,
        runbookId,
        title: runbook.title,
        resumed,
        steps: steps.map((step) => ({
          ...step,
          submitted: done.find((row) => row.stepId === step.id)?.status ?? null,
        })),
      };
    });
  },
});
