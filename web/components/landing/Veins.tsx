import { cx } from "@/components/os/cx";
import { SectionHead } from "./SectionHead";
import { VeinsGrid } from "./VeinsGrid";
import styles from "./Veins.module.css";
import sec from "./Section.module.css";

/** Veins [4]: one folder per vein with numbers read from the contracts. */
export function Veins() {
  return (
    <section id="veins" className={cx(sec.sec, sec.dark, sec.shortBottom)} aria-labelledby="veins-title">
      <div className="wrap">
        <SectionHead id="veins-title" dark title="Veins" n={4} caption="Every stock has its own vein. Live from the chain." />
        <VeinsGrid />
        <p className={styles.note}>
          Numbers come straight from the contracts: what each vein holds, what it releases today, and who is digging there.
        </p>
      </div>
    </section>
  );
}
