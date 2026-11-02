import { defineAction } from "@agent-native/core/action";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";
import { scopeOf } from "../server/lib/runbook.js";

const DAY = 24 * 60 * 60 * 1000;

export default defineAction({
  description:
    "List invoices from the demo ledger with days overdue (negative = not yet due). Defaults to open invoices only.",
  schema: z.object({
    includePaid: z.coerce
      .boolean()
      .default(false)
      .describe("Also return paid invoices"),
  }),
  http: { method: "GET" },
  readOnly: true,
  run: async ({ includePaid }, ctx) => {
    const scope = scopeOf(ctx);
    const i = schema.invoices;
    const rows = await getDb()
      .select({
        id: i.id,
        number: i.number,
        client: i.client,
        contactName: i.contactName,
        contactEmail: i.contactEmail,
        amountCents: i.amountCents,
        dueOn: i.dueOn,
        status: i.status,
        remindersSent: i.remindersSent,
        lastRemindedAt: i.lastRemindedAt,
      })
      .from(i)
      .where(
        includePaid
          ? eq(i.ownerEmail, scope.email)
          : and(eq(i.ownerEmail, scope.email), eq(i.status, "open")),
      )
      .orderBy(asc(i.dueOn))
      .limit(200);
    const today = Date.parse(new Date().toISOString().slice(0, 10));
    return {
      invoices: rows.map((row) => ({
        ...row,
        amount: (row.amountCents / 100).toFixed(2),
        daysOverdue: Math.round((today - Date.parse(row.dueOn)) / DAY),
      })),
    };
  },
});
