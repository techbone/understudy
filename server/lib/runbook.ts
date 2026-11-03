import { fail, type ActionRunContext } from "@agent-native/core/action";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { z } from "zod";

import { getDb, schema } from "../db/index.js";
import { payloadByEffect, stableJson, type Effect } from "./payloads.js";
import {
  applyOutcome,
  respondToOffer,
  type Level,
  type Outcome,
  type TrustChange,
} from "./trust.js";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export type Step = typeof schema.runbookSteps.$inferSelect;
export type StepRun = typeof schema.stepRuns.$inferSelect;

export interface Scope {
  email: string;
  orgId: string | null;
}

/** Statuses that still need a person before the run can move on. */
export const PENDING = ["suggested", "proposed"] as const;

export function scopeOf(ctx: ActionRunContext | undefined): Scope {
  const email = ctx?.userEmail ?? fail("Sign in first.", { statusCode: 401 });
  return { email, orgId: ctx?.orgId ?? null };
}

export function nowIso() {
  return new Date().toISOString();
}

export function parsePayload<E extends Effect>(
  effect: E,
  value: unknown,
): z.infer<(typeof payloadByEffect)[E]> {
  const parsed = payloadByEffect[effect].safeParse(value);
  if (!parsed.success) {
    fail(
      `Output does not match a ${effect} step: ${parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".") || "output"}: ${i.message}`)
        .join("; ")}. Fix the output and call submit-step again.`,
      {
        errorCode: "invalid_output",
        statusCode: 400,
      },
    );
  }
  return parsed.data as z.infer<(typeof payloadByEffect)[E]>;
}

export async function getStep(db: Db, scope: Scope, stepId: string) {
  const [step] = await db
    .select()
    .from(schema.runbookSteps)
    .where(
      and(
        eq(schema.runbookSteps.id, stepId),
        eq(schema.runbookSteps.ownerEmail, scope.email),
      ),
    )
    .limit(1);
  return (
    step ?? fail("Step not found.", { errorCode: "not_found", statusCode: 404 })
  );
}

export async function getStepRun(db: Db, scope: Scope, stepRunId: string) {
  const [row] = await db
    .select({ stepRun: schema.stepRuns, step: schema.runbookSteps })
    .from(schema.stepRuns)
    .innerJoin(
      schema.runbookSteps,
      eq(schema.runbookSteps.id, schema.stepRuns.stepId),
    )
    .where(
      and(
        eq(schema.stepRuns.id, stepRunId),
        eq(schema.stepRuns.ownerEmail, scope.email),
      ),
    )
    .limit(1);
  return (
    row ??
    fail("Step run not found.", { errorCode: "not_found", statusCode: 404 })
  );
}

/** Writes a trust change and its evidence rows. */
export async function recordTrust(
  db: Db,
  scope: Scope,
  step: Step,
  change: TrustChange,
  stepRunId: string | null,
  note: string | null,
) {
  await db
    .update(schema.runbookSteps)
    .set({
      level: change.level,
      streak: change.streak,
      promotionOfferedAt: change.promotionOffered
        ? (step.promotionOfferedAt ?? nowIso())
        : null,
    })
    .where(eq(schema.runbookSteps.id, step.id));
  const at = nowIso();
  if (change.events.length) {
    await db.insert(schema.trustEvents).values(
      change.events.map((event) => ({
        id: crypto.randomUUID(),
        stepId: step.id,
        stepRunId,
        kind: event.kind,
        fromLevel: event.fromLevel,
        toLevel: event.toLevel,
        note,
        createdAt: at,
        ownerEmail: scope.email,
        orgId: scope.orgId,
      })),
    );
  }
}

export function trustOf(step: Step) {
  return {
    level: step.level as Level,
    risk: step.risk,
    streak: step.streak,
    threshold: step.threshold,
    promotionOffered: Boolean(step.promotionOfferedAt),
  };
}

export async function applyStepOutcome(
  db: Db,
  scope: Scope,
  step: Step,
  outcome: Outcome,
  stepRunId: string | null,
  note: string | null,
) {
  const change = applyOutcome(trustOf(step), outcome);
  await recordTrust(db, scope, step, change, stepRunId, note);
  return change;
}

export async function answerPromotion(
  db: Db,
  scope: Scope,
  step: Step,
  accept: boolean,
) {
  const change = respondToOffer(trustOf(step), accept);
  if (!change.events.length) {
    fail("There is no open promotion offer for this step.", {
      errorCode: "no_offer",
      statusCode: 409,
    });
  }
  await recordTrust(db, scope, step, change, null, null);
  return change;
}

/** Carries out a step's effect on the mock domain. Notes have no side effect. */
export async function executeEffect(
  db: Db,
  scope: Scope,
  step: Step,
  runId: string,
  stepRunId: string,
  payload: unknown,
) {
  const at = nowIso();
  if (step.effect === "send_emails") {
    const { emails } = parsePayload("send_emails", payload);
    await db.insert(schema.outbox).values(
      emails.map((email) => ({
        id: crypto.randomUUID(),
        runId,
        stepRunId,
        invoiceId: email.invoiceId,
        toAddress: email.to,
        subject: email.subject,
        body: email.body,
        sentAt: at,
        ownerEmail: scope.email,
        orgId: scope.orgId,
      })),
    );
    for (const email of emails) {
      const [invoice] = await db
        .select({
          id: schema.invoices.id,
          remindersSent: schema.invoices.remindersSent,
        })
        .from(schema.invoices)
        .where(
          and(
            eq(schema.invoices.id, email.invoiceId),
            eq(schema.invoices.ownerEmail, scope.email),
          ),
        )
        .limit(1);
      if (!invoice)
        fail(`Unknown invoice ${email.invoiceId}.`, {
          errorCode: "not_found",
          statusCode: 404,
        });
      await db
        .update(schema.invoices)
        .set({ remindersSent: invoice.remindersSent + 1, lastRemindedAt: at })
        .where(eq(schema.invoices.id, invoice.id));
    }
  } else if (step.effect === "log") {
    const { entries } = parsePayload("log", payload);
    await db.insert(schema.arLog).values(
      entries.map((entry) => ({
        id: crypto.randomUUID(),
        invoiceId: entry.invoiceId,
        runId,
        note: entry.note,
        createdAt: at,
        ownerEmail: scope.email,
        orgId: scope.orgId,
      })),
    );
  } else if (step.effect === "escalate") {
    const message = parsePayload("escalate", payload);
    await db.insert(schema.outbox).values({
      id: crypto.randomUUID(),
      runId,
      stepRunId,
      invoiceId: null,
      toAddress: message.to,
      subject: message.subject,
      body: message.body,
      sentAt: at,
      ownerEmail: scope.email,
      orgId: scope.orgId,
    });
  }
}

/** Marks the run waiting, running or done from its step runs. */
export async function refreshRunStatus(db: Db, runId: string) {
  const [run] = await db
    .select()
    .from(schema.runs)
    .where(eq(schema.runs.id, runId))
    .limit(1);
  if (!run) return null;
  const steps = await db
    .select({ id: schema.runbookSteps.id })
    .from(schema.runbookSteps)
    .where(eq(schema.runbookSteps.runbookId, run.runbookId));
  const stepRuns = await db
    .select({ status: schema.stepRuns.status })
    .from(schema.stepRuns)
    .where(eq(schema.stepRuns.runId, runId));
  const pending = stepRuns.some((row) =>
    (PENDING as readonly string[]).includes(row.status),
  );
  const status = pending
    ? "waiting"
    : stepRuns.length >= steps.length
      ? "done"
      : "running";
  await db
    .update(schema.runs)
    .set({
      status,
      finishedAt: status === "done" ? (run.finishedAt ?? nowIso()) : null,
    })
    .where(eq(schema.runs.id, runId));
  return status;
}

export function isUnchanged(proposal: string, payload: unknown) {
  return stableJson(JSON.parse(proposal)) === stableJson(payload);
}

export async function runbookDetail(scope: Scope, runbookId: string) {
  const db = getDb();
  const [runbook] = await db
    .select()
    .from(schema.runbooks)
    .where(
      and(
        eq(schema.runbooks.id, runbookId),
        eq(schema.runbooks.ownerEmail, scope.email),
      ),
    )
    .limit(1);
  if (!runbook)
    fail("Runbook not found.", { errorCode: "not_found", statusCode: 404 });
  const steps = await db
    .select()
    .from(schema.runbookSteps)
    .where(eq(schema.runbookSteps.runbookId, runbookId))
    .orderBy(asc(schema.runbookSteps.position));
  const recentRuns = await db
    .select()
    .from(schema.runs)
    .where(eq(schema.runs.runbookId, runbookId))
    .orderBy(desc(schema.runs.startedAt))
    .limit(8);
  const latest = recentRuns[0] ?? null;
  const latestStepRuns = latest
    ? await db
        .select()
        .from(schema.stepRuns)
        .where(eq(schema.stepRuns.runId, latest.id))
    : [];
  const events = steps.length
    ? await db
        .select()
        .from(schema.trustEvents)
        .where(
          inArray(
            schema.trustEvents.stepId,
            steps.map((step) => step.id),
          ),
        )
        .orderBy(desc(schema.trustEvents.createdAt))
        .limit(300)
    : [];
  return {
    runbook,
    steps: steps.map((step) => ({
      ...step,
      recentEvents: events
        .filter((event) => event.stepId === step.id)
        .slice(0, 12),
    })),
    latestRun: latest
      ? {
          ...latest,
          stepRuns: latestStepRuns.map((row) => ({
            ...row,
            proposal: JSON.parse(row.proposal) as unknown,
            final: row.final ? (JSON.parse(row.final) as unknown) : null,
          })),
        }
      : null,
    recentRuns: recentRuns.map(
      ({ id, status, trigger, startedAt, finishedAt }) => ({
        id,
        status,
        trigger,
        startedAt,
        finishedAt,
      }),
    ),
  };
}
