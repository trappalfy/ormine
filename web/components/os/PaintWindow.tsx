import type { CSSProperties, ReactNode } from "react";
import { OsWindow } from "./OsWindow";
import { PixelIcon } from "./PixelIcon";
import { cx } from "./cx";
import { VIDEO_PALETTE, type PixelIconName } from "./pixelMaps";
import styles from "./PaintWindow.module.css";

const MENU: { label: string; key: number }[] = [
  { label: "File", key: 0 },
  { label: "Edit", key: 0 },
  { label: "View", key: 0 },
  { label: "Vein", key: 1 },
  { label: "Help", key: 0 },
];

const TOOLS: PixelIconName[] = [
  "toolSelect",
  "toolPencil",
  "toolPick",
  "toolEllipse",
  "toolRect",
  "toolText",
  "toolZoom",
  "toolPlus",
];

const SWATCHES = [...VIDEO_PALETTE, "#C3C3C3", "#FFFFFF"];

export type PaintWindowProps = {
  title: ReactNode;
  /** The picture on the canvas. */
  children: ReactNode;
  status?: ReactNode;
  /** Index of the pressed tool in the 2×4 column. */
  activeTool?: number;
  className?: string;
  style?: CSSProperties;
};

/** OsWindow dressed as a paint program. Menu, tools, swatches and status are decorative. */
export function PaintWindow({
  title,
  children,
  status = "For help, open Docs from the Help menu.",
  activeTool = 2,
  className,
  style,
}: PaintWindowProps) {
  return (
    <OsWindow title={title} className={className} style={style}>
      <div className={styles.menu} aria-hidden="true">
        {MENU.map(({ label, key }) => (
          <span key={label}>
            {label.slice(0, key)}
            <u>{label[key]}</u>
            {label.slice(key + 1)}
          </span>
        ))}
      </div>
      <div className={styles.work}>
        <div className={styles.tools} aria-hidden="true">
          {TOOLS.map((tool, i) => (
            <span key={tool} className={cx(styles.tool, i === activeTool && styles.on)}>
              <PixelIcon name={tool} size={20} />
            </span>
          ))}
        </div>
        <div className={styles.canvas}>{children}</div>
      </div>
      <div className={styles.swatches} aria-hidden="true">
        {SWATCHES.map((c) => (
          <i key={c} style={{ background: c }} />
        ))}
      </div>
      <div className={styles.status} aria-hidden="true">
        {status}
      </div>
    </OsWindow>
  );
}
