import type { Metadata } from "next";
import Link from "next/link";
import { formatEther } from "viem";
import {
  EPOCH_HOURS,
  MAX_PER_TX,
  MAX_SUPPLY,
  MINT_PRICE_WEI,
  RELEASE_PCT,
  SUNSET_DELAY_SECONDS,
  TEAM_SHARE_PCT,
  TIERS,
  TRAVEL_HOURS,
  UPGRADE_PRICE_PER_HASH_WEI,
  VEIN_SHARE_PCT,
  upgradePriceWei,
} from "@ormine/shared";
import { SectionHead } from "@/components/landing/SectionHead";
import { appChain, deployment } from "@/lib/chain";
import styles from "./docs.module.css";

export const metadata: Metadata = {
  title: "Docs · Ormine",
  description: "How Ormine miners dig: veins, daily releases, hashrate, upgrades, moving, claiming and the rules nobody can change.",
};

const price = formatEther(MINT_PRICE_WEI);
const sunsetDays = SUNSET_DELAY_SECONDS / 86_400;
const explorer = appChain.blockExplorers?.default.url;

export default function DocsPage() {
  return (
    <>
      <SectionHead title="How it works" n={1} caption="Every rule, in numbers" />
      <div className={styles.prose}>
        <p>
          Ormine is a collection of NFT miners on Robinhood Chain. Every stock has its own vein: a pool of that stock&apos;s token held by
          the contract. Miners dig in one vein at a time and are paid in that vein&apos;s stock.
        </p>

        <h3 id="miners">Miners</h3>
        <p>
          Every miner starts as a Tier I Digger, minted for {price} ETH, up to {MAX_PER_TX} per transaction and {MAX_SUPPLY.toLocaleString("en-US")} in
          total. When you mint, you pick a vein and the miner goes straight there.
        </p>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Tier</th>
              <th>Name</th>
              <th>Hashrate</th>
              <th>Gear</th>
            </tr>
          </thead>
          <tbody>
            {TIERS.map((t) => (
              <tr key={t.tier}>
                <td>{t.roman}</td>
                <td>{t.name}</td>
                <td>{t.hash} H</td>
                <td>{t.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 id="release">The daily release</h3>
        <p>
          Every {EPOCH_HOURS} hours a vein releases {RELEASE_PCT}% of what it held when that day began. The release flows evenly through the
          day and is split between the miners digging in the vein, by hashrate. Stock added to a vein during a day counts from the next one.
          If nobody is digging, that part of the release stays in the vein.
        </p>
        <p className={styles.formula}>your share today = vein release today × your hashrate ÷ vein total hashrate</p>
        <p>
          Example with made-up numbers: an NVDA vein holds 100 NVDA and releases {RELEASE_PCT}% a day, 1 NVDA. Its miners have 4,000 H in
          total. A Tier II Miner (25 H) gets 25 ÷ 4,000 × 1 = 0.00625 NVDA that day. Upgraded to a Driller (60 H), the vein has 4,035 H and the
          same miner gets 60 ÷ 4,035 × 1 ≈ 0.0149 NVDA.
        </p>
        <p>
          Because each day releases a share of what is left, a vein never runs dry on its own, and its release grows or shrinks with what is
          in it. Nothing here is a promise: what a miner gets depends on what&apos;s in its vein and who else is digging there.
        </p>

        <h3 id="upgrades">Upgrades</h3>
        <p>
          An upgrade moves a miner one tier up: Digger → Miner → Driller → Rig. You pay in ETH, {formatEther(UPGRADE_PRICE_PER_HASH_WEI)} ETH for
          every hash the miner gains, the same rate as a mint. So the steps cost {TIERS.slice(0, 3)
            .map((t) => `${formatEther(upgradePriceWei(t.tier))} ETH`)
            .join(", ")}
          .
        </p>
        <p>
          The payment is split like a mint: {VEIN_SHARE_PCT}% buys the stock of the vein the miner digs in (or is travelling to),{" "}
          {TEAM_SHARE_PCT}% goes to the team. Earnings at the old hashrate are settled first. Upgrades stop while minting is paused and
          when the mine closes.
        </p>

        <h3 id="moving">Moving</h3>
        <p>
          A miner can move to another vein. The trip takes {TRAVEL_HOURS} hours (rounded up to the next 10 minutes) and the miner doesn&apos;t
          dig on the way. What it earned in the old vein stays yours to claim. The trip exists so nobody can jump into a vein just before it
          is topped up.
        </p>

        <h3 id="claiming">Claiming</h3>
        <p>
          Claim whenever you like. Each vein is claimed on its own and pays in its own stock, so trouble with one stock never blocks another
          vein. If you sell a miner, everything it earned until the sale stays with you.
        </p>

        <h3 id="sources">Where the ore comes from</h3>
        <ul>
          <li>
            <b>Miner sales and upgrades.</b> {VEIN_SHARE_PCT}% of every mint and upgrade is set aside for the miner&apos;s vein.{" "}
            {TEAM_SHARE_PCT}% goes to the team.
          </li>
          <li>
            The set-aside ETH waits in the VeinFunder contract until it is swapped for the vein&apos;s stock on Uniswap, at most 2 ETH at a
            time, and only at a rate within 1.5% of Chainlink prices. The stock goes straight into the vein. Nobody can withdraw this ETH.
          </li>
          <li>
            <b>Starting pool.</b> The team seeds every vein before minting opens.
          </li>
          <li>Anyone can top up a vein. Nobody can take from one.</li>
        </ul>

        <h3 id="rules">What the team can and can&apos;t do</h3>
        <p>The team can: add a vein, close a vein to new miners for good, pause minting and upgrades, set the treasury and royalties (up to 10%), choose the swap pool and price feed, and announce the closing of the mine.</p>
        <p>
          The team can&apos;t: withdraw from a vein or from the ETH waiting for a vein, change the prices, hashrates, the daily release or the{" "}
          {VEIN_SHARE_PCT}/{TEAM_SHARE_PCT} split, or mint miners for free. These are fixed in the contracts.
        </p>

        <h3 id="closing">If the mine closes</h3>
        <p>
          Closing is announced on-chain {sunsetDays} days ahead and can be cancelled until then. When it happens, minting and upgrades stop and
          every vein with miners in it releases everything it holds at once, split by hashrate. Trips that would still be under way at that
          moment can&apos;t start in the last {TRAVEL_HOURS} hours. A vein nobody is digging in keeps its daily release for whoever arrives.
          Claims stay open forever.
        </p>

        <h3 id="contracts">Contracts</h3>
        {deployment ? (
          <ul>
            <li>
              OrmineMiners: <span className={styles.addr}>{deployment.miners}</span>
              {explorer ? (
                <>
                  {" "}
                  <a href={`${explorer}/address/${deployment.miners}`} target="_blank" rel="noreferrer">
                    source ↗
                  </a>
                </>
              ) : null}
            </li>
            <li>
              VeinFunder: <span className={styles.addr}>{deployment.veinFunder}</span>
              {explorer ? (
                <>
                  {" "}
                  <a href={`${explorer}/address/${deployment.veinFunder}`} target="_blank" rel="noreferrer">
                    source ↗
                  </a>
                </>
              ) : null}
            </li>
          </ul>
        ) : (
          <p>Addresses appear here once the contracts are deployed on {appChain.name}.</p>
        )}
        <p>
          The contracts are open and verified, but they have not had an external audit. Read the <Link href="/docs/risks">risks</Link> before
          you mint.
        </p>
      </div>
    </>
  );
}
