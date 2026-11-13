// SPDX-License-Identifier: Apache-2.0

import type { Metadata } from "next";
import Link from "next/link";
import { DocsHeader, DocsPager } from "@/components/DocsBlocks";

export const metadata: Metadata = { title: "FAQ" };

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "Is Sidereal on mainnet?",
    a: (
      <>
        No. V1 ran as a small mainnet pilot on Blend v2&rsquo;s USDC pool from 2026-07-10 until
        its market matured on 2026-08-09, and the full lifecycle settled real funds end to end.
        Every position has been redeemed. V2 runs on testnet only, and mainnet waits for an
        independent audit. It is early and unaudited; see{" "}
        <Link href="/docs/security">Security and risks</Link>.
      </>
    ),
  },
  {
    q: "What happens to my PT if I do nothing at maturity?",
    a: (
      <>
        Nothing bad. Redemption opens at maturity and stays open indefinitely at the frozen rate.
        There is no deadline, no decay, and no benefit to redeeming quickly. Your principal waits
        for you.
      </>
    ),
  },
  {
    q: "Can YT be worth zero?",
    a: (
      <>
        At maturity, always: YT is the right to a term&rsquo;s interest, and when the term ends
        the right is used up, like an expired coupon. Before maturity, YT&rsquo;s price can fall
        toward zero if the market expects little further interest. Anything you already{" "}
        <em>claimed</em> is yours and unaffected.
      </>
    ),
  },
  {
    q: "Do I earn interest just by holding YT, or do I have to claim?",
    a: (
      <>
        Earning is automatic; collecting is not. Interest builds up on your YT as rates tick
        along, and it is credited to your personal ledger whenever your balance changes. It only
        lands in your wallet when you claim on the Portfolio page. Unclaimed interest survives
        transfers and even maturity (there is a grace window). Claiming just cashes it out.
      </>
    ),
  },
  {
    q: "If I sell my YT, does the buyer get the interest I already earned?",
    a: (
      <>
        No. Every YT transfer settles both sides first: your earned interest is credited to you
        before the balance moves, and the buyer starts earning from the transfer onward. See{" "}
        <Link href="/docs/tokenizer">Tokenizer</Link>.
      </>
    ),
  },
  {
    q: "Why is the PT price below 1 USDC? Is something wrong?",
    a: (
      <>
        That discount is the product. PT works like a savings bond: pay less than face value
        today, receive exactly face value at maturity. The gap, expressed as a yearly rate, is
        the fixed return you lock by buying. See <Link href="/docs/concepts">SY, PT and YT</Link>.
      </>
    ),
  },
  {
    q: "What backs PT and YT? Can more be created than the vault covers?",
    a: (
      <>
        Every PT/YT pair is created against SY locked in the protocol&rsquo;s vault, and the vault
        valued at the current rate always covers all PT at face value plus all uncollected YT
        interest. The numbers to verify this are publicly readable on-chain. Only the protocol can
        create or destroy the tokens; there is no other path.
      </>
    ),
  },
  {
    q: "What if Blend loses money?",
    a: (
      <>
        SY is a Blend position, so a Blend loss is an SY loss. The protocol prices the shortfall
        instead of freezing up: PT redemptions cap at each holder&rsquo;s fair share (everyone
        shares the loss equally, so there is no bank-run race), and PT is paid before YT. See{" "}
        <Link href="/docs/settlement">Settlement and maturity</Link>.
      </>
    ),
  },
  {
    q: "Can the team pause the protocol, change fees, or take my funds?",
    a: (
      <>
        The contracts cannot be upgraded, paused, or used to seize holder funds. The retired pilot
        has no fee setters. New V2 markets do allow their configured contract admins to update
        bounded swap, claimed-yield, and order-taker fees; those limits are enforced in Wasm and
        every update emits an event. See{" "}
        <Link href="/docs/security">Security and risks</Link>.
      </>
    ),
  },
  {
    q: "Why can't I trade size right now?",
    a: (
      <>
        A newly opened market&rsquo;s trading pool is shallow, so large swaps
        move the rate sharply against you. Everything that needs no counterparty (deposit, split,
        claim, recombine, redeem) works at any size. Deepening liquidity is the current growth
        focus.
      </>
    ),
  },
  {
    q: "What happens after this market matures? Will there be longer maturities?",
    a: (
      <>
        Maturity is set per market, so new markets, including longer terms, are fresh deployments
        of the same code rather than changes to an existing one. An existing market&rsquo;s maturity
        can never be extended: the redemption date you bought is fixed forever. Successor markets
        are announced when they deploy.
      </>
    ),
  },
  {
    q: "How do I verify the deployed contracts match the source code?",
    a: (
      <>
        Rebuild from the recorded source commit and compare the result against the on-chain
        bytecode. The one-command process is in{" "}
        <Link href="/docs/contracts">Deployed contracts</Link>.
      </>
    ),
  },
];

export default function FaqPage() {
  return (
    <article>
      <DocsHeader
        kicker="Reference"
        title="FAQ"
        summary="Short answers, with links into the pages that carry the full explanation."
      />

      <dl className="mt-8 flex flex-col">
        {FAQS.map((item) => (
          <div key={item.q} className="border-b border-white/10 py-6 last:border-b-0">
            <dt className="text-base font-semibold text-paper">{item.q}</dt>
            <dd className="mt-2 text-[15px] leading-7 text-smoke [&_a]:text-paper [&_a]:underline [&_a]:decoration-white/30 [&_a]:underline-offset-4 [&_em]:italic">
              {item.a}
            </dd>
          </div>
        ))}
      </dl>

      <DocsPager current="/docs/faq" />
    </article>
  );
}
