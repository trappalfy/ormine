"use client";

import { useVeinsSummary } from "@/lib/veins";
import { VeinFolder } from "./VeinFolder";
import styles from "./Veins.module.css";

/** The vein folders, fed by useVeinsSummary(). */
export function VeinsGrid() {
  const { status, veins } = useVeinsSummary();
  return (
    <div className={styles.folders}>
      {veins.map((v) => (
        <VeinFolder key={v.id} vein={v} status={status} />
      ))}
    </div>
  );
}
