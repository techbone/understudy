import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import { useActionQuery } from "@agent-native/core/client/hooks";
import {
  IconArrowBackUp,
  IconArrowDown,
  IconArrowUp,
  IconCheck,
  IconHandStop,
  IconPencil,
  IconX,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { LevelTrack, Streak } from "./LevelTrack";
import {
  LEVEL_HINT,
  LEVEL_LABEL,
  nextLevel,
  shortDate,
  type Level,
  type StepView,
} from "./types";

const KIND: Record<
  string,
  {
    label: (from: Level, to: Level) => string;
    icon: typeof IconCheck;
    tone?: "up" | "down";
  }
> = {
  clean_approval: { label: () => "Approved without changes", icon: IconCheck },
  edit: { label: () => "Edited before approving", icon: IconPencil },
  rejection: { label: () => "Rejected", icon: IconX, tone: "down" },
  correction: {
    label: () => "Corrected after it ran",
    icon: IconArrowBackUp,
    tone: "down",
  },
  promotion_offered: {
    label: (_f, to) => `Asked to move up to ${LEVEL_LABEL[to]}`,
    icon: IconHandStop,
  },
  promoted: {
    label: (from, to) => `Promoted ${LEVEL_LABEL[from]} → ${LEVEL_LABEL[to]}`,
    icon: IconArrowUp,
    tone: "up",
  },
  promotion_declined: { label: () => "Promotion declined", icon: IconX },
  demoted: {
    label: (from, to) => `Dropped ${LEVEL_LABEL[from]} → ${LEVEL_LABEL[to]}`,
    icon: IconArrowDown,
    tone: "down",
  },
};

export function EvidenceSheet({
  step,
  runbookId,
  onClose,
}: {
  step: StepView | null;
  runbookId: string;
  onClose: () => void;
}) {
  const explain = useActionQuery(
    "explain-step",
    { stepId: step?.id ?? "" },
    { enabled: Boolean(step) },
  );
  const data = explain.data;
  const next = step ? nextLevel(step) : null;

  return (
    <Sheet open={Boolean(step)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        {step ? (
          <>
            <div className="space-y-3 border-b border-border p-5">
              <p className="font-mono text-xs text-muted-foreground">
                Step {step.position}
              </p>
              <SheetTitle className="text-lg font-semibold tracking-tight">
                {step.title}
              </SheetTitle>
              <SheetDescription className="text-sm text-muted-foreground">
                {step.instruction}
              </SheetDescription>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <LevelTrack level={step.level} risk={step.risk} />
                {next ? (
                  <Streak streak={step.streak} threshold={step.threshold} />
                ) : null}
              </div>
              <p className="text-sm">
                {LEVEL_HINT[step.level]}.{" "}
                {step.risk === "high"
                  ? "It messages clients, so it is capped at Approve however good its record."
                  : next
                    ? `${Math.max(step.threshold - step.streak, 0)} more clean approval${step.threshold - step.streak === 1 ? "" : "s"} and it asks to move up to ${LEVEL_LABEL[next]}.`
                    : "It has earned the top rung. One correction sends it back to Approve."}
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Evidence
              </h3>
              {explain.isPending ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Skeleton key={i} className="h-10 rounded-md" />
                  ))}
                </div>
              ) : (
                <ol className="relative space-y-4 border-l border-border pl-5">
                  {(data?.evidence ?? []).map((event) => {
                    const kind = KIND[event.kind] ?? KIND.clean_approval!;
                    const Icon = kind.icon;
                    return (
                      <li key={event.id} className="relative">
                        <span
                          className={cn(
                            "absolute -left-[1.95rem] top-0.5 flex size-5 items-center justify-center rounded-full border bg-background",
                            kind.tone === "up" && "border-earned text-earned",
                            kind.tone === "down" &&
                              "border-caution text-caution",
                          )}
                        >
                          <Icon className="size-3" strokeWidth={2.2} />
                        </span>
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="text-sm">
                            {kind.label(
                              event.fromLevel as Level,
                              event.toLevel as Level,
                            )}
                          </p>
                          <time
                            className="tnum shrink-0 font-mono text-xs text-muted-foreground"
                            dateTime={event.createdAt}
                          >
                            {shortDate(event.createdAt)}
                          </time>
                        </div>
                        {event.note ? (
                          <p className="mt-1 text-sm text-muted-foreground">
                            “{event.note}”
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
            <div className="border-t border-border p-4">
              <Button
                variant="outline"
                className="w-full"
                onClick={() =>
                  sendToAgentChat({
                    message: `Why is "${step.title}" on ${LEVEL_LABEL[step.level]}, and what would move it?`,
                    context: `runbookId: ${runbookId}, stepId: ${step.id}`,
                    submit: true,
                    openSidebar: true,
                  })
                }
              >
                Ask the agent about this step
              </Button>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
