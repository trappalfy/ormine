import { formatUnits } from "viem";

/** Token amount with 2–4 decimals ("12.3456"), as the vein folders show it. */
export function fmtToken(value: bigint | undefined, decimals = 18, maxFrac = 4): string {
  if (value === undefined) return "…";
  const n = Number(formatUnits(value, decimals));
  if (n !== 0 && n < 10 ** -maxFrac) return `<${(10 ** -maxFrac).toFixed(maxFrac)}`;
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: maxFrac });
}

export const fmtEth = (wei: bigint) => `${Number(formatUnits(wei, 18)).toLocaleString("en-US", { maximumFractionDigits: 6 })} ETH`;

export const fmtInt = (n: bigint | number) => Number(n).toLocaleString("en-US");

/** "14h left", "35m left" until a unix timestamp. */
export function timeLeft(at: bigint | number, now: number): string {
  const s = Math.max(0, Number(at) - now);
  if (s >= 3600) return `${Math.ceil(s / 3600)}h left`;
  return `${Math.max(1, Math.ceil(s / 60))}m left`;
}

export const pct = (bps: number) => `${(bps / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
