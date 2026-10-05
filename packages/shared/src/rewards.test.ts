import { test } from "node:test";
import assert from "node:assert/strict";
import { epochRelease, todayEstimate, shareBps } from "./rewards.ts";

// Example from ORMINE_TECH_SPEC.md 6.7: 100 NVDA, 1%/day, 4000 H total, Tier II (25 H) gets 0.00625 NVDA.
test("spec example 6.7", () => {
  const e18 = 10n ** 18n;
  const release = epochRelease(100n * e18);
  assert.equal(release, e18);
  assert.equal(todayEstimate(25n, 4_000n, release), 6_250_000_000_000_000n);
});

test("empty vein and share", () => {
  assert.equal(todayEstimate(10n, 0n, 100n), 0n);
  assert.equal(shareBps(25n, 4_000n), 62);
});
