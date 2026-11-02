import {
  actionErrorMessage,
  useActionMutation,
} from "@agent-native/core/client/hooks";
import { IconChevronRight, IconLock } from "@tabler/icons-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { LevelTrack, Streak } from "./LevelTrack";
import { LEVEL_LABEL, nextLevel, type StepView } from "./types";

export function StepLadder({
  steps,
  selectedStepId,
  onSelect,
}: {
  steps: StepView[];
  selectedStepId: string | null;
  onSelect: (stepId: string) => void;
}) {
  const respond = useActionMutation("respond-promotion", {
    onSuccess: (result, input) =>
      toast.success(
        input.accept
          ? `Promoted to ${LEVEL_LABEL[result.level]}`
          : "Kept where it is",
      ),
    onError: (error) =>
      toast.error(actionErrorMessage(error) ?? "Could not answer the offer"),
  });

  return (
    <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {steps.map((step) => {
        const next = nextLevel(step);
        const offered = Boolean(step.promotionOfferedAt) && next;
        return (
          <li
            key={step.id}
            className={cn(selectedStepId === step.id && "bg-muted/60")}
          >
            <button
              type="button"
              onClick={() => onSelect(step.id)}
              className="group flex w-full items-start gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="tnum w-5 shrink-0 pt-0.5 font-mono text-xs text-muted-foreground">
                {step.position}
              </span>
              <span className="min-w-0 flex-1 space-y-2">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {step.title}
                  </span>
                  {step.risk === "high" ? (
                    <IconLock
                      className="size-3.5 shrink-0 text-muted-foreground"
                      aria-label="Capped at Approve"
                    />
                  ) : null}
                </span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <LevelTrack level={step.level} risk={step.risk} size="sm" />
                  {next ? (
                    <Streak streak={step.streak} threshold={step.threshold} />
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {step.risk === "high"
                        ? "Messages clients: capped"
                        : "Top rung"}
                    </span>
                  )}
                </span>
              </span>
              <IconChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
            {offered ? (
              <div className="mx-4 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-earned/40 bg-earned-soft px-3 py-2.5">
                <p className="text-sm">
                  <span className="font-medium">
                    {step.streak} clean approvals in a row.
                  </span>{" "}
                  Move up to {LEVEL_LABEL[next]}?
                </p>
                <span className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={respond.isPending}
                    onClick={() =>
                      respond.mutate({ stepId: step.id, accept: false })
                    }
                  >
                    Not yet
                  </Button>
                  <Button
                    size="sm"
                    className="bg-earned text-earned-foreground hover:bg-earned/90"
                    disabled={respond.isPending}
                    onClick={() =>
                      respond.mutate({ stepId: step.id, accept: true })
                    }
                  >
                    Promote
                  </Button>
                </span>
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
