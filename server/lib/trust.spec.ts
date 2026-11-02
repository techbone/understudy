import { describe, expect, it } from "vitest";

import {
  applyOutcome,
  capFor,
  nextLevel,
  respondToOffer,
  runsUnattended,
  type StepTrust,
} from "./trust.js";

const base: StepTrust = {
  level: "approve",
  risk: "low",
  streak: 0,
  threshold: 3,
  promotionOffered: false,
};

describe("trust ladder", () => {
  it("caps high-risk steps at approve", () => {
    expect(capFor("high")).toBe("approve");
    expect(nextLevel({ level: "approve", risk: "high" })).toBe("approve");
    expect(runsUnattended({ level: "auto", risk: "high" })).toBe(false);
  });

  it("offers promotion only once the streak reaches the threshold", () => {
    const two = applyOutcome({ ...base, streak: 1 }, "clean");
    expect(two.streak).toBe(2);
    expect(two.promotionOffered).toBe(false);
    const three = applyOutcome({ ...base, streak: 2 }, "clean");
    expect(three.promotionOffered).toBe(true);
    expect(three.level).toBe("approve");
    expect(three.events.map((e) => e.kind)).toEqual([
      "clean_approval",
      "promotion_offered",
    ]);
  });

  it("never offers promotion past the cap", () => {
    const change = applyOutcome({ ...base, risk: "high", streak: 9 }, "clean");
    expect(change.promotionOffered).toBe(false);
    expect(change.events.map((e) => e.kind)).toEqual(["clean_approval"]);
  });

  it("resets the streak on an edit without demoting", () => {
    const change = applyOutcome(
      { ...base, streak: 2, promotionOffered: true },
      "edit",
    );
    expect(change).toMatchObject({
      level: "approve",
      streak: 0,
      promotionOffered: false,
    });
  });

  it("demotes one rung on a rejection", () => {
    expect(applyOutcome({ ...base, level: "auto" }, "reject").level).toBe(
      "approve",
    );
    expect(applyOutcome(base, "reject").level).toBe("shadow");
    expect(applyOutcome({ ...base, level: "shadow" }, "reject").level).toBe(
      "shadow",
    );
  });

  it("drops a corrected auto step back to approve", () => {
    const change = applyOutcome(
      { ...base, level: "auto", streak: 4 },
      "correct",
    );
    expect(change.level).toBe("approve");
    expect(change.streak).toBe(0);
    expect(change.events.map((e) => e.kind)).toEqual(["correction", "demoted"]);
  });

  it("promotes only when the person accepts", () => {
    const offered = { ...base, streak: 3, promotionOffered: true };
    expect(respondToOffer(offered, true)).toMatchObject({
      level: "auto",
      streak: 0,
    });
    expect(respondToOffer(offered, false)).toMatchObject({
      level: "approve",
      streak: 0,
    });
    expect(respondToOffer(base, true).events).toEqual([]);
  });

  it("walks shadow up to approve the same way", () => {
    const change = applyOutcome(
      { ...base, level: "shadow", streak: 2 },
      "clean",
    );
    expect(change.events[1]).toMatchObject({
      kind: "promotion_offered",
      toLevel: "approve",
    });
  });
});
