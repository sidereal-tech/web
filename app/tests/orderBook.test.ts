// SPDX-License-Identifier: Apache-2.0

import type { Quote } from "@sidereal/sdk";
import { describe, expect, it } from "vitest";
import { formatPriceWad, summarizeBook, walkSide, type BookLevel } from "../lib/useOrderBook";

const WAD = 1_000_000_000_000_000_000n;

/** A quote whose output is `amountIn * rateNum / rateDen`, i.e. a fixed price. */
function linearQuote(rateNum: bigint, rateDen: bigint) {
  return async (amountIn: bigint): Promise<Quote> => ({
    assetIn: "SY",
    assetOut: "PT",
    amountIn,
    amountOut: (amountIn * rateNum) / rateDen,
    priceImpactBps: 0n,
    impliedApyBps: 800n,
  });
}

const askLegs = (q: Quote) => ({ sy: q.amountIn, pt: q.amountOut });

describe("walkSide", () => {
  it("recovers the marginal price of each slice, not the average", async () => {
    // A curve that gets worse with size: output is amountIn minus a quadratic
    // penalty, so later slices must price strictly worse than earlier ones.
    const quoteAt = async (amountIn: bigint): Promise<Quote> => ({
      assetIn: "SY",
      assetOut: "PT",
      amountIn,
      amountOut: amountIn - (amountIn * amountIn) / (1_000_000n * WAD),
      priceImpactBps: 0n,
      impliedApyBps: 800n,
    });

    const levels = await walkSide([100n * WAD, 200n * WAD, 400n * WAD], quoteAt, askLegs);

    expect(levels).toHaveLength(3);
    // Marginal price must be monotonically worse (higher SY per PT) with depth.
    expect(levels[1]!.priceWad).toBeGreaterThan(levels[0]!.priceWad);
    expect(levels[2]!.priceWad).toBeGreaterThan(levels[1]!.priceWad);
  });

  it("reports cumulative size and notional, and slice size separately", async () => {
    const levels = await walkSide([10n * WAD, 30n * WAD], linearQuote(1n, 1n), askLegs);

    expect(levels[0]!.cumulativeSize).toBe(10n * WAD);
    expect(levels[0]!.sliceSize).toBe(10n * WAD);
    expect(levels[1]!.cumulativeSize).toBe(30n * WAD);
    // The second rung's slice is the difference, not the whole cumulative size.
    expect(levels[1]!.sliceSize).toBe(20n * WAD);
    expect(levels[1]!.cumulativeNotional).toBe(30n * WAD);
  });

  it("ends the walk at the depth a thin pool actually runs out, rather than failing", async () => {
    // The pool quotes the first two rungs and reverts beyond them.
    const quoteAt = async (amountIn: bigint): Promise<Quote> => {
      if (amountIn > 20n * WAD) throw new Error("MarketNotSeeded");
      return {
        assetIn: "SY",
        assetOut: "PT",
        amountIn,
        amountOut: amountIn,
        priceImpactBps: 0n,
        impliedApyBps: 800n,
      };
    };

    const levels = await walkSide([10n * WAD, 20n * WAD, 40n * WAD], quoteAt, askLegs);

    // Two rungs of real depth beat an empty book plus an error.
    expect(levels).toHaveLength(2);
  });

  it("stops rather than emitting a level when a slice would be zero or negative", async () => {
    // A pool that stops giving out anything past the first rung: the second
    // slice is zero PT for more SY, which has no finite price.
    const quoteAt = async (amountIn: bigint): Promise<Quote> => ({
      assetIn: "SY",
      assetOut: "PT",
      amountIn,
      amountOut: amountIn > 10n * WAD ? 10n * WAD : amountIn,
      priceImpactBps: 0n,
      impliedApyBps: 800n,
    });

    const levels = await walkSide([10n * WAD, 20n * WAD], quoteAt, askLegs);
    expect(levels).toHaveLength(1);
  });
});

describe("summarizeBook", () => {
  const level = (priceWad: bigint): BookLevel => ({
    cumulativeSize: WAD,
    sliceSize: WAD,
    priceWad,
    impliedApyBps: 800n,
    cumulativeNotional: priceWad,
  });

  it("mids the two inside prices and quotes the spread in bps of the mid", () => {
    // Ask 1.02, bid 0.98 -> mid 1.00, spread 0.04 = 400 bps.
    const { midWad, spreadBps } = summarizeBook(
      [level(1_020_000_000_000_000_000n)],
      [level(980_000_000_000_000_000n)],
    );
    expect(midWad).toBe(WAD);
    expect(spreadBps).toBe(400n);
  });

  it("refuses to invent a mid from a one-sided book", () => {
    expect(summarizeBook([level(WAD)], [])).toEqual({ midWad: null, spreadBps: null });
    expect(summarizeBook([], [level(WAD)])).toEqual({ midWad: null, spreadBps: null });
    expect(summarizeBook([], [])).toEqual({ midWad: null, spreadBps: null });
  });
});

describe("formatPriceWad", () => {
  it("keeps sub-stroop precision that a token formatter would round away", () => {
    // PT trades a hair under par for most of a market's life; the digits that
    // matter are exactly the ones a 2dp display would discard.
    expect(formatPriceWad(998_765_400_000_000_000n)).toBe("0.99876");
    expect(formatPriceWad(WAD)).toBe("1.00000");
  });

  it("does not lose the leading zero on a sub-par price", () => {
    expect(formatPriceWad(12_300_000_000_000_000n)).toBe("0.01230");
  });
});
