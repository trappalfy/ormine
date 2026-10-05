import { cx } from "@/components/os/cx";
import styles from "./SectionHead.module.css";

type SectionHeadProps = {
  title: string;
  n: number;
  caption: string;
  /** On graphite sections. */
  dark?: boolean;
  id?: string;
};

/** "> Title [n]" with the "/ caption" on the right and a 2px rule under both. */
export function SectionHead({ title, n, caption, dark, id }: SectionHeadProps) {
  return (
    <div className={cx(styles.head, dark && styles.dark)}>
      <h2 className={styles.title} id={id}>
        <span>{title}</span>
        <sup className={styles.n} aria-hidden="true">
          [{n}]
        </sup>
      </h2>
      <p className={styles.cap}>/ {caption}</p>
    </div>
  );
}
