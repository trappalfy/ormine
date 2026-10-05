"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { cx } from "./cx";
import styles from "./CheckerBand.module.css";

export type CheckerBandProps = {
  /** Square colour. */
  color: string;
  /** Background colour. */
  bg: string;
  /** Mirrored variant: the denser row sits on top. */
  flip?: boolean;
  /** Fixed seed, so the steps are random-looking but the same on every visit. */
  seed?: number;
  className?: string;
  style?: CSSProperties;
};

const SQUARE = 50;

function draw(canvas: HTMLCanvasElement, { color, bg, flip, seed }: Required<Pick<CheckerBandProps, "color" | "bg" | "flip" | "seed">>) {
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Park–Miller generator, as in the mockup.
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  ctx.fillStyle = color;
  const cols = Math.ceil(W / SQUARE);
  for (let i = 0; i < cols; i++) {
    const full = rnd() < 0.55;
    const top = rnd() < 0.35;
    const rows: [number, boolean][] = flip ? [[0, top], [1, full]] : [[1, full], [0, top]];
    for (const [row, on] of rows) if (on) ctx.fillRect(i * SQUARE, row * SQUARE, SQUARE, SQUARE);
    if (!flip && rnd() < 0.5) ctx.fillRect(i * SQUARE, SQUARE, SQUARE, SQUARE);
  }
}

/** 100px band of 50px squares: the stepped pixel edge between sections. Decorative. */
export function CheckerBand({ color, bg, flip = false, seed = 17, className, style }: CheckerBandProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let lastW = -1;
    const redraw = () => {
      if (canvas.clientWidth === lastW) return;
      lastW = canvas.clientWidth;
      draw(canvas, { color, bg, flip, seed });
    };
    redraw();
    const ro = new ResizeObserver(redraw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [color, bg, flip, seed]);

  return <canvas ref={ref} aria-hidden="true" className={cx(styles.band, className)} style={{ background: bg, ...style }} />;
}
