import type { ReactNode } from "react";
import { cx } from "./cx";
import styles from "./Badge.module.css";

/** Black mono label, e.g. "Mined 356", "Depth 12". */
export function Badge({ label, value, className }: { label: ReactNode; value: ReactNode; className?: string }) {
  return (
    <span className={cx(styles.badge, className)}>
      <span>{label}</span>
      <b className={styles.value}>{value}</b>
    </span>
  );
}
