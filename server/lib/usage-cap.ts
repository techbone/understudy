import { getUserUsageCents } from "@agent-native/core/usage";
import { fail } from "@agent-native/core/action";

/** Model spend one account may use before new runs are refused ($5, about 30 runs). */
export const USAGE_CAP_CENTS = 500;

/**
 * The shared demo runs on one funded model key, so each account gets a spend
 * allowance. A run already in progress can always finish; only starting a new
 * one is refused.
 */
export async function usedCents(email: string): Promise<number> {
  return getUserUsageCents(email);
}

export function assertUnderCap(used: number) {
  const cap = USAGE_CAP_CENTS;
  if (used >= cap) {
    fail(
      `This demo account has used its model allowance ($${(cap / 100).toFixed(2)}). Nothing is lost: the runbooks, history and ladder are still here to look at.`,
      { errorCode: "usage_cap_reached", statusCode: 429 },
    );
  }
}
