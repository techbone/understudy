import { defineAction } from "@agent-native/core/action";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { scopeOf } from "../server/lib/runbook.js";

export default defineAction({
  description:
    "List messages in the demo outbox (the mock inbox that stands in for real email), newest first.",
  schema: z.object({}),
  http: { method: "GET" },
  readOnly: true,
  run: async (_args, ctx) => {
    const scope = scopeOf(ctx);
    const o = schema.outbox;
    const rows = await getDb()
      .select({
        id: o.id,
        runId: o.runId,
        invoiceId: o.invoiceId,
        to: o.toAddress,
        subject: o.subject,
        body: o.body,
        sentAt: o.sentAt,
      })
      .from(o)
      .where(eq(o.ownerEmail, scope.email))
      .orderBy(desc(o.sentAt))
      .limit(100);
    return { messages: rows };
  },
});
