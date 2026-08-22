// SPDX-License-Identifier: Apache-2.0

import type { ContractError } from "@sidereal/sdk";

// Which contract a user action talks to, so a numeric error code maps to the
// right message (codes are per-contract enums and overlap across contracts).
export type ErrorContext = "amm" | "tokenizer" | "sy" | "orderbook";

const MESSAGES: Record<ErrorContext, Record<number, string>> = {
  amm: {
    4: "Enter a valid amount.",
    9: "This market has no liquidity yet.",
    10: "This market has matured.",
    11: "Price moved beyond your slippage tolerance. Try again.",
    12: "Not enough liquidity for this trade.",
  },
  tokenizer: {
    3: "Invalid maturity.",
    4: "Enter a valid amount.",
    5: "PT and YT amounts must match.",
    6: "This market has matured.",
    7: "Amount is too large.",
    8: "The market is still live.",
    9: "This market has insufficient escrow coverage.",
    10: "Enter a valid claimed-yield fee.",
    11: "Only the configured admin can change this fee.",
    12: "This market's fee recipient cannot receive claimed-yield fees.",
  },
  sy: {
    3: "Enter a valid amount.",
    4: "Invalid exchange rate.",
    5: "Insufficient balance.",
    6: "Amount is too large.",
    12: "The first deposit is too small to open this market.",
    13: "This deposit exceeds the market cap.",
    14: "Only the configured admin can change the deposit cap.",
  },
  orderbook: {
    4: "Enter a valid amount.",
    5: "Enter a valid limit price.",
    6: "Choose an expiry before market maturity.",
    8: "Only the configured admin can change this fee.",
    9: "That resting order no longer exists.",
    10: "Only the maker can cancel this order.",
    12: "The book moved while placing. Refresh and try again.",
    13: "This order crosses the book. Fill the best order first.",
    15: "The best price moved beyond your limit.",
    16: "This order expired. Refresh the book.",
    17: "This market has matured; only cancellation remains available.",
  },
};

function isContractError(err: unknown): err is ContractError {
  return err instanceof Error && err.name === "ContractError";
}

/** Turns any thrown value into a user-facing message for the given context. */
export function describeError(err: unknown, ctx: ErrorContext): string {
  if (isContractError(err)) {
    const { code } = err;
    if (code !== null) {
      return MESSAGES[ctx][code] ?? `Transaction failed (error #${code}).`;
    }
    return err.raw;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}
