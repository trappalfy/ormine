import type { CSSProperties, ReactNode } from "react";
import { OsWindow, type OsWindowProps } from "./OsWindow";
import { PixelIcon } from "./PixelIcon";
import { cx } from "./cx";
import type { PixelIconName } from "./pixelMaps";
import styles from "./ProgressDialog.module.css";

export type ProgressDialogProps = Omit<OsWindowProps, "children"> & {
  /** 0–100; ignored while `running`. */
  percent?: number;
  segments?: number;
  /** Indeterminate state ("Digging… (pending)"): segments march across the field. */
  running?: boolean;
  /** Show the segment meter (on by default). */
  meter?: boolean;
  /** Route icons: from the vein to the cart. */
  from?: PixelIconName;
  to?: PixelIconName;
  /** Replaces the route with one status icon, e.g. "done", "failed", "warning". */
  icon?: PixelIconName;
  message?: ReactNode;
  /** Accessible name of the meter. */
  progressLabel?: string;
  /** Buttons under the meter. */
  children?: ReactNode;
};

/** OS progress dialog: route "vein — cart", 22-segment meter and buttons. Hero and transaction status. */
export function ProgressDialog({
  percent = 0,
  segments = 22,
  running = false,
  meter = true,
  from = "ore",
  to = "cartmini",
  icon,
  message,
  progressLabel = "Progress",
  titleSize = "lg",
  className,
  children,
  ...windowProps
}: ProgressDialogProps) {
  const pct = Math.max(0, Math.min(100, percent));
  const filled = Math.round((pct / 100) * segments);

  return (
    <OsWindow titleSize={titleSize} className={cx(styles.dialog, className)} {...windowProps}>
      <div className={styles.body}>
        {icon ? (
          <div className={styles.status}>
            <PixelIcon name={icon} size={64} />
            {message ? <p className={styles.message}>{message}</p> : null}
          </div>
        ) : (
          <>
            <div className={styles.route} aria-hidden="true">
              <PixelIcon name={from} size={64} />
              <span className={styles.dash} />
              <PixelIcon name={to} size={64} />
            </div>
            {message ? <p className={styles.message}>{message}</p> : null}
          </>
        )}
        {meter ? (
          <div
            className={cx(styles.meter, running && styles.running)}
            role="progressbar"
            aria-label={progressLabel}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={running ? undefined : Math.round(pct)}
            style={{ "--n": segments } as CSSProperties}
          >
            {running ? null : Array.from({ length: filled }, (_, i) => <i key={i} className={styles.seg} />)}
          </div>
        ) : null}
        {children ? <div className={styles.actions}>{children}</div> : null}
      </div>
    </OsWindow>
  );
}
