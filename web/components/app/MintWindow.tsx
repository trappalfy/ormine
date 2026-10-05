"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useState } from "react";
import { useAccount, useBalance } from "wagmi";
import { MAX_PER_TX, MAX_SUPPLY, MINT_PRICE_WEI, TEAM_SHARE_PCT, VEIN_SHARE_PCT } from "@ormine/shared";
import { BevelButton } from "@/components/os/BevelButton";
import { OsWindow } from "@/components/os/OsWindow";
import { PicWindow } from "@/components/os/PicWindow";
import { PixelIcon } from "@/components/os/PixelIcon";
import { fmtEth, fmtInt, fmtToken } from "@/lib/format";
import { minersContract, useMintState, useVeins } from "@/lib/ormine";
import { useNow } from "@/lib/useNow";
import { TxDialog } from "./TxDialog";
import { useTx } from "./useTx";
import styles from "./app.module.css";

/** "Mint a Digger": pick a vein, a quantity, see the total, mint (design 6). */
export function MintWindow({ initialVein }: { initialVein?: string }) {
  const { veins, isError } = useVeins();
  const mint = useMintState();
  const { address, isConnected } = useAccount();
  const { data: eth } = useBalance({ address, query: { refetchInterval: 15_000 } });
  const { openConnectModal } = useConnectModal();
  const tx = useTx();
  const now = useNow();
  const [picked, setPicked] = useState<number | undefined>();
  const [qty, setQty] = useState(1);

  const open = veins?.filter((v) => !v.closed) ?? [];
  const fromParam = open.find((v) => v.ticker.toUpperCase() === initialVein?.toUpperCase())?.id;
  const veinId = picked ?? fromParam ?? open[0]?.id;
  const vein = veins?.find((v) => v.id === veinId);

  const left = mint.minted === undefined ? undefined : MAX_SUPPLY - Number(mint.minted);
  const maxQty = Math.max(1, Math.min(MAX_PER_TX, left ?? MAX_PER_TX));
  const total = MINT_PRICE_WEI * BigInt(qty);
  const sunset = mint.sunsetAt !== undefined && mint.sunsetAt !== 0n && now >= Number(mint.sunsetAt);
  const closedReason = sunset
    ? "The mine is closed. Claims stay open."
    : mint.paused
      ? "Minting opens soon."
      : left === 0
        ? "All miners are minted."
        : undefined;
  const short = isConnected && eth !== undefined && eth.value < total;

  async function onMint() {
    if (!isConnected) return openConnectModal?.();
    if (veinId === undefined || !minersContract) return;
    const ok = await tx.run(`Mint ${qty} Digger${qty > 1 ? "s" : ""}`, {
      ...minersContract,
      functionName: "mint",
      args: [veinId, BigInt(qty)],
      value: total,
    });
    if (ok) await mint.refetch();
  }

  return (
    <OsWindow title="Mint a Digger" titleSize="lg">
      <div className={styles.mintGrid}>
        <PicWindow label="Tier I" file="[digger.png]" src="/img/tiers/digger.png" alt="Tier I Digger: brown hat, mustache, pickaxe" sizes="280px" />
        <div className={styles.body} style={{ padding: 0 }}>
          <fieldset className={styles.radios}>
            <legend className={styles.groupLabel}>Pick a vein</legend>
            {veins === undefined && <p className={styles.hint}>{isError ? "Can't reach the chain right now." : "Loading veins…"}</p>}
            {veins?.map((v) => (
              <label key={v.id} className={styles.radio}>
                <input type="radio" name="vein" value={v.id} checked={v.id === veinId} disabled={v.closed} onChange={() => setPicked(v.id)} />
                <span>
                  <b>{v.ticker}</b> <small>· In the vein: {fmtToken(v.balance)} {v.ticker}{v.closed ? " · closed" : ""}</small>
                </span>
              </label>
            ))}
          </fieldset>

          <div>
            <p className={styles.groupLabel} id="qty-label">
              How many
            </p>
            <div className={styles.stepper} role="group" aria-labelledby="qty-label">
              <output aria-live="polite">{qty}</output>
              <div>
                <button type="button" aria-label="One more" disabled={qty >= maxQty} onClick={() => setQty((q) => Math.min(maxQty, q + 1))}>
                  ▲
                </button>
                <button type="button" aria-label="One less" disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))}>
                  ▼
                </button>
              </div>
            </div>
          </div>

          <dl className={`${styles.rows} ${styles.field}`}>
            <div>
              <dt>Total</dt>
              <dd>{fmtEth(total)}</dd>
            </div>
            <div>
              <dt>You get</dt>
              <dd>
                {qty} Tier I Digger{qty > 1 ? "s" : ""} in {vein?.ticker ?? "…"}
              </dd>
            </div>
            <div>
              <dt>Hashrate</dt>
              <dd>{qty * 10} H</dd>
            </div>
            {left !== undefined && (
              <div>
                <dt>Left to mint</dt>
                <dd>{fmtInt(left)}</dd>
              </div>
            )}
          </dl>
          <p className={styles.hint}>
            {VEIN_SHARE_PCT}% of the price buys {vein?.ticker ?? "the vein's stock"} for the vein. {TEAM_SHARE_PCT}% goes to the team. Fixed in the contract.
          </p>

          {(closedReason || short) && (
            <p className={styles.warn} role="status">
              <PixelIcon name="warning" size={32} />
              {closedReason ?? "Not enough ETH in this wallet."}
            </p>
          )}
          <div className={styles.actions}>
            <BevelButton variant="large" onClick={onMint} disabled={!!closedReason || short || veinId === undefined || tx.busy}>
              {isConnected ? "Mint" : "Connect wallet"}
            </BevelButton>
          </div>
        </div>
      </div>
      <TxDialog state={tx.state} onClose={tx.reset} />
    </OsWindow>
  );
}
