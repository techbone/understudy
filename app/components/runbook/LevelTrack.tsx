import { IconLock } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

import { LEVEL_HINT, LEVEL_LABEL, type Level } from "./types";

const ORDER: Level[] = ["shadow", "approve", "auto"];

/** Three rungs; the earned one is filled, rungs above the cap are locked. */
export function LevelTrack({
  level,
  risk,
  size = "md",
}: {
  level: Level;
  risk: "low" | "high";
  size?: "sm" | "md";
}) {
  const current = ORDER.indexOf(level);
  return (
    <div
      role="img"
      aria-label={`${LEVEL_LABEL[level]}: ${LEVEL_HINT[level]}${risk === "high" ? ". Capped at Approve." : ""}`}
      className={cn(
        "inline-grid grid-cols-3 overflow-hidden rounded-md border border-border font-mono uppercase tracking-wide",
        size === "sm" ? "text-[10px]" : "text-[11px]",
      )}
    >
      {ORDER.map((rung, index) => {
        const locked = risk === "high" && rung === "auto";
        const active = index === current;
        const passed = index < current;
        return (
          <span
            key={rung}
            className={cn(
              "flex items-center justify-center gap-1 border-border px-2",
              size === "sm" ? "h-5 min-w-14" : "h-6 min-w-16",
              index > 0 && "border-l",
              active && rung === "auto" && "bg-earned text-earned-foreground",
              active && rung !== "auto" && "bg-foreground text-background",
              passed && "bg-muted text-foreground",
              !active && !passed && "text-muted-foreground",
              locked &&
                "bg-[repeating-linear-gradient(135deg,transparent_0_4px,hsl(var(--border))_4px_5px)]",
            )}
          >
            {locked ? <IconLock className="size-3" strokeWidth={2} /> : null}
            {LEVEL_LABEL[rung]}
          </span>
        );
      })}
    </div>
  );
}

/** Clean approvals in a row toward the next rung. */
export function Streak({
  streak,
  threshold,
}: {
  streak: number;
  threshold: number;
}) {
  const shown = Math.min(streak, threshold);
  return (
    <span
      className="inline-flex items-center gap-1"
      aria-label={`${streak} of ${threshold} clean approvals`}
    >
      {Array.from({ length: threshold }, (_, index) => (
        <span
          key={index}
          className={cn(
            "size-2 rounded-full border",
            index < shown
              ? "border-earned bg-earned"
              : "border-border bg-transparent",
          )}
        />
      ))}
      <span className="tnum ml-1 font-mono text-xs text-muted-foreground">
        {shown}/{threshold}
      </span>
    </span>
  );
}
