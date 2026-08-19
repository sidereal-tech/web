// SPDX-License-Identifier: Apache-2.0

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Quote } from "@sidereal/sdk";
import { appConfig } from "./config";
import { readQuote } from "./sdk";

/**
 * A PT/SY AMM has no order book — there are no resting orders to show. What it
 * does have is a curve, and a curve answers the same question an order book
 * answers: "what price do I get at what size, and how deep does it stay good?"
 *
 * This builds that view by quoting the real contract at a ladder of sizes and
 * reading the marginal price of each step. Level i's price is not the average
 * price of a size-i trade; it is the price of the slice between level i-1 and
 * level i, which is exactly what a resting order at that depth would fill at.
 * That makes the spread and the shape of the book honest rather than decorative:
 * a thin pool visibly widens as you walk down it.
 *
 * Every number here comes from `quote_*` on-chain simulation. Nothing is
 * modelled client-side, so what the ladder shows is what a trade would execute
 * at, minus only the drift between simulation and submission.
 */

/** Ladder sizes as multiples of the base step, geometric so the book covers
 *  both a retail clip and a size that visibly moves a thin pool. */
const SIZE_STEPS = [1, 2, 4, 8, 16, 32] as const;

export interface BookLevel {
  /** Cumulative size at this depth, in PT base units. */
  cumulativeSize: bigint;
  /** Size of this slice alone, in PT base units. */
  sliceSize: bigint;
  /** Marginal price of this slice, SY per PT, scaled by 1e18. */
  priceWad: bigint;
  /** Implied APY after a trade of `cumulativeSize`, in basis points. */
  impliedApyBps: bigint;
  /** Cumulative SY that changes hands to reach this depth, base units. */
  cumulativeNotional: bigint;
}

export interface OrderBook {
  /** Asks: the cost of BUYING PT, cheapest first. */
  asks: BookLevel[];
  /** Bids: the proceeds of SELLING PT, best first. */
  bids: BookLevel[];
  /** Midpoint of best bid and best ask, SY per PT scaled by 1e18. */
  midWad: bigint | null;
  /** Best-ask minus best-bid, in basis points of the mid. */
  spreadBps: bigint | null;
  loading: boolean;
  /** Set when the pool cannot be quoted at all (unseeded, matured, RPC down). */
  error: unknown;
}

const WAD = 1_000_000_000_000_000_000n;

/** Marginal price of the slice between two cumulative quotes, SY per PT (WAD). */
function marginalPrice(
  sliceSy: bigint,
  slicePt: bigint,
): bigint | null {
  if (slicePt <= 0n || sliceSy <= 0n) return null;
  return (sliceSy * WAD) / slicePt;
}

/**
 * Walks one side of the book. `quoteAt` returns the quote for a cumulative
 * size; consecutive quotes are differenced to recover each slice.
 *
 * A level that fails to quote ends the walk rather than failing the book: on a
 * thin pool the deep levels genuinely do not exist, and showing the shallow
 * ones that do is more useful than showing nothing.
 */
export async function walkSide(
  sizes: bigint[],
  quoteAt: (size: bigint) => Promise<Quote>,
  /** Reads (sy, pt) out of a quote in the direction being walked. */
  legs: (quote: Quote, size: bigint) => { sy: bigint; pt: bigint },
): Promise<BookLevel[]> {
  const levels: BookLevel[] = [];
  let prevSy = 0n;
  let prevPt = 0n;

  for (const size of sizes) {
    let quote: Quote;
    try {
      quote = await quoteAt(size);
    } catch {
      break; // depth ends here
    }
    const { sy, pt } = legs(quote, size);
    const sliceSy = sy - prevSy;
    const slicePt = pt - prevPt;
    const priceWad = marginalPrice(sliceSy, slicePt);
    if (priceWad === null) break;

    levels.push({
      cumulativeSize: pt,
      sliceSize: slicePt,
      priceWad,
      impliedApyBps: quote.impliedApyBps,
      cumulativeNotional: sy,
    });
    prevSy = sy;
    prevPt = pt;
  }
  return levels;
}

/**
 * Builds both sides of the book around the current pool state.
 *
 * `baseStep` is the smallest ladder rung in PT base units. Callers should size
 * it against the pool so the ladder spans a meaningful fraction of reserves
 * rather than a dust trade the curve barely registers.
 */
/**
 * Mid and spread from the two inside prices.
 *
 * The spread is quoted in basis points OF THE MID rather than in absolute SY,
 * so it stays comparable as PT drifts toward par over the life of the market.
 * Both sides are required: a one-sided book has no meaningful mid, and
 * inventing one from the single quote available would be a number that looks
 * like a price but is not.
 */
export function summarizeBook(
  asks: BookLevel[],
  bids: BookLevel[],
): { midWad: bigint | null; spreadBps: bigint | null } {
  const bestAsk = asks[0]?.priceWad ?? null;
  const bestBid = bids[0]?.priceWad ?? null;
  if (bestAsk === null || bestBid === null) return { midWad: null, spreadBps: null };

  const midWad = (bestAsk + bestBid) / 2n;
  if (midWad <= 0n) return { midWad: null, spreadBps: null };
  return { midWad, spreadBps: ((bestAsk - bestBid) * 10_000n) / midWad };
}

export function useOrderBook(baseStep: bigint | null, refreshKey: unknown = 0): OrderBook {
  const [book, setBook] = useState<OrderBook>({
    asks: [],
    bids: [],
    midWad: null,
    spreadBps: null,
    loading: true,
    error: null,
  });

  // Guards against a slow earlier request landing after a newer one.
  const runIdRef = useRef(0);

  const build = useCallback(async (step: bigint, runId: number) => {
    const cfg = appConfig();
    const sizes = SIZE_STEPS.map((m) => step * BigInt(m));

    // The book is a pure read, so it quotes from the shared simulation account
    // rather than the connected wallet. That keeps it rendering for a visitor
    // who has not connected — the depth of a market is public information.
    const base = {
      marketId: cfg.marketId,
      from: cfg.simulationSourceAccount,
      minAmountOut: 0n,
    } as const;

    // Asks: spend SY to receive PT. The ladder is denominated in PT, so the
    // exact-in direction is quoted by its SY leg and differenced in PT.
    const asks = await walkSide(
      sizes,
      (size) => readQuote({ ...base, assetIn: "SY", assetOut: "PT", amountIn: size }, cfg),
      (quote) => ({ sy: quote.amountIn, pt: quote.amountOut }),
    );

    // Bids: sell PT to receive SY.
    const bids = await walkSide(
      sizes,
      (size) => readQuote({ ...base, assetIn: "PT", assetOut: "SY", amountIn: size }, cfg),
      (quote) => ({ sy: quote.amountOut, pt: quote.amountIn }),
    );

    if (runId !== runIdRef.current) return;

    const { midWad, spreadBps } = summarizeBook(asks, bids);
    setBook({
      asks,
      bids,
      midWad,
      spreadBps,
      loading: false,
      error: asks.length === 0 && bids.length === 0 ? new Error("no depth") : null,
    });
  }, []);

  useEffect(() => {
    if (baseStep === null || baseStep <= 0n) {
      setBook((b) => ({ ...b, loading: true }));
      return;
    }
    const runId = ++runIdRef.current;
    setBook((b) => ({ ...b, loading: true }));
    build(baseStep, runId).catch((error) => {
      if (runId !== runIdRef.current) return;
      setBook({
        asks: [],
        bids: [],
        midWad: null,
        spreadBps: null,
        loading: false,
        error,
      });
    });
  }, [baseStep, refreshKey, build]);

  return book;
}

/** Formats a WAD-scaled SY-per-PT price for the ladder. */
export function formatPriceWad(priceWad: bigint, fractionDigits = 5): string {
  const whole = priceWad / WAD;
  const frac = priceWad % WAD;
  const fracStr = frac.toString().padStart(18, "0").slice(0, fractionDigits);
  return `${whole}.${fracStr}`;
}
