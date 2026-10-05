import type { CSSProperties } from "react";
import { cx } from "./cx";
import { PixelIcon } from "./PixelIcon";
import styles from "./PauseButton.module.css";

type PauseButtonProps = {
  paused: boolean;
  onToggle: () => void;
  /** What it stops, read by screen readers: "Pause {what}" / "Play {what}". */
  what: string;
  className?: string;
  style?: CSSProperties;
};

/** Small bevel button that stops looping motion (WCAG 2.2.2). Use inside client components. */
export function PauseButton({ paused, onToggle, what, className, style }: PauseButtonProps) {
  const label = `${paused ? "Play" : "Pause"} ${what}`;
  return (
    <button type="button" className={cx(styles.pause, className)} style={style} onClick={onToggle} aria-label={label} title={label}>
      <PixelIcon name={paused ? "play" : "pause"} size={16} />
    </button>
  );
}
