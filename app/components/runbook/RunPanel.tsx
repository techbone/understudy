import {
  sendToAgentChat,
  useAgentChatGenerating,
} from "@agent-native/core/client/agent-chat";
import {
  actionErrorMessage,
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import {
  IconCircleCheck,
  IconClockHour4,
  IconLoader2,
  IconUser,
} from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { OutputEditor, type Output } from "./OutputEditor";
import {
  LEVEL_LABEL,
  shortTime,
  type RunView,
  type StepRunView,
  type StepView,
} from "./types";

const STATUS: Record<
  StepRunView["status"],
  { label: string; tone: "wait" | "done" | "down" | "auto" }
> = {
  suggested: { label: "Your step", tone: "wait" },
  proposed: { label: "Needs your OK", tone: "wait" },
  approved: { label: "Approved", tone: "done" },
  edited: { label: "Approved with edits", tone: "done" },
  rejected: { label: "Rejected", tone: "down" },
  auto_done: { label: "Ran on its own", tone: "auto" },
  human_done: { label: "Done by you", tone: "done" },
  corrected: { label: "Corrected", tone: "down" },
};

function sameJson(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function continueRun(
  runbookId: string,
  runId: string,
  message = "I've reviewed the waiting step. Carry on with the run.",
) {
  sendToAgentChat({
    message,
    context: `runbookId: ${runbookId}, runId: ${runId}`,
    submit: true,
  });
}

export function RunPanel({
  runbookId,
  run,
  steps,
}: {
  runbookId: string;
  run: RunView | null;
  steps: StepView[];
}) {
  const invoices = useActionQuery("list-invoices", { includePaid: true });
  const invoiceLabel = useMemo(() => {
    const map = new Map(
      (invoices.data?.invoices ?? []).map((i) => [i.id, i.number]),
    );
    return (id: string) => map.get(id) ?? id.slice(0, 8);
  }, [invoices.data]);

  // A decision can land while the agent is still mid-turn. A message sent
  // then waits in the chat queue, and if the turn ends without sending it the
  // run stalls. Hold it here and send once the agent has been quiet for a
  // moment (a long turn pauses briefly between its chunks).
  const [generating, , stopReason] = useAgentChatGenerating();
  const [continueRunId, setContinueRunId] = useState<string | null>(null);
  useEffect(() => {
    if (!continueRunId || generating) return;
    const timer = window.setTimeout(() => {
      continueRun(runbookId, continueRunId);
      setContinueRunId(null);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [continueRunId, generating, runbookId]);

  // On hosted deploys a long turn is cut into chunks and the framework
  // continues it on its own only a few times; past that, or after a server
  // error, the chat stops while the run is still on the agent's turn. Pick it
  // back up (a few times per run) unless the person pressed Stop.
  const nudges = useRef({ runId: "", count: 0 });
  const runId = run?.id;
  const agentsTurn = run?.status === "running";
  useEffect(() => {
    if (!runId || !agentsTurn || generating || continueRunId) return;
    if (stopReason === "stopped") return;
    if (nudges.current.runId !== runId) nudges.current = { runId, count: 0 };
    if (nudges.current.count >= 3) return;
    const timer = window.setTimeout(() => {
      nudges.current.count += 1;
      continueRun(runbookId, runId, "Carry on with the run.");
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [runId, agentsTurn, generating, continueRunId, stopReason, runbookId]);

  if (!run) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No runs yet. Start one and watch each step land here.
      </div>
    );
  }

  const waiting = run.stepRuns.filter(
    (r) => r.status === "proposed" || r.status === "suggested",
  ).length;
  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          {run.status === "done" ? (
            <IconCircleCheck className="size-4 text-earned" />
          ) : run.status === "waiting" ? (
            <IconUser className="size-4 text-caution" />
          ) : (
            <IconLoader2 className="size-4 animate-spin text-muted-foreground" />
          )}
          <span className="font-medium">
            {run.status === "done"
              ? "Run complete"
              : run.status === "waiting"
                ? `Waiting on you (${waiting})`
                : "Agent is working"}
          </span>
        </div>
        <span className="tnum font-mono text-xs text-muted-foreground">
          {run.trigger === "schedule" ? "Scheduled" : "Manual"} ·{" "}
          {shortTime(run.startedAt)}
        </span>
      </header>
      <ol className="space-y-2">
        {steps.map((step) => {
          const stepRun = run.stepRuns.find((r) => r.stepId === step.id);
          return stepRun ? (
            <StepRunCard
              key={step.id}
              runbookId={runbookId}
              runId={run.id}
              step={step}
              stepRun={stepRun}
              invoiceLabel={invoiceLabel}
              onContinue={setContinueRunId}
            />
          ) : (
            <li
              key={step.id}
              className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground"
            >
              <span className="tnum w-5 font-mono text-xs">
                {step.position}
              </span>
              <span className="flex-1 truncate">{step.title}</span>
              <IconClockHour4 className="size-4" />
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function StepRunCard({
  runbookId,
  runId,
  step,
  stepRun,
  invoiceLabel,
  onContinue,
}: {
  runbookId: string;
  runId: string;
  step: StepView;
  stepRun: StepRunView;
  invoiceLabel: (id: string) => string;
  onContinue: (runId: string) => void;
}) {
  const pending =
    stepRun.status === "proposed" || stepRun.status === "suggested";
  const [draft, setDraft] = useState<Output>(stepRun.proposal as Output);
  const [correcting, setCorrecting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const edited = !sameJson(draft, stepRun.proposal);

  const decide = useActionMutation("decide-step", {
    onSuccess: (result) => {
      setCorrecting(false);
      setRejecting(false);
      setFeedback("");
      if (result.events?.some((e) => e.kind === "demoted")) {
        toast(`${step.title} dropped to ${LEVEL_LABEL[result.level]}`);
      } else if (result.events?.some((e) => e.kind === "promotion_offered")) {
        toast.success(`${step.title} asked to move up`);
      }
      if (result.runStatus === "running") onContinue(runId);
    },
    onError: (error) =>
      toast.error(actionErrorMessage(error) ?? "Could not save your decision"),
  });

  const status = STATUS[stepRun.status];
  const shown = (stepRun.final ?? stepRun.proposal) as Output;
  const editable = (pending && !rejecting) || correcting;

  return (
    <li
      className={cn(
        "overflow-hidden rounded-xl border bg-card",
        pending ? "border-foreground/30 shadow-sm" : "border-border",
      )}
    >
      <header className="flex items-center gap-3 border-b border-border px-4 py-2.5">
        <span className="tnum w-5 font-mono text-xs text-muted-foreground">
          {step.position}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {step.title}
        </span>
        <span className="hidden font-mono text-[11px] uppercase tracking-wide text-muted-foreground sm:inline">
          {LEVEL_LABEL[stepRun.levelAtRun]}
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-xs",
            status.tone === "wait" && "bg-caution/15 text-caution",
            status.tone === "done" && "bg-muted text-foreground",
            status.tone === "auto" && "bg-earned-soft text-earned",
            status.tone === "down" && "bg-caution/10 text-caution",
          )}
        >
          {status.label}
        </span>
      </header>
      <div className="space-y-3 p-4">
        {stepRun.status === "suggested" ? (
          <p className="text-xs text-muted-foreground">
            Shadow step: you do this one. The agent's suggestion:
          </p>
        ) : null}
        <OutputEditor
          effect={step.effect}
          value={editable ? draft : shown}
          onChange={editable ? setDraft : undefined}
          invoiceLabel={invoiceLabel}
        />
        {stepRun.feedback && !pending ? (
          <p className="text-sm text-muted-foreground">“{stepRun.feedback}”</p>
        ) : null}

        {rejecting || correcting ? (
          <Textarea
            rows={2}
            placeholder={
              correcting
                ? "What was wrong? (kept as evidence)"
                : "Why not? (kept as evidence)"
            }
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
        ) : null}

        {pending ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {rejecting ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRejecting(false)}
                >
                  Back
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={decide.isPending}
                  onClick={() =>
                    decide.mutate({
                      stepRunId: stepRun.id,
                      decision: "reject",
                      feedback,
                    })
                  }
                >
                  {stepRun.status === "suggested" ? "Skip this week" : "Reject"}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRejecting(true)}
                >
                  {stepRun.status === "suggested" ? "Skip" : "Reject"}
                </Button>
                {edited ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDraft(stepRun.proposal as Output)}
                  >
                    Undo edits
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  disabled={decide.isPending}
                  onClick={() =>
                    decide.mutate({
                      stepRunId: stepRun.id,
                      decision: "approve",
                      output: edited ? draft : undefined,
                    })
                  }
                >
                  {stepRun.status === "suggested"
                    ? edited
                      ? "Done my way"
                      : "Done, as suggested"
                    : edited
                      ? "Approve with edits"
                      : "Approve"}
                </Button>
              </>
            )}
          </div>
        ) : stepRun.status === "auto_done" ? (
          <div className="flex justify-end gap-2">
            {correcting ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCorrecting(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={decide.isPending || !edited}
                  onClick={() =>
                    decide.mutate({
                      stepRunId: stepRun.id,
                      decision: "correct",
                      output: draft,
                      feedback,
                    })
                  }
                >
                  Save correction
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDraft(shown);
                  setCorrecting(true);
                }}
              >
                Correct
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </li>
  );
}
