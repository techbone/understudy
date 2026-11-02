import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db/index.js";
import { answerPromotion, getStep, scopeOf } from "../server/lib/runbook.js";

export default defineAction({
  description:
    "Accept or decline a step's promotion offer. UI only: promotion is the person's call, never the agent's.",
  schema: z.object({
    stepId: z.string().describe("Runbook step id"),
    accept: z.boolean(),
  }),
  uiOnly: true,
  run: async ({ stepId, accept }, ctx) => {
    const scope = scopeOf(ctx);
    return getDb().transaction(async (tx) => {
      const step = await getStep(tx, scope, stepId);
      const change = await answerPromotion(tx, scope, step, accept);
      return { stepId, level: change.level, streak: change.streak };
    });
  },
});
