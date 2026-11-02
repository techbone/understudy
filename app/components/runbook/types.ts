import type { runbookDetail } from "../../../server/lib/runbook";

export type RunbookDetail = Awaited<ReturnType<typeof runbookDetail>>;
export type StepView = RunbookDetail["steps"][number];
export type TrustEventView = StepView["recentEvents"][number];
export type RunView = NonNullable<RunbookDetail["latestRun"]>;
export type StepRunView = RunView["stepRuns"][number];
export type Level = "shadow" | "approve" | "auto";
export type Effect = StepView["effect"];

export const LEVEL_LABEL: Record<Level, string> = {
  shadow: "Shadow",
  approve: "Approve",
  auto: "Auto",
};

export const LEVEL_HINT: Record<Level, string> = {
  shadow: "The agent suggests, you do it",
  approve: "The agent does it, you sign off",
  auto: "The agent does it and logs it",
};

export function nextLevel(
  step: Pick<StepView, "level" | "risk">,
): Level | null {
  if (step.level === "shadow") return "approve";
  if (step.level === "approve" && step.risk === "low") return "auto";
  return null;
}

export function shortDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

export function shortTime(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}
