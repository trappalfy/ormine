import { TIERS } from "@ormine/shared";
import { CheckerBand } from "@/components/os/CheckerBand";
import { TierCard } from "@/components/os/TierCard";
import { cx } from "@/components/os/cx";
import { SectionHead } from "./SectionHead";
import styles from "./Crew.module.css";
import sec from "./Section.module.css";

/** The crew [3]: four tiers, then the gold band into the dark sections. */
export function Crew() {
  return (
    <>
      <section id="crew" className={cx(sec.sec, sec.tightTop)} aria-labelledby="crew-title">
        <div className="wrap">
          <SectionHead id="crew-title" title="The crew" n={3} caption="Four tiers. Better gear, faster dig." />
          <div className={styles.grid}>
            {TIERS.map((t) => (
              <TierCard key={t.slug} tier={t} sizes="(max-width: 1100px) 50vw, 25vw" />
            ))}
          </div>
        </div>
      </section>
      <CheckerBand color="#F5CC17" bg="#F0F0F0" />
    </>
  );
}
