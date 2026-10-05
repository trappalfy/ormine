# Ormine contracts: security notes

No external audit. These notes list what was checked and why the remaining tool warnings are accepted.

## What protects players

- No function moves a vein's stock anywhere except to the miners that earned it (`claim`). There is no withdrawal, sweep, proxy, `delegatecall` or upgrade path.
- `VeinFunder` holds the vein share of mints in ETH. ETH can only leave through `convert`, which swaps it for the same vein's stock on Uniswap V3 and deposits it into that vein. Each swap is capped at `MAX_CONVERT` (2 ETH) and must return at least 98.5% of the Chainlink fair amount. Feeds older than 26 h or a stock in a corporate action (`oraclePaused`) stop conversions.
- Economics (price, supply, hashrates, release rate, travel time, 70/30 split) are constants. The owner (Safe, `Ownable2Step`, renounce disabled) can only: add veins, close a vein for good, pause minting and upgrades, set treasury/royalty (≤10%)/image base, set the keeper and swap routes, begin or cancel the sunset during its 7-day notice.
- Veins are isolated: each keeps its own balance and accounting, and a claim touches one vein only. A paused or blocklisted stock token blocks its own vein's claims and nothing else. NFT transfers never move stock tokens (earnings go to `owed[previousOwner][vein]`), so a blocklisted holder can't freeze transfers.
- Accounting uses stored numbers, not `balanceOf`. Robinhood stock tokens don't rebase (ERC-8056 `uiMultiplier`), so no reconciliation is needed. Deposits count the amount actually received.

## Accounting

- Each epoch (24 h) releases `RELEASE_BPS` of the balance at the epoch start, evenly over time, into a MasterChef-style accumulator (`acc`, scaled 1e27). With no hashrate the release stays in the vein.
- Releases charge the balance rounded **up** and miners are paid rounded **down**, so `Σ pending + Σ owed ≤ reserved` always holds.
- Arrivals after a move are grouped in 10-minute buckets. A move syncs the destination, so pending arrivals are always within `TRAVEL + BUCKET` of `lastUpdate` and one sync scans at most 146 buckets.
- Idle epochs are walked one by one on the stack: catching up 3 idle years stays under 1.5 M gas (tested).
- Sunset: at `sunsetAt` every vein with hashrate releases its whole balance at once. Veins with no hashrate keep the daily release (owner decision 1А). Moves that would arrive after `sunsetAt` are refused before it (2Б).

## Tests (`forge test`)

- Unit tests for mint, release, move, upgrade, claim, transfer, deposit, sunset, owner limits and metadata.
- Attacker cases: reentrancy through `onERC721Received`, a paused stock, a blocklisted holder, fee-on-transfer deposits, jumping in before a deposit (deposits wait for the next epoch), conversion at a bad rate, stale or zero oracle prices.
- Invariants (random mint/move/upgrade/transfer/claim/deposit/convert/warp/sunset): every vein satisfies `balance + reserved + paid == deposited`, its token balance equals `balance + reserved`, the sum of pending + owed never exceeds `reserved`, hashrate bookkeeping matches the miners, `VeinFunder` ETH equals the sum of `ethPending`, and every mint and upgrade payment is split exactly 70/30 between the veins and the treasury, with no ETH left in OrmineMiners. Claims pay exactly what `pending + owed` showed.
- Mainnet fork (`FORK_MAINNET=true forge test --match-contract ForkMainnet`): real swaps of ETH into NVDA, TSLA and AAPL through Uniswap, then a real claim.
- Coverage (`forge coverage --ir-minimum`, src only): 98.9% lines, 100% branches.

## Static analysis

Slither 0.11.4 (`slither . --filter-paths "lib/|test/|script/"`) and Aderyn 0.6.8. Nothing at high severity remains. Accepted findings:

| Finding | Where | Why it is accepted |
|---|---|---|
| divide-before-multiply | `_release` | Intentional: `inc` is floored, then the balance is charged `ceil(inc × hash / ACC)` so payouts can never exceed what was reserved. |
| incorrect-equality | `_hash`, `_sync`, `_flow`, `_release`, `deposit`, `_arrivalAcc` | Comparisons of tiers, timestamps and computed amounts, not of manipulable balances. |
| uninitialized-local | `minersOf.n` | Zero-initialised counter by design. |
| unused-return | `VeinFunder._price` | Only `answer` and `updatedAt` are needed; both are checked. |
| Contract locks Ether (Aderyn H-2) | `VeinFunder` | By design: ETH can only become stock in its vein. |
| State change after external call (Aderyn H-3) | `deposit`, `convert`, constructor | `nonReentrant` on both; the external calls are the vein token (owner-listed) and our own contracts. |
| Unsafe casting (Aderyn H-4) | `_release` | `used ≤ amount ≤ balance` (uint128); the add into `reserved` is checked. |
| arbitrary-send-eth (forge lint) | `mint` | Sends to `treasury`, set by the owner. |
| block-timestamp | everywhere | Epochs and trips are hours long; a few seconds of sequencer drift don't matter. |

## Known trust assumptions

- The keeper decides when to convert; it can't pick a worse rate than the oracle floor.
- The owner chooses swap routes and price feeds. A malicious feed could weaken the floor; the ETH still can't leave for anything but that vein's stock.
- The stock token issuer can pause, blocklist, burn (`adminBurn`) and upgrade the token. If it burned tokens held by OrmineMiners, that vein would show more than it can pay.
