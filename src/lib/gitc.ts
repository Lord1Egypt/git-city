/**
 * Constants and ABI for accepting GITCITY (GITC) token as payment on Base.
 * https://basescan.org/token/0xd523f92f5f313288cf69ac9ca456b8a7d7a6dba3
 *
 * A player pays for Pixels with a plain ERC20 transfer to the burn address.
 */

export const GITC_ADDRESS = "0xd523f92f5f313288cf69ac9ca456b8a7d7a6dba3" as const;
export const GITC_DECIMALS = 18;
export const GITC_SYMBOL = "GITC";
export const GITC_NAME = "GITCITY";
export const GITC_CHAIN_ID = 8453; // Base mainnet

/**
 * Where GITC paid for Pixels goes: the dead address, so every payment is a
 * burn. Git City takes no money, so nothing is sent to a wallet anyone owns.
 */
export const GITC_BURN_ADDRESS = "0x000000000000000000000000000000000000dEaD" as const;

/** USDC on Base (6 decimals) — an input token for the Exchange. */
export const USDC_BASE_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

/** 0x's sentinel address for the chain-native token (ETH on Base). */
export const NATIVE_ETH_SENTINEL = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" as const;

/** Default slippage tolerance for GITC swaps (micro-cap → needs headroom). */
export const GITC_SWAP_DEFAULT_SLIPPAGE_BPS = 300; // 3%

/** Selectable slippage presets shown in the Exchange ⚙ control, in bps. */
export const GITC_SWAP_SLIPPAGE_PRESETS_BPS = [100, 300, 500] as const;

/** An input token the player can sell to acquire GITC in the Exchange. */
export interface SwapInput {
  id: "USDC" | "ETH";
  label: string;
  decimals: number;
  /** What the 0x Swap API expects as `sellToken`. */
  zeroxToken: string;
  /** What Uniswap's `inputCurrency` query param expects (fallback deep-link). */
  uniToken: string;
  /** Brand dot color for the token pill. */
  dot: string;
}

export const SWAP_INPUTS: SwapInput[] = [
  { id: "USDC", label: "USDC", decimals: 6, zeroxToken: USDC_BASE_ADDRESS, uniToken: USDC_BASE_ADDRESS, dot: "#2775ca" },
  { id: "ETH", label: "ETH", decimals: 18, zeroxToken: NATIVE_ETH_SENTINEL, uniToken: "ETH", dot: "#8a92b2" },
];

/**
 * Uniswap deep-link to buy GITC on Base — the Exchange's fallback when the 0x
 * native swap is unavailable (no API key) or can't route the trade.
 */
export function buildUniswapSwapUrl(opts: { inputCurrency: string; amount?: number }): string {
  const base =
    `https://app.uniswap.org/swap?chain=base` +
    `&inputCurrency=${encodeURIComponent(opts.inputCurrency)}` +
    `&outputCurrency=${GITC_ADDRESS}`;
  return opts.amount && opts.amount > 0 ? `${base}&exactAmount=${opts.amount}&exactField=input` : base;
}

/** Discount applied when paying with GITC, in basis points (0 = no discount). */
export const GITC_DISCOUNT_BPS = 0;

/** Slippage buffer applied to the GITC quote to absorb price drift, in basis points. */
export const GITC_SLIPPAGE_BPS = 500; // 5%

/** Quote validity window in seconds. */
export const GITC_QUOTE_TTL_SECONDS = 300; // 5 min

/** Confirmations to wait before activating an ad / crediting pixels. */
export const GITC_MIN_CONFIRMATIONS = BigInt(3);

export const GITC_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;

/** Format a wei amount to a short human-readable GITC string. */
export function formatGitcAmount(wei: bigint): string {
  const tokens = Number(wei) / 10 ** GITC_DECIMALS;
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(2)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(2)}K`;
  return tokens.toFixed(2);
}

/** True when GITC payments are wired up (Reown project id present). */
export function isGitcEnabled(): boolean {
  return !!process.env.NEXT_PUBLIC_REOWN_PROJECT_ID;
}
