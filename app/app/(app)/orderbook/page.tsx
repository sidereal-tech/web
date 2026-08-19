// SPDX-License-Identifier: Apache-2.0

"use client";

import { useMemo, useState } from "react";
import { bpsToPercent, formatTokenAmount, maturityStatus } from "@/lib/format";
import { useSidereal } from "@/lib/useSidereal";
import { useMarketStatus } from "@/lib/useMarket";
import { useOrderBook, formatPriceWad, type BookLevel } from "@/lib/useOrderBook";
import { MaturityBadge } from "@/components/MaturityBadge";

/** The ladder's smallest rung, as a fraction of pool PT reserves. Sized so the
 *  deepest rung (32x) walks a meaningful share of the pool rather than dust the
 *  curve barely registers. */
const BASE_STEP_DIVISOR = 400n;

type Side = "ask" | "bid";

interface SelectedLevel {
  side: Side;
  level: BookLevel;
}

export default function OrderBookPage() {
  const { cfg } = useSidereal();
  const { market, loading: marketLoading } = useMarketStatus();
  const [selected, setSelected] = useState<SelectedLevel | null>(null);

  // Size the ladder against real reserves so the book's shape reflects this
  // pool, not an arbitrary clip size.
  const baseStep = useMemo(() => {
    if (!market || market.totalPt <= 0n) return null;
    const step = market.totalPt / BASE_STEP_DIVISOR;
    return step > 0n ? step : null;
  }, [market]);

  const book = useOrderBook(baseStep);

  const matured = market ? market.secondsToMaturity <= 0 : false;
  const deepest = useMemo(() => {
    const all = [...book.asks, ...book.bids];
    return all.reduce((max, l) => (l.cumulativeSize > max ? l.cumulativeSize : max), 0n);
  }, [book.asks, book.bids]);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Order book</h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-7 text-smoke">
            The pool is an AMM, so there are no resting orders. This walks the live curve
            at increasing size and shows the marginal price of each slice — the price a
            resting order at that depth would actually fill at.
          </p>
        </div>
        <MaturityBadge maturity={market ? market.maturity : null} />
      </header>

      {matured ? (
        <p className="panel px-5 py-4 text-[14px] text-smoke">
          This market matured {maturityStatus(market!.maturity)}. Trading is closed, so the
          book is empty by design — PT now redeems at its face value rather than a price.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="panel">
          <LadderHeader />

          {book.loading || marketLoading ? (
            <LadderSkeleton />
          ) : book.error ? (
            <p className="px-5 py-10 text-center text-[14px] text-smoke">
              No depth to show. The pool has no liquidity yet, so the curve cannot be
              quoted at any size.
            </p>
          ) : (
            <>
              {/* Asks stack downward toward the mid, so the best ask sits closest
                  to it — the conventional reading order for a book. */}
              <ol className="flex flex-col-reverse">
                {book.asks.map((level, i) => (
                  <LadderRow
                    key={`ask-${i}`}
                    side="ask"
                    level={level}
                    deepest={deepest}
                    decimals={cfg.decimals}
                    selected={selected?.side === "ask" && selected.level === level}
                    onSelect={() => setSelected({ side: "ask", level })}
                  />
                ))}
              </ol>

              <MidBand
                midWad={book.midWad}
                spreadBps={book.spreadBps}
                impliedApyBps={market?.impliedApyBps ?? null}
                twapWarmingUp={market?.twapWarmingUp ?? false}
              />

              <ol>
                {book.bids.map((level, i) => (
                  <LadderRow
                    key={`bid-${i}`}
                    side="bid"
                    level={level}
                    deepest={deepest}
                    decimals={cfg.decimals}
                    selected={selected?.side === "bid" && selected.level === level}
                    onSelect={() => setSelected({ side: "bid", level })}
                  />
                ))}
              </ol>
            </>
          )}
        </section>

        <LevelDetail selected={selected} midWad={book.midWad} decimals={cfg.decimals} />
      </div>
    </div>
  );
}

function LadderHeader() {
  return (
    <div className="grid grid-cols-[1fr_1fr_1fr] gap-4 border-b border-white/10 px-5 py-3">
      <span className="label-data">Size · PT</span>
      <span className="label-data text-right">Price · SY</span>
      <span className="label-data text-right">Implied APY</span>
    </div>
  );
}

function LadderSkeleton() {
  return (
    <div className="divide-y divide-white/5">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between px-5 py-2.5">
          <span className="h-3 w-24 animate-pulse bg-white/10" />
          <span className="h-3 w-20 animate-pulse bg-white/10" />
          <span className="h-3 w-16 animate-pulse bg-white/10" />
        </div>
      ))}
    </div>
  );
}

function LadderRow({
  side,
  level,
  deepest,
  decimals,
  selected,
  onSelect,
}: {
  side: Side;
  level: BookLevel;
  deepest: bigint;
  decimals: number;
  selected: boolean;
  onSelect: () => void;
}) {
  // Depth bar width is cumulative size against the deepest rung on either side,
  // so both halves of the book share one scale and can be compared by eye.
  const pct = deepest > 0n ? Number((level.cumulativeSize * 100n) / deepest) : 0;

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`relative grid w-full grid-cols-[1fr_1fr_1fr] gap-4 px-5 py-2.5 text-left transition
          ${selected ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"}`}
      >
        <span
          aria-hidden
          className={`absolute inset-y-0 left-0 ${side === "ask" ? "bg-white/[0.05]" : "bg-white/[0.09]"}`}
          style={{ width: `${pct}%` }}
        />
        <span className="relative font-mono text-[13px] text-smoke">
          {formatTokenAmount(level.cumulativeSize, decimals, 2)}
        </span>
        <span className="relative text-right font-mono text-[13px] text-paper">
          {formatPriceWad(level.priceWad)}
        </span>
        <span className="relative text-right font-mono text-[13px] text-ash">
          {bpsToPercent(level.impliedApyBps)}
        </span>
      </button>
    </li>
  );
}

function MidBand({
  midWad,
  spreadBps,
  impliedApyBps,
  twapWarmingUp,
}: {
  midWad: bigint | null;
  spreadBps: bigint | null;
  impliedApyBps: bigint | null;
  twapWarmingUp: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-y border-white/10 bg-white/[0.02] px-5 py-3">
      <div className="flex items-baseline gap-3">
        <span className="label-data">Mid</span>
        <span className="glow-signal font-mono text-[15px] text-amber">
          {midWad !== null ? formatPriceWad(midWad) : "—"}
        </span>
      </div>
      <div className="flex items-baseline gap-3">
        <span className="label-data">Spread</span>
        <span className="font-mono text-[13px] text-paper">
          {spreadBps !== null ? `${bpsToPercent(spreadBps)}` : "—"}
        </span>
      </div>
      <div className="flex items-baseline gap-3">
        <span className="label-data">TWAP APY</span>
        <span className="font-mono text-[13px] text-paper">
          {impliedApyBps !== null ? bpsToPercent(impliedApyBps) : "—"}
          {twapWarmingUp ? <span className="ml-2 text-ash">warming up</span> : null}
        </span>
      </div>
    </div>
  );
}

function LevelDetail({
  selected,
  midWad,
  decimals,
}: {
  selected: SelectedLevel | null;
  midWad: bigint | null;
  decimals: number;
}) {
  if (!selected) {
    return (
      <aside className="panel h-fit px-5 py-5">
        <h2 className="label-data">Level detail</h2>
        <p className="mt-3 text-[14px] leading-6 text-smoke">
          Select a row to see what a trade to that depth costs, and how far its price sits
          from the mid.
        </p>
      </aside>
    );
  }

  const { side, level } = selected;
  // Slippage against the mid is the number that matters when walking a book:
  // it is what the depth costs you, separate from the fee.
  const fromMidBps =
    midWad !== null && midWad > 0n
      ? ((level.priceWad - midWad) * 10_000n) / midWad
      : null;

  return (
    <aside className="panel h-fit px-5 py-5">
      <h2 className="label-data">{side === "ask" ? "Buying PT" : "Selling PT"}</h2>
      <dl className="mt-4 space-y-3">
        <Row label="Depth" value={`${formatTokenAmount(level.cumulativeSize, decimals, 4)} PT`} />
        <Row label="This slice" value={`${formatTokenAmount(level.sliceSize, decimals, 4)} PT`} />
        <Row label="Marginal price" value={`${formatPriceWad(level.priceWad)} SY`} />
        <Row
          label="Notional"
          value={`${formatTokenAmount(level.cumulativeNotional, decimals, 4)} SY`}
        />
        <Row label="Implied APY" value={bpsToPercent(level.impliedApyBps)} />
        <Row
          label="From mid"
          value={fromMidBps !== null ? bpsToPercent(fromMidBps) : "—"}
        />
      </dl>
      <p className="mt-5 border-t border-white/10 pt-4 text-[13px] leading-6 text-ash">
        Quoted from the contract by simulation, not modelled. A trade submitted later can
        differ if the pool moves in between.
      </p>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[13px] text-smoke">{label}</dt>
      <dd className="font-mono text-[13px] text-paper">{value}</dd>
    </div>
  );
}
