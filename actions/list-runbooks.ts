import { defineAction } from "@agent-native/core/action";
import { buildDeepLink } from "@agent-native/core/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { scopeOf } from "../server/lib/runbook.js";

export default defineAction({
  description:
    "List the user's runbooks (recorded chores the agent runs with them).",
  schema: z.object({}),
  http: { method: "GET" },
  readOnly: true,
  link: () => ({
    url: buildDeepLink({ view: "runbooks", to: "/runbooks" }),
    label: "Open runbooks",
  }),
  run: async (_args, ctx) => {
    const scope = scopeOf(ctx);
    const rows = await getDb()
      .select({
        id: schema.runbooks.id,
        title: schema.runbooks.title,
        summary: schema.runbooks.summary,
        schedule: schema.runbooks.schedule,
      })
      .from(schema.runbooks)
      .where(eq(schema.runbooks.ownerEmail, scope.email))
      .orderBy(desc(schema.runbooks.createdAt))
      .limit(50);
    return { runbooks: rows };
  },
});
