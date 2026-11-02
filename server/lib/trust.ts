// The trust ladder. Pure functions so the rules are unit-tested and shared by
// every action that moves a step.

export const LEVELS = ["shadow", "approve", "auto"] as const;
export type Level = (typeof LEVELS)[number];
export type Risk = "low" | "high";

/** What a person did with one step's output. */
export type Outcome = "clean" | "edit" | "reject" | "correct";

export type TrustEventKind =
  | "clean_approval"
  | "edit"
  | "rejection"
  | "correction"
  | "promotion_offered"
  | "promoted"
  | "promotion_declined"
  | "demoted";

export interface StepTrust {
  level: Level;
  risk: Risk;
  streak: number;
  threshold: number;
  promotionOffered: boolean;
}

export interface TrustChange {
  level: Level;
  streak: number;
  promotionOffered: boolean;
  events: { kind: TrustEventKind; fromLevel: Level; toLevel: Level }[];
}

/** High-risk steps (anything that messages a client) never run unattended. */
export function capFor(risk: Risk): Level {
  return risk === "high" ? "approve" : "auto";
}

function rank(level: Level) {
  return LEVELS.indexOf(level);
}

export function nextLevel(step: Pick<StepTrust, "level" | "risk">): Level {
  const cap = capFor(step.risk);
  const next =
    LEVELS[Math.min(rank(step.level) + 1, LEVELS.length - 1)] ?? "auto";
  return rank(next) > rank(cap) ? cap : next;
}

export function canPromote(step: Pick<StepTrust, "level" | "risk">) {
  return nextLevel(step) !== step.level;
}

/** Whether the agent may carry out this step without a person in the loop. */
export function runsUnattended(step: Pick<StepTrust, "level" | "risk">) {
  return step.level === "auto" && capFor(step.risk) === "auto";
}

export function applyOutcome(step: StepTrust, outcome: Outcome): TrustChange {
  const from = step.level;
  if (outcome === "clean") {
    const streak = step.streak + 1;
    const events: TrustChange["events"] = [
      { kind: "clean_approval", fromLevel: from, toLevel: from },
    ];
    const offer =
      !step.promotionOffered && canPromote(step) && streak >= step.threshold;
    if (offer) {
      events.push({
        kind: "promotion_offered",
        fromLevel: from,
        toLevel: nextLevel(step),
      });
    }
    return {
      level: from,
      streak,
      promotionOffered: step.promotionOffered || offer,
      events,
    };
  }
  if (outcome === "edit") {
    return {
      level: from,
      streak: 0,
      promotionOffered: false,
      events: [{ kind: "edit", fromLevel: from, toLevel: from }],
    };
  }
  // A rejection drops one rung; correcting an unattended result drops an Auto
  // step back to Approve. Either way the streak starts over.
  const to: Level =
    outcome === "correct"
      ? from === "auto"
        ? "approve"
        : from
      : (LEVELS[Math.max(rank(from) - 1, 0)] ?? "shadow");
  const events: TrustChange["events"] = [
    {
      kind: outcome === "correct" ? "correction" : "rejection",
      fromLevel: from,
      toLevel: from,
    },
  ];
  if (to !== from)
    events.push({ kind: "demoted", fromLevel: from, toLevel: to });
  return { level: to, streak: 0, promotionOffered: false, events };
}

/** The person's answer to a promotion offer. Promotion is never automatic. */
export function respondToOffer(step: StepTrust, accept: boolean): TrustChange {
  const from = step.level;
  if (!step.promotionOffered) {
    return {
      level: from,
      streak: step.streak,
      promotionOffered: false,
      events: [],
    };
  }
  if (!accept) {
    return {
      level: from,
      streak: 0,
      promotionOffered: false,
      events: [{ kind: "promotion_declined", fromLevel: from, toLevel: from }],
    };
  }
  const to = nextLevel(step);
  return {
    level: to,
    streak: 0,
    promotionOffered: false,
    events: [{ kind: "promoted", fromLevel: from, toLevel: to }],
  };
}
