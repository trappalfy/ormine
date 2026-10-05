import Image from "next/image";
import { LAUNCH_VEINS, TRAVEL_HOURS } from "@ormine/shared";
import { BevelButton } from "@/components/os/BevelButton";
import { Wizard, type WizardStep } from "@/components/os/Wizard";
import { cx } from "@/components/os/cx";
import { SectionHead } from "./SectionHead";
import styles from "./HowItWorks.module.css";
import sec from "./Section.module.css";

/** "NVDA, TSLA or AAPL" */
const orList = (items: readonly string[]) =>
  items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;

// Copy from ORMINE_DESIGN.md 5.3. The vein list will come from the contract once it is deployed.
const STEPS: WizardStep[] = [
  { icon: "pick", title: "Mint a Digger", desc: "Every miner starts as a Tier I Digger, minted for ETH." },
  {
    icon: "ore",
    title: "Pick a vein",
    desc: `Choose the stock you want to dig: ${orList(LAUNCH_VEINS)}. Your miner goes straight there.`,
  },
  { icon: "cartmini", title: "Dig", desc: "Every day a vein releases a share of what it holds. Its miners split it by hashrate." },
  {
    icon: "up",
    title: "Upgrade your gear",
    desc: "Pay ETH to move a miner up a tier. More hashrate, a bigger share of the vein.",
  },
  {
    icon: "folder",
    title: "Claim",
    desc: `Rewards arrive in the stock of your vein. Claim whenever you like. Moving to another vein is a ${TRAVEL_HOURS}-hour trip.`,
  },
];

/** How it works [2]: the setup wizard. */
export function HowItWorks() {
  return (
    <section id="how" className={cx(sec.sec, sec.tightTop)} aria-labelledby="how-title">
      <div className="wrap">
        <SectionHead id="how-title" title="How it works" n={2} caption="From the first pickaxe to the first claim" />
        <Wizard
          name="Ormine Setup"
          steps={STEPS}
          sideLabel="The mine, two levels deep, miners at work"
          side={
            <Image
              src="/img/mine-scene.jpg"
              alt=""
              fill
              sizes="(max-width: 1100px) 100vw, 300px"
              className={styles.scene}
            />
          }
          actions={
            <BevelButton href="/mint" face="sans">
              Mint
            </BevelButton>
          }
        />
      </div>
    </section>
  );
}
