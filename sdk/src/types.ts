// SPDX-License-Identifier: Apache-2.0

/**
 * Domain types for the sidereal SDK.
 *
 * These mirror the frozen on-chain interfaces in
 * `contracts/shared/types/src/lib.rs` (the `Market` and `StandardizedYield`
 * traits). Numeric on-chain values are `i128`; we surface them as `bigint` to
 * avoid precision loss. Human-readable derivations (APY as a percent) are
 * provided alongside the raw values, never in place of them.
 */

/** Fixed-point scale used by the protocol for ratios (18 decimals, "WAD"). */
export const WAD = 1_000_000_000_000_000_000n;

/** Basis-point denominator (1 bps = 1/10_000). */
export const BPS_DENOMINATOR = 10_000n;

/** Largest swap fee accepted by the AMM contract. */
export const MAX_SWAP_FEE_BPS = BPS_DENOMINATOR - 1n;

/** Largest yield fee accepted by the tokenizer contract (20%). */
export const MAX_YIELD_FEE_BPS = 2_000n;

/** Largest taker fee accepted by the resting-order contract (10%). */
export const MAX_ORDERBOOK_FEE_BPS = 1_000n;

/** The three fungible legs a user can hold or trade. */
export type Asset = "SY" | "PT" | "YT";

/** Deployed Standardized Yield ABI. */
export type VaultVersion = "v1" | "v2";

/** Resolved contract addresses for one market deployment. */
export interface ContractAddresses {
  /** Standardized Yield wrapper (one per underlying). */
  sy: string;
  /** Principal Token. */
  pt: string;
  /** Yield Token. */
  yt: string;
  /** Tokenizer that mints/redeems PT+YT from SY. */
  tokenizer: string;
  /** Time-decay AMM (the PT/SY market). */
  market: string;
  /** Escrowed PT/SY resting-order market. Empty on legacy deployments. */
  orderbook?: string;
}

export interface StellarYTOptions {
  /** Soroban RPC endpoint, e.g. https://soroban-testnet.stellar.org. */
  rpcUrl: string;
  /** Additional RPC endpoints tried in order when the primary is unavailable. */
  rpcFallbackUrls?: string[];
  /** Network passphrase, e.g. "Test SDF Network ; September 2015". */
  networkPassphrase: string;
  /** Funded G-account used only as the source for read simulations. */
  simulationSourceAccount: string;
  /** Deployed contract addresses for the target market. */
  contracts: ContractAddresses;
  /** Vault ABI adapter. Defaults to V2 for new deployments. */
  vaultVersion?: VaultVersion;
}

/** Snapshot of one market's on-chain state. */
export interface MarketState {
  marketId: string;
  /** Underlying asset address backing the SY. */
  underlying: string;
  /** SY per underlying, 18-decimal fixed point (the SY exchange rate). */
  exchangeRate: bigint;
  /** Internal TWAP implied APY, in basis points (what integrators should read). */
  impliedApyBps: bigint;
  /** Spot implied APY, in basis points (single-block, manipulable; display-only). */
  spotApyBps: bigint;
  /** True while the TWAP window is still filling; gate "rate stabilizing" UX. */
  twapWarmingUp: boolean;
  /** Maturity as a Unix timestamp in seconds. */
  maturity: number;
  /** Seconds remaining until maturity (0 once matured). */
  secondsToMaturity: number;
  /** Total PT reserves in the pool. */
  totalPt: bigint;
  /** Total SY reserves in the pool. */
  totalSy: bigint;
  /** Total LP token supply accounted by the AMM. */
  totalLp: bigint;
  /** AMM fee in basis points. */
  feeBps: bigint;
}

export interface SwapArgs {
  marketId: string;
  /** Account initiating the swap. */
  from: string;
  /** Leg being sold. */
  assetIn: Asset;
  /** Leg being bought. */
  assetOut: Asset;
  /** Amount of `assetIn` to sell, in token base units. */
  amountIn: bigint;
  /** Minimum acceptable `assetOut`, in token base units (slippage guard). */
  minAmountOut: bigint;
}

export interface Quote {
  assetIn: Asset;
  assetOut: Asset;
  amountIn: bigint;
  /** Expected output from simulation, in token base units. */
  amountOut: bigint;
  /** Price impact versus a small same-route contract quote, in basis points. */
  priceImpactBps: bigint;
  /** Current pre-trade TWAP implied APY, in basis points. */
  impliedApyBps: bigint;
}

export interface Position {
  holder: string;
  marketId: string;
  syBalance: bigint;
  ptBalance: bigint;
  ytBalance: bigint;
  /** Yield earned by this holder before the tokenizer protocol fee. */
  claimableYield: bigint;
  /** SY the holder receives after the current tokenizer protocol fee. */
  claimableYieldNet: bigint;
  /** Current tokenizer protocol fee in basis points. */
  yieldFeeBps: bigint;
  /** LP tokens held by this holder in the AMM, in base units. */
  lpBalance: bigint;
}

export interface LpPosition {
  holder: string;
  marketId: string;
  /** LP tokens held by this holder in the AMM, in base units. */
  lpBalance: bigint;
  /** Total LP token supply accounted by the AMM. */
  totalLp: bigint;
  /** Holder share of the pool, in basis points. */
  shareBps: bigint;
  /** Pro-rata PT claim if this holder removes all LP now, rounded down. */
  ptValue: bigint;
  /** Pro-rata SY claim if this holder removes all LP now, rounded down. */
  syValue: bigint;
}

export interface MintArgs {
  marketId: string;
  from: string;
  /** Underlying amount to deposit, in token base units. */
  underlyingAmount: bigint;
  /** Minimum SY shares the V2 vault must mint. Pass 0 to opt out. */
  minSyOut: bigint;
}

export interface SplitArgs {
  from: string;
  /**
   * SY shares to split into PT + YT, in base units. The tokenizer mints
   * `syAmount * rate / WAD` of each (asset-unit face). Deposit and split cannot
   * share a transaction (Soroban allows one host-function op per tx), so the UI
   * deposits first, then splits the exact SY the deposit minted.
   */
  syAmount: bigint;
}

export interface RedeemArgs {
  marketId: string;
  from: string;
  /**
   * Before maturity: recombine `amount` PT + `amount` YT back into SY principal.
   * At/after maturity: redeem `amount` PT for its principal in SY
   * (`amount * WAD / maturity_rate`), capped pro-rata under insolvency.
   *
   * Pre-maturity preview (`preview_recombine`) is a point-in-time read of the
   * live rate: the executed SY-share amount may differ if the rate moves
   * before submission. Recombine has no on-chain slippage floor, so a caller
   * needing an exact share count should check the preview against its bound
   * before submitting.
   */
  amount: bigint;
}

export interface RedeemSyArgs {
  marketId: string;
  from: string;
  /** SY shares to burn for the corresponding underlying asset amount. */
  syAmount: bigint;
  /** Minimum underlying the V2 vault must return. Pass 0 to opt out. */
  minUnderlyingOut: bigint;
}

export interface ClaimArgs {
  marketId: string;
  from: string;
}

export interface SetSwapFeeArgs {
  /** Configured AMM admin; this account must authorize the transaction. */
  admin: string;
  /** New swap fee in basis points (0 through 9,999). */
  feeBps: bigint;
}

export interface SetYieldFeeArgs {
  /** Configured tokenizer admin; this account must authorize the transaction. */
  admin: string;
  /** New protocol cut of claimed yield in basis points (0 through 2,000). */
  feeBps: bigint;
}

/** Side of the resting maker order. PT is base and SY is quote. */
export type OrderSide = "Ask" | "Bid";

export interface RestingOrder {
  id: bigint;
  maker: string;
  side: OrderSide;
  /** SY shares per PT face unit, scaled by 1e18. */
  priceWad: bigint;
  originalBase: bigint;
  remainingBase: bigint;
  /** PT for asks or SY for bids still held in escrow. */
  escrowRemaining: bigint;
  expiry: bigint;
  createdAt: bigint;
  prev: bigint | null;
  next: bigint | null;
}

export interface OrderbookConfig {
  admin: string;
  ptToken: string;
  syToken: string;
  maturity: bigint;
  feeRecipient: string;
  takerFeeBps: bigint;
}

export interface OrderFill {
  orderId: bigint;
  maker: string;
  taker: string;
  side: OrderSide;
  baseFilled: bigint;
  quoteAmount: bigint;
  takerFee: bigint;
  remainingBase: bigint;
}

export interface PlaceOrderArgs {
  maker: string;
  side: OrderSide;
  /** PT base amount to buy or sell. */
  baseAmount: bigint;
  /** SY-per-PT limit price, scaled by 1e18. */
  priceWad: bigint;
  /** Unix expiry timestamp; must be no later than market maturity. */
  expiry: bigint;
  /** Existing order immediately before this order in price-time priority. */
  predecessor: bigint | null;
}

export interface FillBestOrderArgs {
  taker: string;
  /** Side of the resting maker order being taken. */
  restingSide: OrderSide;
  /** PT amount to fill. */
  baseAmount: bigint;
  /** Maximum ask price or minimum bid price, scaled by 1e18. */
  limitPriceWad: bigint;
}

export interface CancelOrderArgs {
  maker: string;
  orderId: bigint;
}

export interface PruneExpiredOrdersArgs {
  from: string;
  side: OrderSide;
  maxOrders: number;
}

export interface SetOrderbookFeeArgs {
  admin: string;
  /** New taker fee in basis points (0 through 1,000). */
  feeBps: bigint;
}

export interface AddLiquidityArgs {
  marketId: string;
  from: string;
  /** PT to deposit into the pool, in base units. */
  ptIn: bigint;
  /** SY to deposit into the pool, in base units. */
  syIn: bigint;
  /**
   * Minimum LP tokens to mint, in base units (slippage guard). The AMM panics
   * with SlippageExceeded and reverts the whole invocation (transfers included)
   * if the actual LP minted is below this. Callers must pass a slippage-adjusted
   * bound derived from a preview; the SDK does not default it, so passing 0 opts
   * out of protection entirely.
   */
  minLpOut: bigint;
}

export interface RemoveLiquidityArgs {
  marketId: string;
  from: string;
  /** LP tokens to burn, in base units. */
  lpIn: bigint;
  /**
   * Minimum PT to receive, in base units (slippage guard). The AMM panics with
   * SlippageExceeded and reverts everything if the actual PT out is below this.
   * Caller-supplied from a slippage-adjusted preview; 0 opts out of protection.
   */
  minPtOut: bigint;
  /**
   * Minimum SY to receive, in base units (slippage guard). Same revert semantics
   * as minPtOut; a violation on either leg reverts the whole invocation.
   */
  minSyOut: bigint;
}

export interface BlendWithdrawArgs {
  from: string;
  /** Blend pool contract id. */
  pool: string;
  /** Reserve asset contract id (the SY wrapper's underlying). */
  asset: string;
  /** Underlying to withdraw from liquid supply (RequestType Withdraw), base units. */
  supplyAmount: bigint;
  /** Underlying to withdraw from posted collateral (RequestType WithdrawCollateral). */
  collateralAmount: bigint;
}

/** A built, unsigned Soroban transaction the caller hands to a wallet. */
export interface TransactionEnvelope {
  /** Base64 XDR of the unsigned transaction envelope. */
  xdr: string;
  /** Network passphrase the transaction was built for. */
  networkPassphrase: string;
}
