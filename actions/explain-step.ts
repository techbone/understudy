import { defineAction } from "@agent-native/core/action";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { getStep, scopeOf } from "../server/lib/runbook.js";
import { capFor, nextLevel } from "../server/lib/trust.js";

export default defineAction({
  description:
    "Explain why a step sits at its trust level: cap, streak toward the next level, and the evidence ledger (approvals, edits, rejections, corrections, promotions). Use it when the user asks why a step is where it is.",
  schema: z.object({ stepId: z.string().describe("Runbook step id") }),
  http: { method: "GET" },
  readOnly: true,
  run: async ({ stepId }, ctx) => {
    const scope = scopeOf(ctx);
    const db = getDb();
    const step = await getStep(db, scope, stepId);
    const events = await db
      .select()
      .from(schema.trustEvents)
      .where(eq(schema.trustEvents.stepId, stepId))
      .orderBy(desc(schema.trustEvents.createdAt))
      .limit(40);
    const cap = capFor(step.risk);
    const next = nextLevel(step);
    return {
      step: {
        id: step.id,
        title: step.title,
        level: step.level,
        risk: step.risk,
        streak: step.streak,
        threshold: step.threshold,
      },
      cap,
      capReason:
        step.risk === "high"
          ? "Messages clients, so it never runs unattended."
          : null,
      next: next === step.level ? null : next,
      cleanApprovalsNeeded:
        next === step.level ? null : Math.max(step.threshold - step.streak, 0),
      promotionOffered: Boolean(step.promotionOfferedAt),
      evidence: events,
    };
  },
});
