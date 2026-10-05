"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Badge } from "./Badge";
import { PauseButton } from "./PauseButton";
import { cx } from "./cx";
import { useReducedMotion } from "./useReducedMotion";
import styles from "./FallingOre.module.css";

/* ------------------------------------------------------------------ */
/* Score shared between the game canvas and the badges above the card */
/* ------------------------------------------------------------------ */

export type OreStats = { mined: number; depth: number };

const START: OreStats = { mined: 0, depth: 1 };
const OreContext = createContext<{ stats: OreStats; setStats: (s: OreStats) => void } | null>(null);

/** Wrap the footer in this so <OreBadges> can show what <FallingOre> digs. */
export function OreGame({ children }: { children: ReactNode }) {
  const [stats, setStats] = useState(START);
  const value = useMemo(() => ({ stats, setStats }), [stats]);
  return <OreContext.Provider value={value}>{children}</OreContext.Provider>;
}

/** "Mined n" and "Depth n" badges fed by the game. */
export function OreBadges({ className }: { className?: string }) {
  const stats = useContext(OreContext)?.stats ?? START;
  return (
    <div className={cx(styles.badges, className)}>
      <Badge label="Mined" value={stats.mined} />
      <Badge label="Depth" value={stats.depth} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The game: ore tetrominoes fall into the deepest column (design 3.14) */
/* ------------------------------------------------------------------ */

const COLORS = ["#F5CC17", "#E98D24", "#8F4822", "#D8AA61", "#6E6A66", "#B16830"];
// I, O, T, L, S
const SHAPES: [number, number][][] = [
  [[0, 0], [1, 0], [2, 0], [3, 0]],
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [1, 1]],
  [[0, 0], [0, 1], [1, 1], [2, 1]],
  [[1, 0], [2, 0], [0, 1], [1, 1]],
];
const TICK_MS = 120;
const PREFILL = 260;
const PREFILL_STILL = 660; // reduced motion: one settled frame
const MIN_FILL = 0.3; // share of cells filled after the prefill

type Piece = { sh: [number, number][]; x: number; y: number; c: string };

function createGame(canvas: HTMLCanvasElement, report: (s: OreStats) => void) {
  const ctx = canvas.getContext("2d");
  let B = 52;
  let top = 0; // rows are aligned to the bottom edge of the canvas
  let cols = 0;
  let rows = 0;
  let grid: (string | null)[][] = [];
  let piece: Piece | null = null;
  let mined = 0;
  let depth = 1;
  const pickOf = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

  const filled = () => {
    const cells = rows * cols;
    return cells ? grid.reduce((n, row) => n + row.filter(Boolean).length, 0) / cells : 1;
  };

  const emptyGrid = () => Array.from({ length: rows }, () => Array<string | null>(cols).fill(null));

  const fits = (sh: [number, number][], ox: number, oy: number) =>
    sh.every(([a, b]) => {
      const X = ox + a;
      const Y = oy + b;
      return X >= 0 && X < cols && Y < rows && (Y < 0 || !grid[Y][X]);
    });

  const landY = (sh: [number, number][], x: number) => {
    let y = -2;
    while (fits(sh, x, y + 1)) y++;
    return y;
  };

  // Each new piece goes to the deepest column it can reach.
  const spawn = () => {
    const shapes = SHAPES.filter((sh) => Math.max(...sh.map((s) => s[0])) + 1 <= cols);
    if (!shapes.length || rows < 2) {
      piece = null;
      return;
    }
    const sh = pickOf(shapes);
    const w = Math.max(...sh.map((s) => s[0])) + 1;
    let best = -Infinity;
    let xs: number[] = [];
    for (let x = 0; x <= cols - w; x++) {
      const y = landY(sh, x);
      if (y > best) {
        best = y;
        xs = [x];
      } else if (y === best) xs.push(x);
    }
    piece = { sh, x: pickOf(xs), y: -2, c: pickOf(COLORS) };
  };

  const cell = (X: number, Y: number, c: string) => {
    if (!ctx) return;
    ctx.fillStyle = c;
    const y = top + Y * B;
    ctx.fillRect(X * B + 1, y + 1, B - 2, B - 2);
    ctx.fillStyle = "rgba(255,255,255,.18)";
    ctx.fillRect(X * B + 1, y + 1, B - 2, 4);
  };

  const draw = () => {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    grid.forEach((row, Y) => row.forEach((c, X) => c && cell(X, Y, c)));
    piece?.sh.forEach(([a, b]) => {
      const Y = piece!.y + b;
      if (Y >= 0) cell(piece!.x + a, Y, piece!.c);
    });
  };

  const step = (count = true) => {
    if (!piece) return;
    if (fits(piece.sh, piece.x, piece.y + 1)) {
      piece.y++;
      return;
    }
    for (const [a, b] of piece.sh) {
      const Y = piece.y + b;
      if (Y >= 0) grid[Y][piece.x + a] = piece.c;
    }
    if (count) mined += 4;
    for (let Y = rows - 1; Y >= 0; Y--) {
      if (grid[Y].every(Boolean)) {
        grid.splice(Y, 1);
        grid.unshift(Array<string | null>(cols).fill(null));
        Y++;
        if (count) depth++;
      }
    }
    if (piece.y < 1) grid = emptyGrid(); // reached the top: start a fresh shaft
    spawn();
  };

  const reset = (prefill: number, count: boolean) => {
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    B = W < 600 ? 32 : 52;
    cols = Math.floor(W / B);
    rows = Math.floor(H / B);
    top = H - rows * B;
    grid = emptyGrid();
    spawn();
    for (let i = 0; i < prefill; i++) step(count);
    // Keep digging until the bottom looks settled (the shaft may have just been reset).
    for (let i = 0; i < 2000 && filled() < MIN_FILL; i++) step(count);
    draw();
  };

  return {
    reset,
    tick() {
      const before = mined + depth;
      step();
      draw();
      if (mined + depth !== before) report({ mined, depth });
    },
    stats: () => ({ mined, depth }),
  };
}

export type FallingOreProps = { className?: string };

/** Footer mini-game on a canvas, with a pause button in the corner. Decorative (aria-hidden). */
export function FallingOre({ className }: FallingOreProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const game = useRef<ReturnType<typeof createGame> | null>(null);
  const reduce = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const setStats = useContext(OreContext)?.setStats;

  // Build the board, fill the bottom, and rebuild when the width changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const report = setStats ?? (() => {});
    const g = createGame(canvas, report);
    game.current = g;
    const prefill = reduce ? PREFILL_STILL : PREFILL;
    g.reset(prefill, true);
    const raf = requestAnimationFrame(() => report(g.stats()));

    let lastW = canvas.clientWidth;
    const ro = new ResizeObserver(() => {
      if (canvas.clientWidth === lastW) return;
      lastW = canvas.clientWidth;
      g.reset(prefill, false);
    });
    ro.observe(canvas);

    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    io.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      game.current = null;
    };
  }, [reduce, setStats]);

  // One block step every 120 ms while on screen, unless paused or motion is reduced.
  useEffect(() => {
    if (reduce || paused || !visible) return;
    const id = window.setInterval(() => game.current?.tick(), TICK_MS);
    return () => window.clearInterval(id);
  }, [reduce, paused, visible]);

  return (
    <div className={cx(styles.game, className)}>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      {reduce ? null : (
        <PauseButton
          className={styles.pause}
          paused={paused}
          onToggle={() => setPaused((p) => !p)}
          what="falling ore animation"
        />
      )}
    </div>
  );
}
