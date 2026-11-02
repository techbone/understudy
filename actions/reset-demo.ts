import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { z } from "zod";

import { resetDemo } from "../server/lib/demo.js";
import { scopeOf } from "../server/lib/runbook.js";

export default defineAction({
  description:
    "Replace the current user's data with the seeded demo: the Monday invoice chase runbook, three past runs of approval history, and the Northlane Studio invoice ledger.",
  schema: z.object({}),
  uiOnly: true,
  link: ({ result }) => ({
    url: buildDeepLink({
      view: "runbook",
      to: `/runbooks/${encodeURIComponent(result.runbookId)}`,
      params: { runbookId: result.runbookId },
    }),
    label: "Open the demo runbook",
  }),
  run: async (_args, ctx) => resetDemo(scopeOf(ctx)),
});
