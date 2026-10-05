import type { Metadata } from "next";
import { SectionHead } from "@/components/landing/SectionHead";
import styles from "../docs.module.css";

export const metadata: Metadata = { title: "Risks · Ormine", description: "What can go wrong with Ormine, in plain words." };

export default function RisksPage() {
  return (
    <>
      <SectionHead title="Risks" n={2} caption="Read this before you mint" />
      <div className={styles.prose}>
        <h3>No external audit</h3>
        <p>
          The contracts are open and verified on the explorer and covered by unit, fuzz and invariant tests, but no outside firm has audited
          them. A bug could lose funds.
        </p>

        <h3>Stock tokens belong to their issuer</h3>
        <p>
          The stock tokens in the veins are issued on Robinhood Chain by Robinhood. Their contracts let the issuer pause transfers, block
          addresses, burn balances and upgrade the token code. If a stock is paused, claims in that vein wait until it is unpaused; other
          veins keep working. A blocked address can&apos;t receive that stock. If the issuer burned tokens held by the mine, that vein would pay
          less than it shows.
        </p>

        <h3>Prices move</h3>
        <p>
          Rewards are paid in stock tokens, not dollars. Their value goes up and down with the market and with corporate actions such as
          splits and dividends.
        </p>

        <h3>No promised returns</h3>
        <p>
          A vein releases a share of what it holds. What a miner gets depends on what is in its vein and how much hashrate is digging there.
          The &quot;today ≈&quot; figures in the app are estimates from current numbers and change as the vein and its miners change.
        </p>

        <h3>Swaps depend on the team&apos;s keeper and on oracles</h3>
        <p>
          The ETH set aside for a vein is swapped for stock by the team&apos;s keeper. Nobody can withdraw it, but until it is swapped it does not
          add to the vein. Swaps also stop while Chainlink prices are stale or the stock is in a corporate action.
        </p>

        <h3>The chain</h3>
        <p>Robinhood Chain is a young network. Outages or changes to it can delay or block transactions.</p>

        <h3>Where you live</h3>
        <p>Tokenized stocks may be restricted in your country. Check your local rules. Nothing on this site is financial advice.</p>
      </div>
    </>
  );
}
