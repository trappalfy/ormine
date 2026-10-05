import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { BevelButton } from "@/components/os/BevelButton";
import styles from "./TopLine.module.css";

export type NavLink = { label: string; href: string };

// "/#about" works both on the landing (scrolls) and from the app routes (navigates home).
export const LANDING_NAV: NavLink[] = [
  { label: "About", href: "/#about" },
  { label: "How it works", href: "/#how" },
  { label: "The crew", href: "/#crew" },
  { label: "Veins", href: "/#veins" },
  { label: "Docs", href: "/docs" },
];

type TopLineProps = {
  links?: NavLink[];
  /** Right-hand slot; "Launch app" → /mine by default. */
  action?: ReactNode;
};

/** "Ormine · nav · Launch app" over a 2px rule. Nav hides at ≤1100px. Sits on graphite. */
export function TopLine({ links = LANDING_NAV, action }: TopLineProps) {
  return (
    <div className={styles.topline}>
      <Link href="/" className={styles.brand} aria-label="Ormine home">
        <Image src="/img/wordmark.svg" alt="" width={820} height={210} unoptimized />
      </Link>
      <nav aria-label="Main" className={styles.nav}>
        {links.map((l) => (
          <Link key={l.href} href={l.href}>
            {l.label}
          </Link>
        ))}
      </nav>
      <span className={styles.right}>{action ?? (
          <BevelButton href="/mine" tone="gold">
            Launch app
          </BevelButton>
        )}</span>
    </div>
  );
}
