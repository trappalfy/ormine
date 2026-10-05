import Link from "next/link";
import type { ReactNode } from "react";
import { FolderCard } from "@/components/os/FolderCard";
import type { VeinSummary, VeinsState } from "@/lib/veins";
import styles from "./Veins.module.css";

/** 2–4 decimals, grouped: "1,234.5678". */
export function formatAmount(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

const formatInt = (n: number) => n.toLocaleString("en-US");

type Status = VeinsState["status"];

/** "…" while loading, "—" when the chain can't be read or the value is unknown. */
function show<T>(status: Status, value: T | null, format: (v: T) => string) {
  if (status === "loading") return "…";
  if (status === "error" || value === null) return "—";
  return format(value);
}

export type VeinFolderProps = {
  vein: VeinSummary;
  status: Status;
  /** Extra lines under the numbers, e.g. "Your miners here: n · Your share: x%" on /veins. */
  extra?: ReactNode;
};

/** One vein as a folder: balance, today's release, miners and hashrate, and a mint link. */
export function VeinFolder({ vein, status, extra }: VeinFolderProps) {
  const t = vein.ticker;
  const rows: [string, string][] = [
    ["In the vein", show(status, vein.balance, (v) => `${formatAmount(v)} ${t}`)],
    ["Released today", show(status, vein.releasedToday, (v) => `${formatAmount(v)} ${t}`)],
    ["Miners digging", show(status, vein.miners, formatInt)],
    ["Total hashrate", show(status, vein.totalHash, (v) => `${formatInt(v)} H`)],
  ];

  return (
    <FolderCard title={`${t} vein`} icon="ore">
      <dl className={styles.stats} aria-busy={status === "loading" || undefined}>
        {rows.map(([label, value]) => (
          <div key={label} className={styles.stat}>
            <dt>/ {label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {status === "error" ? <p className={styles.offline}>Can&apos;t reach the chain right now.</p> : null}
      {extra}
      <Link className={styles.go} href={`/mint?vein=${encodeURIComponent(t)}`}>
        &gt; Send a miner here
      </Link>
    </FolderCard>
  );
}
