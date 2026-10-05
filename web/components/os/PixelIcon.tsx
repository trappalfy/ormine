"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { cx } from "./cx";
import { PIXEL_MAPS, drawPixelMap, mapSize, type PixelIconName, type PixelMap } from "./pixelMaps";
import styles from "./PixelIcon.module.css";

type PixelIconProps = {
  /** An icon from pixelMaps.ts … */
  name?: PixelIconName;
  /** … or a custom map in the same format. */
  map?: PixelMap;
  /** Display width in CSS px; height follows the map ratio. Use whole multiples of the map width
   *  (16 → 32/64/96). Leave it out to size the icon from CSS instead. */
  size?: number;
  className?: string;
  style?: CSSProperties;
};

/** A pixel icon drawn on a canvas from a character map. Always decorative (aria-hidden). */
export function PixelIcon({ name = "ore", map, size, className, style }: PixelIconProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const pixels = map ?? PIXEL_MAPS[name];
  const key = pixels.join("|");
  const { width, height } = mapSize(pixels);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (ctx) drawPixelMap(ctx, key.split("|"));
  }, [key]);

  const sizing = size === undefined ? undefined : { width: size, height: Math.round((size * height) / width) };

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      aria-hidden="true"
      className={cx(styles.icon, className)}
      style={{ ...sizing, ...style }}
    />
  );
}
