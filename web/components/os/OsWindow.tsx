import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";
import styles from "./OsWindow.module.css";

export type WindowControl = "min" | "max" | "close" | "help";

const GLYPH: Record<WindowControl, string> = { min: "_", max: "□", close: "×", help: "?" };

export type OsWindowProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  title: ReactNode;
  /** Title-bar buttons, left to right. Decorative unless `onClose` is given. */
  controls?: readonly WindowControl[];
  /** "lg" = 22px title (dialogs), "md" = 18px (default). */
  titleSize?: "md" | "lg";
  /** id for the title text, to point aria-labelledby at it. */
  titleId?: string;
  /** Makes the × a real button. */
  onClose?: () => void;
  closeLabel?: string;
  barClassName?: string;
  children?: ReactNode;
};

/** OS window: --win body with a raised bevel, gradient title bar and `_ □ ×` controls. */
export function OsWindow({
  title,
  controls = ["min", "max", "close"],
  titleSize = "md",
  titleId,
  onClose,
  closeLabel = "Close",
  className,
  barClassName,
  children,
  ...rest
}: OsWindowProps) {
  return (
    <div className={cx(styles.win, className)} {...rest}>
      <div className={cx(styles.bar, titleSize === "lg" && styles.lg, barClassName)}>
        <span className={styles.title} id={titleId}>
          {title}
        </span>
        {controls.length > 0 && (
          <span className={styles.ctrls}>
            {controls.map((c) =>
              c === "close" && onClose ? (
                <button key={c} type="button" className={styles.ctrl} onClick={onClose} aria-label={closeLabel}>
                  {GLYPH[c]}
                </button>
              ) : (
                <span key={c} className={styles.ctrl} aria-hidden="true">
                  {GLYPH[c]}
                </span>
              ),
            )}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
