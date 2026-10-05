import type { ReactNode } from "react";
import { RELEASE_PCT, TEAM_SHARE_PCT, VEIN_SHARE_PCT } from "@ormine/shared";
import { CheckerBand } from "@/components/os/CheckerBand";
import { Pie3D, PieLegend } from "@/components/os/Pie3D";
import { PropertiesWindow } from "@/components/os/PropertiesWindow";
import { cx } from "@/components/os/cx";
import { SectionHead } from "./SectionHead";
import styles from "./OreSources.module.css";
import sec from "./Section.module.css";

const SOURCES: { key: string; text: ReactNode }[] = [
  {
    key: "sales",
    text: (
      <>
        <b>Miner sales and upgrades.</b> Part of every mint and upgrade buys the stock of the miner&apos;s vein.
      </>
    ),
  },
  {
    key: "pool",
    text: (
      <>
        <b>Starting pool.</b> The team seeds every vein before minting opens.
      </>
    ),
  },
  { key: "topup", text: "Anyone can top up a vein. Nobody can take from one." },
];

const RULES: { key: string; text: ReactNode }[] = [
  {
    key: "release",
    text: (
      <>
        Every day a vein releases <b>{RELEASE_PCT}%</b> of what it holds, split between its miners by hashrate.
      </>
    ),
  },
  {
    key: "withdraw",
    text: (
      <>
        <b>Nobody can withdraw from a vein.</b> Not even us.
      </>
    ),
  },
  {
    key: "returns",
    text: "No promised returns. What a miner gets depends on what's in its vein and who else is digging there.",
  },
];

const VEIN_LABEL = "To the miner's vein, as its stock";
const TEAM_LABEL = "To the team";

function TabList({ items }: { items: typeof SOURCES }) {
  return (
    <ul className={styles.tabList}>
      {items.map((it) => (
        <li key={it.key}>{it.text}</li>
      ))}
    </ul>
  );
}

/** Where the ore comes from [5]: how a payment is split, what fills the veins, the rules. */
export function OreSources() {
  const general = (
    <>
      <p className={styles.lead}>Every mint and upgrade, split on-chain</p>
      <Pie3D
        label={`Pie chart: ${VEIN_SHARE_PCT} percent of every mint and upgrade goes to the miner's vein, as its stock; ${TEAM_SHARE_PCT} percent goes to the team.`}
        slices={[
          { value: TEAM_SHARE_PCT, color: "#8F4822", side: "#6A3518" },
          { value: VEIN_SHARE_PCT, color: "#F5CC17", side: "#B88C10" },
        ]}
      />
      <PieLegend
        items={[
          { color: "#F5CC17", label: VEIN_LABEL, value: `${VEIN_SHARE_PCT}%` },
          { color: "#8F4822", label: TEAM_LABEL, value: `${TEAM_SHARE_PCT}%` },
        ]}
      />
      <p className={styles.pnote}>Fixed in the contract. There is no other way for the team to touch players&apos; funds.</p>
    </>
  );

  return (
    <>
      <section id="ore" className={cx(sec.sec, sec.dark, sec.flushTop)} aria-labelledby="ore-title">
        <div className="wrap">
          <SectionHead id="ore-title" dark title="Where the ore comes from" n={5} caption="What fills the veins, and what nobody can touch" />
          <div className={styles.ore}>
            <PropertiesWindow
              title="Vein funding Properties"
              tabs={[
                { id: "general", label: "General", content: general },
                { id: "sources", label: "Sources", content: <TabList items={SOURCES} /> },
                { id: "rules", label: "Rules", content: <TabList items={RULES} /> },
              ]}
            />
            <div className={styles.lists}>
              <div>
                <h3 className={styles.listTitle}>/ Sources</h3>
                <ul className={styles.list}>
                  {SOURCES.map((it) => (
                    <li key={it.key}>{it.text}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className={styles.listTitle}>/ Rules</h3>
                <ul className={cx(styles.list, styles.rules)}>
                  {RULES.map((it) => (
                    <li key={it.key}>{it.text}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
      <CheckerBand color="#F0F0F0" bg="#2A2D2F" flip />
    </>
  );
}
