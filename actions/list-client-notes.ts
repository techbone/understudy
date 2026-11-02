import { defineAction } from "@agent-native/core/action";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { scopeOf } from "../server/lib/runbook.js";

export default defineAction({
  description:
    "List per-client notes: exceptions, tone preferences and who to contact.",
  schema: z.object({}),
  http: { method: "GET" },
  readOnly: true,
  run: async (_args, ctx) => {
    const scope = scopeOf(ctx);
    const rows = await getDb()
      .select({
        id: schema.clientNotes.id,
        client: schema.clientNotes.client,
        note: schema.clientNotes.note,
      })
      .from(schema.clientNotes)
      .where(eq(schema.clientNotes.ownerEmail, scope.email))
      .orderBy(asc(schema.clientNotes.client))
      .limit(200);
    return { notes: rows };
  },
});
