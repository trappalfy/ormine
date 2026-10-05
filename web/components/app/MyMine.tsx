"use client";

import Image from "next/image";
import { useState, type KeyboardEvent } from "react";
import { tierInfo, todayEstimate } from "@ormine/shared";
import { BevelButton } from "@/components/os/BevelButton";
import { OsWindow } from "@/components/os/OsWindow";
import { PicWindow } from "@/components/os/PicWindow";
import { fmtToken, timeLeft } from "@/lib/format";
import { useMyMiners, useOwed, useVeins, type MyMiner, type Vein } from "@/lib/ormine";
import { useNow } from "@/lib/useNow";
import { ClaimDialog, MoveDialog, UpgradeDialog, type VeinTotal } from "./MinerDialogs";
import styles from "./app.module.css";

const status = (m: MyMiner, now: number) => (m.arrivesAt > 0n ? `On the way · ${timeLeft(m.arrivesAt, now)}` : "Digging");

/** "My mine": a file-manager window with the player's miners, details and actions (design 6). */
export function MyMine() {
  const mine = useMyMiners();
  const v = useVeins();
  const veins = v.veins ?? [];
  const { owed, refetch: refetchOwed } = useOwed(veins.length);
  const [selId, setSelId] = useState<bigint>();
  const [dialog, setDialog] = useState<"claim" | "upgrade" | "move" | null>(null);
  const now = useNow();

  const miners = mine.miners;
  const selected = miners?.find((m) => m.id === selId) ?? miners?.[0];
  const refresh = () => Promise.all([mine.refetch(), v.refetch(), refetchOwed()]);

  const totals: VeinTotal[] = veins.map((vein) => {
    const here = miners?.filter((m) => m.vein === vein.id) ?? [];
    const amount = here.reduce((s, m) => s + m.pending, 0n) + (owed?.[vein.id] ?? 0n);
    return { vein, amount, ids: here.map((m) => m.id) };
  });

  function onRowKey(e: KeyboardEvent, i: number) {
    if (!miners) return;
    const next = e.key === "ArrowDown" ? i + 1 : e.key === "ArrowUp" ? i - 1 : -1;
    if (next >= 0 && next < miners.length) {
      e.preventDefault();
      setSelId(miners[next].id);
      (e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
    }
  }

  const hasOwed = owed?.some((x) => x > 0n);
  const empty = miners !== undefined && miners.length === 0 && !hasOwed;

  return (
    <OsWindow title="My mine" titleSize="lg">
      <div className={styles.toolbar} role="toolbar" aria-label="Actions">
        <BevelButton face="sans" onClick={() => setDialog("claim")} disabled={!miners || empty}>
          Claim all
        </BevelButton>
        <BevelButton face="sans" onClick={() => setDialog("upgrade")} disabled={!selected}>
          Upgrade
        </BevelButton>
        <BevelButton face="sans" onClick={() => setDialog("move")} disabled={!selected || selected.arrivesAt > 0n}>
          Move
        </BevelButton>
      </div>

      {empty ? (
        <div className={styles.empty}>
          <p style={{ margin: 0 }}>No miners yet.</p>
          <BevelButton variant="large" href="/mint">
            Mint a Digger
          </BevelButton>
        </div>
      ) : (
        <div className={styles.explorer}>
          <div className={styles.list}>
            {miners === undefined ? (
              <p className={styles.hint} style={{ padding: 12 }}>
                {mine.isError ? "Can't reach the chain right now." : "Loading your miners…"}
              </p>
            ) : (
              <table className={styles.table} aria-label="Your miners">
                <thead>
                  <tr>
                    <th>Miner</th>
                    <th>Tier</th>
                    <th>Vein</th>
                    <th className={styles.hideSm}>Hashrate</th>
                    <th>Pending</th>
                    <th className={styles.hideSm}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {miners.map((m, i) => {
                    const t = tierInfo(m.tier);
                    const vein = veins[m.vein];
                    return (
                      <tr
                        key={m.id.toString()}
                        tabIndex={0}
                        aria-selected={m.id === selected?.id}
                        onClick={() => setSelId(m.id)}
                        onKeyDown={(e) => onRowKey(e, i)}
                      >
                        <td>
                          <Image className={`${styles.tierIcon} px`} src={`/img/tiers/${t.slug}.png`} alt="" width={32} height={32} />#{m.id.toString()}
                        </td>
                        <td>{t.name}</td>
                        <td>{vein?.ticker ?? "…"}</td>
                        <td className={`${styles.num} ${styles.hideSm}`}>{t.hash} H</td>
                        <td className={styles.num}>{fmtToken(m.pending)}</td>
                        <td className={styles.hideSm}>{status(m, now)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          {selected ? <Details miner={selected} vein={veins[selected.vein]} now={now} onAction={setDialog} /> : null}
        </div>
      )}

      <p className={styles.statusbar} aria-live="polite">
        {totals.length === 0
          ? "Loading veins…"
          : totals.map((t) => (
              <span key={t.vein.id}>
                {t.vein.ticker} pending {fmtToken(t.amount)}
              </span>
            ))}
      </p>

      {dialog === "claim" && <ClaimDialog totals={totals} onClose={() => setDialog(null)} onDone={refresh} />}
      {dialog === "upgrade" && selected && <UpgradeDialog miner={selected} vein={veins[selected.vein]} onClose={() => setDialog(null)} onDone={refresh} />}
      {dialog === "move" && selected && <MoveDialog miner={selected} veins={veins} onClose={() => setDialog(null)} onDone={refresh} />}
    </OsWindow>
  );
}

function Details({ miner, vein, now, onAction }: { miner: MyMiner; vein?: Vein; now: number; onAction: (d: "claim" | "upgrade" | "move") => void }) {
  const t = tierInfo(miner.tier);
  const digging = miner.arrivesAt === 0n;
  const today = vein && digging ? todayEstimate(miner.hashrate, vein.totalHash, vein.epochRelease) : undefined;
  return (
    <aside className={styles.details} aria-label={`Miner #${miner.id}`}>
      <PicWindow label={`Tier ${t.roman}`} file={`[${t.slug}.png]`} src={`/img/tiers/${t.slug}.png`} alt={`Tier ${t.roman} ${t.name}`} sizes="280px" />
      <h3>
        #{miner.id.toString()} {t.name}
      </h3>
      <dl className={styles.rows}>
        <div>
          <dt>Vein</dt>
          <dd>{vein?.ticker ?? "…"}</dd>
        </div>
        <div>
          <dt>Hashrate</dt>
          <dd>{t.hash} H</dd>
        </div>
        <div>
          <dt>Pending</dt>
          <dd>
            {fmtToken(miner.pending)} {vein?.ticker}
          </dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{status(miner, now)}</dd>
        </div>
        {today !== undefined && (
          <div>
            <dt>Today ≈</dt>
            <dd>
              {fmtToken(today)} {vein?.ticker}
            </dd>
          </div>
        )}
      </dl>
      {today !== undefined && <p className={styles.hint}>Changes as the vein and its miners change.</p>}
      <div className={styles.actions} style={{ justifyContent: "flex-start" }}>
        <BevelButton face="sans" onClick={() => onAction("claim")}>
          Claim
        </BevelButton>
        <BevelButton face="sans" onClick={() => onAction("upgrade")} disabled={miner.tier >= 4}>
          Upgrade
        </BevelButton>
        <BevelButton face="sans" onClick={() => onAction("move")} disabled={!digging}>
          Move
        </BevelButton>
      </div>
    </aside>
  );
}
