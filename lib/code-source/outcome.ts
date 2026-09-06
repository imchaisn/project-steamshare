import type { LookupOutcome } from "../rate-limit-constants.ts";
import type { CodeFailureReason } from "./types.ts";

/**
 * Map a code-source failure to its HTTP response and its rate-limit outcome.
 *
 * WHY EVERY REASON RECORDS `unavailable`
 *
 * lib/rate-limit.ts weights HEAVY_OUTCOMES ("failure", "blocked") at 3x
 * against a budget of 20 per order per 15 minutes. If not_ready were recorded
 * as "failure", a buyer pressing retry while waiting for Steam to prompt them
 * would exhaust their own budget after SIX presses — locked out for 15
 * minutes, as a punishment for doing exactly what our error message told them
 * to do.
 *
 * `unavailable` already means precisely this situation. Its docstring reads
 * "order verified, but ... A real buyer hitting an ops problem, NOT an
 * attacker." By the time this function is reached, the caller has proven
 * entitlement: the order matched, the username matched, the account is
 * active. There is nothing left to enumerate, so a specific message leaks
 * nothing an attacker could use.
 */
export function failureResponseFor(reason: CodeFailureReason): {
  outcome: LookupOutcome;
  status: number;
  error: string;
} {
  switch (reason) {
    case "not_ready":
      return {
        outcome: "unavailable",
        status: 409,
        error:
          "Log in to Steam first. When Steam asks for your 5-character code, come back and press Get Code.",
      };
    case "expired":
      return {
        outcome: "unavailable",
        status: 409,
        error:
          "That code expired. Attempt the Steam login again, then press Get Code.",
      };
    case "supplier_error":
      // Deliberately generic and deliberately silent about which site —
      // a buyer has no use for knowing which of our websites holds their
      // account, and naming it would leak how we are structured to competitors.
      return {
        outcome: "unavailable",
        status: 503,
        error: "Code service temporarily unavailable, contact support",
      };
  }
}
