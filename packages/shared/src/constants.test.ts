import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as C from "./constants.ts";

// The UI quotes these numbers; they must be the ones the contract enforces.
const sol = readFileSync(new URL("../../../contracts/src/OrmineMiners.sol", import.meta.url), "utf8");
const constant = (name: string) => {
  const m = sol.match(new RegExp(`constant ${name} = ([^;]+);`));
  assert.ok(m, `${name} not found in OrmineMiners.sol`);
  const raw = m[1].replace(/_/g, "").trim();
  const unit = raw.match(/^([\d.]+) (ether|days|hours|minutes)$/);
  if (!unit) return BigInt(raw);
  const mult = { ether: 10n ** 18n, days: 86_400n, hours: 3_600n, minutes: 60n }[unit[2] as "ether"];
  const [int, frac = ""] = unit[1].split(".");
  return (BigInt(int + frac) * mult) / 10n ** BigInt(frac.length);
};

test("constants match the contract", () => {
  assert.equal(constant("MINT_PRICE"), C.MINT_PRICE_WEI);
  assert.equal(constant("MAX_SUPPLY"), BigInt(C.MAX_SUPPLY));
  assert.equal(constant("MAX_PER_TX"), BigInt(C.MAX_PER_TX));
  assert.equal(constant("UPGRADE_PRICE_PER_HASH"), C.UPGRADE_PRICE_PER_HASH_WEI);
  assert.equal(constant("VEIN_SHARE_BPS"), BigInt(C.VEIN_SHARE_BPS));
  assert.equal(constant("RELEASE_BPS"), BigInt(C.RELEASE_BPS));
  assert.equal(constant("EPOCH"), BigInt(C.EPOCH_SECONDS));
  assert.equal(constant("TRAVEL"), BigInt(C.TRAVEL_SECONDS));
  assert.equal(constant("SUNSET_DELAY"), BigInt(C.SUNSET_DELAY_SECONDS));
  assert.equal(constant("ROYALTY_BPS"), BigInt(C.ROYALTY_BPS));
});

test("tier hashrates match the contract", () => {
  const body = sol.slice(sol.indexOf("function _hash("));
  for (const t of C.TIERS) {
    assert.match(body, new RegExp(`tier == ${t.tier}\\) return ${t.hash};`));
  }
});

test("upgrade prices follow the hash gained", () => {
  assert.deepEqual([1, 2, 3, 4].map(C.upgradePriceWei), [30n, 70n, 180n, 0n].map((x) => x * 10n ** 15n));
});
