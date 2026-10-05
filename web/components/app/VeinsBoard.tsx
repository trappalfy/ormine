"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { shareBps } from "@ormine/shared";
import { FolderCard } from "@/components/os/FolderCard";
import { fmtInt, fmtToken, pct } from "@/lib/format";
import { useMyMiners, useVeins } from "@/lib/ormine";
import styles from "./app.module.css";

/** Every vein as a folder with live numbers and the player's share (design 4.5, 6). */
export function VeinsBoard() {
  const { veins, isError } = useVeins(60_000);
  const { isConnected } = useAccount();
  const { miners } = useMyMiners();

  if (!veins) {
    return <p className={styles.note}>{isError ? "Can't reach the chain right now." : "…"}</p>;
  }
  return (
    <div>
      <div className={styles.folders}>
        {veins.map((v) => {
          const mine = miners?.filter((m) => m.vein === v.id) ?? [];
          const myHash = mine.filter((m) => m.arrivesAt === 0n).reduce((s, m) => s + m.hashrate, 0n);
          return (
            <FolderCard key={v.id} title={`${v.ticker} vein`}>
              <ul className={styles.veinRows}>
                <li>
                  / In the vein <b>{fmtToken(v.balance)} {v.ticker}</b>
                </li>
                <li>
                  / Released today <b>{fmtToken(v.epochRelease)} {v.ticker}</b>
                </li>
                <li>
                  / Miners digging <b>{fmtInt(v.miners)}</b>
                </li>
                <li>
                  / Total hashrate <b>{fmtInt(v.totalHash)} H</b>
                </li>
                {v.inTransitHash > 0n && (
                  <li>
                    / On the way here <b>{fmtInt(v.inTransitHash)} H</b>
                  </li>
                )}
              </ul>
              {isConnected && (
                <p className={styles.mine}>
                  Your miners here: {mine.length} · Your share: {pct(shareBps(myHash, v.totalHash))}
                </p>
              )}
              {v.closed ? (
                <p className={styles.mine}>Closed to new miners.</p>
              ) : (
                <Link className={styles.go} href={`/mint?vein=${v.ticker}`}>
                  &gt; Send a miner here
                </Link>
              )}
            </FolderCard>
          );
        })}
      </div>
      <p className={styles.note}>Numbers come straight from the contracts: what each vein holds, what it releases today, and who is digging there.</p>
    </div>
  );
}
