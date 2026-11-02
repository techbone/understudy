import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { z } from "zod";

import { runbookDetail, scopeOf } from "../server/lib/runbook.js";

export default defineAction({
  description:
    "Get a runbook: its ordered steps with trust level (shadow/approve/auto), risk, streak and recent evidence, plus the latest run and its step runs.",
  schema: z.object({
    runbookId: z.string().describe("Runbook id from list-runbooks"),
  }),
  http: { method: "GET" },
  readOnly: true,
  link: ({ args }) => ({
    url: buildDeepLink({
      view: "runbook",
      to: `/runbooks/${encodeURIComponent(args.runbookId)}`,
      params: { runbookId: args.runbookId },
    }),
    label: "Open runbook",
  }),
  run: async ({ runbookId }, ctx) => runbookDetail(scopeOf(ctx), runbookId),
});
