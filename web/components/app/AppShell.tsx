"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { TopLine } from "@/components/landing/TopLine";
import { PixelIcon } from "@/components/os/PixelIcon";
import type { PixelIconName } from "@/components/os/pixelMaps";
import { WalletButton } from "./WalletButton";
import styles from "./app.module.css";

const APP_NAV: { label: string; href: string; icon: PixelIconName }[] = [
  { label: "Mint", href: "/mint", icon: "pick" },
  { label: "My mine", href: "/mine", icon: "cartmini" },
  { label: "Veins", href: "/veins", icon: "ore" },
  { label: "Docs", href: "/docs", icon: "folder" },
];

/** The graphite desktop every app screen sits on: top line, desktop icons, one window in the middle. */
export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  return (
    <div className={styles.desk}>
      <div className="wrap">
        <TopLine links={[]} action={<WalletButton />} />
        <nav aria-label="App" className={styles.icons}>
          {APP_NAV.map((n) => (
            <Link key={n.href} href={n.href} className={styles.icon} aria-current={path === n.href ? "page" : undefined}>
              <PixelIcon name={n.icon} size={48} />
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
