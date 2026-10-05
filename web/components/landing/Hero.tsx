import Image from "next/image";
import Link from "next/link";
import { BevelButton } from "@/components/os/BevelButton";
import { CheckerBand } from "@/components/os/CheckerBand";
import { PixelIcon } from "@/components/os/PixelIcon";
import { deployment } from "@/lib/chain";
import { X_URL } from "@/lib/links";
// The mine entrance at night and a miner seen from behind (from ormine-assets/hero-wide.png).
import mineEntrance from "@/assets/img/mine-entrance.png";
import { CopyAddress } from "./CopyAddress";
import { LANDING_NAV } from "./TopLine";
import styles from "./Hero.module.css";

const POINTS = {
  left: ["NFT miners on Robinhood Chain", "Paid in real stock tokens"],
  right: ["Every stock has its own vein", "Nobody can withdraw from a vein"],
};

// Floating gold dust: [left %, top %, delay s, size px].
const DUST: [number, number, number, number][] = [
  [8, 22, 0, 4], [17, 64, 1.6, 3], [24, 38, 3.1, 4], [31, 14, 0.8, 3], [38, 72, 2.4, 3], [44, 30, 4.2, 4], [57, 18, 1.2, 3],
  [62, 66, 3.6, 4], [69, 34, 0.4, 3], [76, 12, 2.8, 4], [83, 58, 1.9, 3], [91, 26, 3.3, 4], [52, 48, 4.8, 3], [12, 84, 2.1, 3],
];

const NUGGET = ["..kkk..", ".kOYOk.", "kOOOYOk", "kOOOOOk", "kdOOOdk", ".kdddk.", "..kkk.."];

// "#" = one pixel, drawn as crisp SVG squares.
const ARROW_UP = ["...#...", "..###..", ".#.#.#.", "#..#..#", "...#...", "...#...", "...#...", "...#..."];
const ARROW_DOWN = [...ARROW_UP].reverse();
const X_MARK = ["##.....#", ".##...#.", "..##.#..", "...##...", "...##...", "..#.##..", ".#...##.", "#.....##"];

function PixelGlyph({ map, size }: { map: string[]; size: number }) {
  const w = map[0].length;
  const h = map.length;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={size} height={(size * h) / w} shapeRendering="crispEdges" aria-hidden="true">
      {map.flatMap((row, y) => [...row].map((c, x) => (c === "#" ? <rect key={`${x}.${y}`} x={x} y={y} width={1} height={1} /> : null)))}
    </svg>
  );
}

function Points({ items, side }: { items: string[]; side: "left" | "right" }) {
  return (
    <ul className={`${styles.points} ${styles[side]}`}>
      {items.map((t) => (
        <li key={t}>
          <PixelIcon map={NUGGET} size={21} />
          {t}
        </li>
      ))}
    </ul>
  );
}

function Scene() {
  return (
    <div className={styles.scene}>
      <Image src={mineEntrance} alt="" preload sizes="(max-width: 760px) 200vw, 100vw" quality={90} className={styles.art} />
    </div>
  );
}

/** First screen: the mine entrance at night, the Ormine wordmark over it, the miner walking in. */
export function Hero() {
  return (
    <section className={styles.hero} aria-label="Ormine">
      <Scene />
      <div className={styles.shade} aria-hidden="true" />
      <div className={styles.dust} aria-hidden="true">
        {DUST.map(([left, top, delay, size]) => (
          <span key={`${left}.${top}`} style={{ left: `${left}%`, top: `${top}%`, animationDelay: `${delay}s`, width: size, height: size }} />
        ))}
      </div>

      <header className={`wrap ${styles.bar}`}>
        <Link href="/" className={styles.brand} aria-label="Ormine home">
          <Image src="/img/wordmark.svg" alt="" width={820} height={210} unoptimized />
        </Link>
        <nav aria-label="Main" className={styles.nav}>
          {LANDING_NAV.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>
        <BevelButton href="/mine" variant="large" tone="gold" className={styles.cta}>
          Launch app
        </BevelButton>
      </header>

      <div className={`wrap ${styles.center}`}>
        <p className={styles.kicker}>Under the market there&apos;s a mine</p>
        <h1 className={styles.title}>
          <Image src="/img/wordmark.svg" alt="Ormine" width={820} height={210} unoptimized loading="eager" />
        </h1>
        <p className={styles.tagline}>Mine the market.</p>
      </div>

      <div className={styles.rail} aria-label="Scroll">
        <span className={styles.railOff} aria-hidden="true">
          <PixelGlyph map={ARROW_UP} size={28} />
        </span>
        <a href="#about" aria-label="Next section">
          <PixelGlyph map={ARROW_DOWN} size={28} />
        </a>
      </div>

      <div className={styles.social}>
        <a
          href={X_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Ormine on X (opens in a new tab)"
        >
          <PixelGlyph map={X_MARK} size={32} />
        </a>
      </div>

      <div className={`wrap ${styles.foot}`}>
        <Points items={POINTS.left} side="left" />
        {deployment && <CopyAddress label="NFT" address={deployment.miners} />}
        <Points items={POINTS.right} side="right" />
      </div>

      <CheckerBand color="#F0F0F0" bg="transparent" className={styles.band} />
    </section>
  );
}
