import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import {
  actionErrorMessage,
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import {
  useSetHeaderActions,
  useSetPageTitle,
} from "@agent-native/toolkit/app-shell/header-actions";
import { IconDots, IconPlayerPlay } from "@tabler/icons-react";
import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

import { EvidenceSheet } from "@/components/runbook/EvidenceSheet";
import { RunPanel } from "@/components/runbook/RunPanel";
import { StepLadder } from "@/components/runbook/StepLadder";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

function cronLabel(cron: string | null) {
  return cron === "0 9 * * 1" ? "Mondays 09:00" : cron ? cron : "Not scheduled";
}

export default function RunbookRoute() {
  const { runbookId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const selectedStepId = searchParams.get("step");
  const { data, isPending, error } = useActionQuery("get-runbook", {
    runbookId,
  });
  const [starting, setStarting] = useState(false);

  const reset = useActionMutation("reset-demo", {
    onSuccess: (result) => {
      toast.success("Demo reset");
      navigate(`/runbooks/${result.runbookId}`, { replace: true });
    },
    onError: (err) =>
      toast.error(actionErrorMessage(err) ?? "Could not reset the demo"),
  });

  const run = data?.latestRun ?? null;
  const active = run && run.status !== "done";

  function runNow() {
    if (!data) return;
    setStarting(true);
    sendToAgentChat({
      message: active
        ? `Carry on with this week's "${data.runbook.title}" run.`
        : `Run "${data.runbook.title}" now.`,
      context: `runbookId: ${runbookId}`,
      submit: true,
      openSidebar: true,
    });
    window.setTimeout(() => setStarting(false), 1500);
  }

  useSetPageTitle(
    data ? <span className="truncate">{data.runbook.title}</span> : null,
  );
  useSetHeaderActions(
    data ? (
      <div className="flex items-center gap-1">
        <Button size="sm" onClick={runNow} disabled={starting}>
          <IconPlayerPlay className="size-4" />
          {active ? "Resume run" : "Run now"}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" aria-label="More">
              <IconDots className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to="/outbox">Open the demo outbox</Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={reset.isPending}
              onSelect={() => reset.mutate({})}
            >
              Reset demo data
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ) : null,
  );

  if (isPending) {
    return (
      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Runbook not found.{" "}
        <Link className="underline" to="/runbooks">
          Back to runbooks
        </Link>
      </div>
    );
  }

  const selected = data.steps.find((s) => s.id === selectedStepId) ?? null;
  const select = (stepId: string | null) =>
    setSearchParams(
      (params) => {
        if (stepId) params.set("step", stepId);
        else params.delete("step");
        return params;
      },
      { replace: true },
    );

  return (
    <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium">Trust ladder</h2>
          <span className="font-mono text-xs text-muted-foreground">
            {cronLabel(data.runbook.schedule)}
          </span>
        </div>
        <StepLadder
          steps={data.steps}
          selectedStepId={selectedStepId}
          onSelect={select}
        />
        <p className="text-xs text-muted-foreground">
          Three clean approvals in a row and a step asks to move up. An edit
          resets the count. A rejection or a correction drops it a rung. Steps
          that message clients stop at Approve.
        </p>
      </section>
      <section className="min-w-0 space-y-3">
        <h2 className="text-sm font-medium">
          {run && run.status === "done" ? "Last run" : "This week"}
        </h2>
        <RunPanel runbookId={runbookId} run={run} steps={data.steps} />
      </section>
      <EvidenceSheet
        step={selected}
        runbookId={runbookId}
        onClose={() => select(null)}
      />
    </div>
  );
}
