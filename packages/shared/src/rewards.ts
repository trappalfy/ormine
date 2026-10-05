import { RELEASE_BPS } from "./constants.ts";

// What a vein releases over the current epoch, given its stored balance at the epoch start.
export const epochRelease = (balanceAtEpochStart: bigint) => (balanceAtEpochStart * BigInt(RELEASE_BPS)) / 10_000n;

// Estimated share of today's release for a miner: hash / totalHash * release.
// An estimate from current numbers, not a promise; the UI labels it as such.
export function todayEstimate(minerHash: bigint, veinTotalHash: bigint, release: bigint): bigint {
  if (veinTotalHash === 0n) return 0n;
  return (release * minerHash) / veinTotalHash;
}

// Share of a vein's hashrate in basis points (0..10_000).
export function shareBps(hash: bigint, totalHash: bigint): number {
  if (totalHash === 0n) return 0;
  return Number((hash * 10_000n) / totalHash);
}
