"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { PixelIcon } from "./PixelIcon";
import { cx } from "./cx";
import type { PixelIconName } from "./pixelMaps";
import styles from "./FolderCard.module.css";

const TAB_H = 26;
const R = 12;
const TAB_W = 0.42;

/** Outline path for a folder of w×h: tab on the left (42% wide, 26px high), slope down, 12px corners. */
export function folderPath(w: number, h: number, t = TAB_H, r = R, tabShare = TAB_W) {
  const tw = Math.round(w * tabShare);
  return (
    `M1 ${h - 1 - r} V${1 + r} Q1 1 ${1 + r} 1 H${tw} L${tw + t} ${t} H${w - 1 - r} ` +
    `Q${w - 1} ${t} ${w - 1} ${t + r} V${h - 1 - r} Q${w - 1} ${h - 1} ${w - 1 - r} ${h - 1} ` +
    `H${1 + r} Q1 ${h - 1} 1 ${h - 1 - r} Z`
  );
}

export type FolderCardProps = {
  title: ReactNode;
  /** Pixel icon before the title; null for none. */
  icon?: PixelIconName | null;
  /** Heading level of the title. */
  as?: "h2" | "h3" | "h4";
  /** Outline colour (2px). */
  stroke?: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

/** Card with a folder-shaped outline that is recalculated whenever the card resizes. */
export function FolderCard({ title, icon = "ore", as: Heading = "h3", stroke = "#EDEDED", children, className, style }: FolderCardProps) {
  const box = useRef<HTMLDivElement>(null);
  const path = useRef<SVGPathElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const draw = () => path.current?.setAttribute("d", folderPath(el.clientWidth, el.clientHeight));
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={box} className={cx(styles.folder, className)} style={style}>
      <svg className={styles.outline} aria-hidden="true" focusable="false">
        <path ref={path} fill="none" stroke={stroke} strokeWidth="2" />
      </svg>
      <Heading className={styles.title}>
        {icon ? <PixelIcon name={icon} size={32} /> : null}
        {title}
      </Heading>
      {children}
    </div>
  );
}
