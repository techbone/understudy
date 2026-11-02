import { z } from "zod";

// What the agent hands over for each kind of step. The same schema validates
// the agent's proposal and the person's edited version.

export const notePayload = z.object({
  summary: z.string().min(1).describe("One or two sentences on what was found"),
  items: z
    .array(
      z.object({
        label: z.string().describe("Short label, e.g. an invoice number"),
        detail: z.string().describe("What applies to it"),
      }),
    )
    .max(50)
    .default([]),
});

export const sendEmailsPayload = z.object({
  emails: z
    .array(
      z.object({
        invoiceId: z.string().describe("Invoice id from list-invoices"),
        to: z.string().email(),
        subject: z.string().min(1),
        body: z.string().min(1),
      }),
    )
    .min(1)
    .max(25),
});

export const logPayload = z.object({
  entries: z
    .array(
      z.object({
        invoiceId: z.string().describe("Invoice id from list-invoices"),
        note: z.string().min(1).describe("What happened to this invoice today"),
      }),
    )
    .min(1)
    .max(50),
});

export const escalatePayload = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
});

export const payloadByEffect = {
  note: notePayload,
  send_emails: sendEmailsPayload,
  log: logPayload,
  escalate: escalatePayload,
} as const;

export type Effect = keyof typeof payloadByEffect;

/** Key-order-independent JSON, so "unchanged" means the same content. */
export function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) =>
            a.localeCompare(b),
          ),
        )
      : v,
  );
}
