import { describe, expect, it } from "vitest";

import { assertUnderCap, USAGE_CAP_CENTS } from "./usage-cap";

describe("usage cap", () => {
  it("allows spend below the cap and refuses at or above it", () => {
    expect(() => assertUnderCap(0)).not.toThrow();
    expect(() => assertUnderCap(USAGE_CAP_CENTS - 1)).not.toThrow();
    expect(() => assertUnderCap(USAGE_CAP_CENTS)).toThrow(/model allowance/);
  });
});
