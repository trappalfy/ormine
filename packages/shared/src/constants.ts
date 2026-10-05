// Mechanics numbers used in UI copy and in client-side estimates.
// They mirror the constants in contracts/src/OrmineMiners.sol; constants.test.ts fails if the two drift.
// Confirmed by the owner on 2026-10-05 (ORMINE_TECH_SPEC.md, section 14).

export const MINT_PRICE_WEI = 20_000_000_000_000_000n; // 0.02 ETH
export const MAX_SUPPLY = 10_000;
export const MAX_PER_TX = 10;
export const UPGRADE_PRICE_PER_HASH_WEI = 2_000_000_000_000_000n; // 0.002 ETH per hash gained, the mint's rate

export const VEIN_SHARE_BPS = 7_000; // 70% of every mint and upgrade goes to the miner's vein
export const RELEASE_BPS = 100; // 1% of a vein's balance per epoch
export const EPOCH_SECONDS = 86_400; // 24 h
export const TRAVEL_SECONDS = 86_400; // 24 h
export const SUNSET_DELAY_SECONDS = 604_800; // 7 days
export const ROYALTY_BPS = 500; // 5%

export const VEIN_SHARE_PCT = VEIN_SHARE_BPS / 100;
export const TEAM_SHARE_PCT = 100 - VEIN_SHARE_PCT;
export const RELEASE_PCT = RELEASE_BPS / 100;
export const EPOCH_HOURS = EPOCH_SECONDS / 3600;
export const TRAVEL_HOURS = TRAVEL_SECONDS / 3600;

export type TierId = 1 | 2 | 3 | 4;

export const TIERS = [
  { tier: 1, roman: "I", name: "Digger", slug: "digger", hash: 10, desc: "Pickaxe. Where every miner starts." },
  { tier: 2, roman: "II", name: "Miner", slug: "miner", hash: 25, desc: "A helmet with a headlamp for deeper tunnels." },
  { tier: 3, roman: "III", name: "Driller", slug: "driller", hash: 60, desc: "A jackhammer for thicker veins." },
  { tier: 4, roman: "IV", name: "Rig", slug: "rig", hash: 150, desc: "All machine. The fastest dig in the mine." },
] as const satisfies readonly { tier: TierId; roman: string; name: string; slug: string; hash: number; desc: string }[];

export const tierInfo = (tier: number) => TIERS[Math.min(Math.max(tier, 1), 4) - 1];

/** ETH (wei) to move a miner from `tier` to the next one; 0 at the top tier. */
export const upgradePriceWei = (tier: number) =>
  tier >= 4 ? 0n : BigInt(tierInfo(tier + 1).hash - tierInfo(tier).hash) * UPGRADE_PRICE_PER_HASH_WEI;

// Veins the landing shows before the contracts are deployed. Live pages read the list from the contract.
export const LAUNCH_VEINS = ["NVDA", "TSLA", "AAPL"] as const;
