import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { cx } from "./cx";
import styles from "./PicWindow.module.css";

export type PicWindowProps = {
  /** Left part of the title, e.g. "Pic.1" or "Tier I". */
  label: ReactNode;
  /** Middle part, shown as "[digger.png]"; hidden on phones. */
  file?: string;
  src?: string;
  alt?: string;
  /** next/image `sizes` for the picture. */
  sizes?: string;
  /** Use instead of `src` to put anything else on the --deep panel. */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

/** Flat picture window: "Pic.1 · [digger.png] · ×" with the art on a --deep panel. */
export function PicWindow({ label, file, src, alt = "", sizes = "300px", children, className, style }: PicWindowProps) {
  return (
    <div className={cx(styles.pic, className)} style={style}>
      <div className={styles.t}>
        <span className={styles.label}>{label}</span>
        <span className={styles.file} aria-hidden={file ? undefined : true}>
          {file ? `[${file}]` : ""}
        </span>
        <span className={styles.x} aria-hidden="true">
          ×
        </span>
      </div>
      <div className={styles.in}>
        {src ? <Image src={src} alt={alt} fill sizes={sizes} className={styles.img} /> : null}
        {children}
      </div>
    </div>
  );
}
