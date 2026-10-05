"use client";

import { useState } from "react";
import styles from "./Hero.module.css";

/** "NFT 0x…" plate with a copy button. The full address shows on wide screens, a short one on phones. */
export function CopyAddress({ label, address }: { label: string; address: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked (insecure context or denied): the address stays selectable.
    }
  };
  return (
    <div className={styles.ca}>
      <span className={styles.caLabel}>{label}</span>
      <span className={styles.caFull}>{address}</span>
      <span className={styles.caShort}>
        {address.slice(0, 6)}…{address.slice(-4)}
      </span>
      <button type="button" onClick={copy} className={styles.caCopy} aria-label={copied ? "Copied" : `Copy the ${label} contract address`}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
