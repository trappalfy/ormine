import Image from "next/image";
import Link from "next/link";
import { CheckerBand } from "@/components/os/CheckerBand";
import { FallingOre, OreBadges, OreGame } from "@/components/os/FallingOre";
import { X_URL } from "@/lib/links";
import styles from "./Footer.module.css";

// North-east arrow forced to text presentation (no colour emoji on Apple).
const ARROW = "\u2197\uFE0E";

/** Footer: Mined/Depth badges, the graphite card with links and the falling-ore game, gold band. */
export function Footer() {
  return (
    <footer className={styles.foot}>
      <OreGame>
        <div className="wrap">
          <OreBadges className={styles.badges} />
          <div className={styles.panel}>
            <div className={styles.cols}>
              <div>
                <p className={styles.brand}>
                  <span className={styles.box}>
                    <Image src="/img/cart.png" alt="" width={52} height={52} unoptimized />
                  </span>
                  Ormine
                </p>
                <div className={styles.small}>
                  <Link href="/docs/risks">Risks</Link>
                </div>
              </div>
              <div>
                <p className={styles.tagline}>Mine the market</p>
                <ul className={styles.links}>
                  <li>
                    <a href={X_URL} target="_blank" rel="noopener noreferrer" aria-label="Ormine on X (opens in a new tab)">
                      X {ARROW}
                    </a>
                  </li>
                </ul>
              </div>
              <nav aria-label="App">
                <ul className={styles.links}>
                  <li>
                    <Link href="/mint">Mint</Link>
                  </li>
                  <li>
                    <Link href="/mine">My mine</Link>
                  </li>
                  <li>
                    <Link href="/veins">Veins</Link>
                  </li>
                  <li>
                    <Link href="/docs">Docs</Link>
                  </li>
                </ul>
              </nav>
              <nav aria-label="Page">
                <ul className={styles.links}>
                  <li>
                    <a href="#about">About</a>
                  </li>
                  <li>
                    <a href="#crew">The crew</a>
                  </li>
                </ul>
              </nav>
            </div>
            <FallingOre className={styles.game} />
          </div>
        </div>
      </OreGame>
      <CheckerBand color="#F5CC17" bg="#F0F0F0" />
    </footer>
  );
}
