import { sql } from "drizzle-orm";
import { integer, pgTable, text } from "drizzle-orm/pg-core";

// Every row is private to its creator: actions filter by ctx.userEmail and
// children copy the runbook's owner and org. Times are UTC ISO text so string
// order equals time order.

export const runbooks = pgTable("runbooks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  clipUrl: text("clip_url"),
  transcript: text("transcript"),
  schedule: text("schedule"),
  ownerEmail: text("owner_email").notNull(),
  orgId: text("org_id"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
});

export const runbookSteps = pgTable("runbook_steps", {
  id: text("id").primaryKey(),
  runbookId: text("runbook_id").notNull(),
  position: integer("position").notNull(),
  title: text("title").notNull(),
  instruction: text("instruction").notNull(),
  effect: text("effect", {
    enum: ["note", "send_emails", "log", "escalate"],
  }).notNull(),
  risk: text("risk", { enum: ["low", "high"] })
    .notNull()
    .default("low"),
  level: text("level", { enum: ["shadow", "approve", "auto"] })
    .notNull()
    .default("shadow"),
  streak: integer("streak").notNull().default(0),
  threshold: integer("threshold").notNull().default(3),
  promotionOfferedAt: text("promotion_offered_at"),
  clipAt: text("clip_at"),
  ownerEmail: text("owner_email").notNull(),
  orgId: text("org_id"),
});

export const runs = pgTable("runs", {
  id: text("id").primaryKey(),
  runbookId: text("runbook_id").notNull(),
  trigger: text("trigger", { enum: ["manual", "schedule"] })
    .notNull()
    .default("manual"),
  status: text("status", { enum: ["running", "waiting", "done"] })
    .notNull()
    .default("running"),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  ownerEmail: text("owner_email").notNull(),
  orgId: text("org_id"),
});

export const stepRuns = pgTable("step_runs", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull(),
  stepId: text("step_id").notNull(),
  levelAtRun: text("level_at_run", {
    enum: ["shadow", "approve", "auto"],
  }).notNull(),
  status: text("status", {
    enum: [
      "suggested",
      "proposed",
      "approved",
      "edited",
      "rejected",
      "auto_done",
      "human_done",
      "corrected",
    ],
  }).notNull(),
  proposal: text("proposal").notNull(),
  final: text("final"),
  feedback: text("feedback"),
  createdAt: text("created_at").notNull(),
  decidedAt: text("decided_at"),
  ownerEmail: text("owner_email").notNull(),
  orgId: text("org_id"),
});

export const trustEvents = pgTable("trust_events", {
  id: text("id").primaryKey(),
  stepId: text("step_id").notNull(),
  stepRunId: text("step_run_id"),
  kind: text("kind", {
    enum: [
      "clean_approval",
      "edit",
      "rejection",
      "correction",
      "promotion_offered",
      "promoted",
      "promotion_declined",
      "demoted",
    ],
  }).notNull(),
  fromLevel: text("from_level"),
  toLevel: text("to_level"),
  note: text("note"),
  createdAt: text("created_at").notNull(),
  ownerEmail: text("owner_email").notNull(),
  orgId: text("org_id"),
});

// The mock domain the demo chore works on. `outbox` stands in for real email.

export const invoices = pgTable("invoices", {
  id: text("id").primaryKey(),
  number: text("number").notNull(),
  client: text("client").notNull(),
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  amountCents: integer("amount_cents").notNull(),
  dueOn: text("due_on").notNull(),
  status: text("status", { enum: ["open", "paid"] })
    .notNull()
    .default("open"),
  remindersSent: integer("reminders_sent").notNull().default(0),
  lastRemindedAt: text("last_reminded_at"),
  ownerEmail: text("owner_email").notNull(),
  orgId: text("org_id"),
});

export const clientNotes = pgTable("client_notes", {
  id: text("id").primaryKey(),
  client: text("client").notNull(),
  note: text("note").notNull(),
  ownerEmail: text("owner_email").notNull(),
  orgId: text("org_id"),
});

export const outbox = pgTable("outbox", {
  id: text("id").primaryKey(),
  runId: text("run_id"),
  stepRunId: text("step_run_id"),
  invoiceId: text("invoice_id"),
  toAddress: text("to_address").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  sentAt: text("sent_at").notNull(),
  ownerEmail: text("owner_email").notNull(),
  orgId: text("org_id"),
});

export const arLog = pgTable("ar_log", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id").notNull(),
  runId: text("run_id"),
  note: text("note").notNull(),
  createdAt: text("created_at").notNull(),
  ownerEmail: text("owner_email").notNull(),
  orgId: text("org_id"),
});
