"use client";

import { useState } from "react";
import { useAccount, useBalance } from "wagmi";
import { TEAM_SHARE_PCT, TRAVEL_HOURS, VEIN_SHARE_PCT, tierInfo, upgradePriceWei } from "@ormine/shared";
import { BevelButton } from "@/components/os/BevelButton";
import { OsWindow } from "@/components/os/OsWindow";
import { PixelIcon } from "@/components/os/PixelIcon";
import { fmtEth, fmtToken } from "@/lib/format";
import { minersContract, useMintState, type MyMiner, type Vein } from "@/lib/ormine";
import { Modal } from "./Modal";
import { TxDialog } from "./TxDialog";
import { useTx } from "./useTx";
import styles from "./app.module.css";

type Common = { onClose: () => void; onDone: () => void };

/** Shows the dialog until a transaction starts, then its progress. Closing a finished action closes both;
 *  after a failure the dialog comes back to try again. */
function useDialogTx(onClose: () => void, onDone: () => void) {
  const tx = useTx();
  const close = () => {
    const s = tx.state;
    tx.reset();
    if (s.phase === "done") {
      onDone();
      onClose();
    }
  };
  return { tx, txOpen: tx.state.phase !== "idle", txDialog: <TxDialog state={tx.state} onClose={close} /> };
}

export function UpgradeDialog({ miner, vein, onClose, onDone }: Common & { miner: MyMiner; vein?: Vein }) {
  const { address } = useAccount();
  const { data: eth, refetch: refetchEth } = useBalance({ address, query: { refetchInterval: 15_000 } });
  const sales = useMintState();
  const { tx, txOpen, txDialog } = useDialogTx(onClose, () => {
    onDone();
    void refetchEth();
  });
  const from = tierInfo(miner.tier);
  const to = tierInfo(miner.tier + 1);
  const price = upgradePriceWei(miner.tier);
  const short = eth !== undefined && eth.value < price;
  const ticker = vein?.ticker ?? "the vein's stock";

  if (txOpen) return txDialog;

  async function upgrade() {
    if (!minersContract) return;
    await tx.run("Upgrade gear", { ...minersContract, functionName: "upgrade", args: [miner.id], value: price });
  }

  return (
    <Modal onClose={onClose} label="Upgrade gear">
      <OsWindow title="Upgrade gear" controls={["close"]} onClose={onClose}>
        <div className={styles.body}>
          {miner.tier >= 4 ? (
            <p>This miner is a Rig already. There is no better gear.</p>
          ) : (
            <>
              <dl className={`${styles.rows} ${styles.field}`}>
                <div>
                  <dt>Miner #{miner.id.toString()}</dt>
                  <dd>
                    Tier {from.roman} {from.name} → Tier {to.roman} {to.name}
                  </dd>
                </div>
                <div>
                  <dt>Hashrate</dt>
                  <dd>
                    {from.hash} H → {to.hash} H
                  </dd>
                </div>
                <div>
                  <dt>Price</dt>
                  <dd>{fmtEth(price)}</dd>
                </div>
              </dl>
              <p className={styles.hint}>
                {VEIN_SHARE_PCT}% of the price buys {ticker} for the vein this miner digs in, {TEAM_SHARE_PCT}% goes to the team, like a
                mint. What the miner earned so far is kept.
              </p>
              {sales.paused && (
                <p className={styles.warn}>
                  <PixelIcon name="warning" size={32} />
                  Upgrades are paused right now.
                </p>
              )}
              {short && (
                <p className={styles.warn}>
                  <PixelIcon name="warning" size={32} />
                  Not enough ETH in this wallet.
                </p>
              )}
            </>
          )}
          <div className={styles.actions}>
            {miner.tier < 4 ? (
              <BevelButton face="sans" onClick={upgrade} disabled={short || sales.paused !== false}>
                Upgrade
              </BevelButton>
            ) : null}
            <BevelButton face="sans" onClick={onClose}>
              Cancel
            </BevelButton>
          </div>
        </div>
      </OsWindow>
    </Modal>
  );
}

export function MoveDialog({ miner, veins, onClose, onDone }: Common & { miner: MyMiner; veins: Vein[] }) {
  const { tx, txOpen, txDialog } = useDialogTx(onClose, onDone);
  const targets = veins.filter((v) => v.id !== miner.vein && !v.closed);
  const [to, setTo] = useState<number | undefined>(targets[0]?.id);
  if (txOpen) return txDialog;

  async function move() {
    if (to === undefined || !minersContract) return;
    await tx.run("Move miner", { ...minersContract, functionName: "move", args: [miner.id, to] });
  }

  return (
    <Modal onClose={onClose} label="Move miner">
      <OsWindow title="Move miner" controls={["close"]} onClose={onClose}>
        <div className={styles.body}>
          <fieldset className={styles.radios}>
            <legend className={styles.groupLabel}>
              Move #{miner.id.toString()} from {veins[miner.vein]?.ticker} to
            </legend>
            {targets.length === 0 && <p className={styles.hint}>No other open veins.</p>}
            {targets.map((v) => (
              <label key={v.id} className={styles.radio}>
                <input type="radio" name="to" checked={to === v.id} onChange={() => setTo(v.id)} />
                <span>
                  <b>{v.ticker}</b> <small>· In the vein: {fmtToken(v.balance)} {v.ticker}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <p className={styles.warn}>
            <PixelIcon name="move" size={32} />
            Your miner won&apos;t dig for {TRAVEL_HOURS} hours while it travels.
          </p>
          <p className={styles.hint}>What it earned in {veins[miner.vein]?.ticker} stays yours to claim.</p>
          <div className={styles.actions}>
            <BevelButton face="sans" onClick={move} disabled={to === undefined}>
              Move
            </BevelButton>
            <BevelButton face="sans" onClick={onClose}>
              Cancel
            </BevelButton>
          </div>
        </div>
      </OsWindow>
    </Modal>
  );
}

export type VeinTotal = { vein: Vein; amount: bigint; ids: bigint[] };

export function ClaimDialog({ totals, onClose, onDone }: Common & { totals: VeinTotal[] }) {
  const { tx, txOpen, txDialog } = useDialogTx(onClose, onDone);
  if (txOpen) return txDialog;
  const ready = totals.filter((t) => t.amount > 0n);

  return (
    <Modal onClose={onClose} label="Claim">
      <OsWindow title="Claim" controls={["close"]} onClose={onClose}>
        <div className={styles.body}>
          {ready.length === 0 ? (
            <p>Nothing to claim yet. Your miners are still digging.</p>
          ) : (
            <>
              <p className={styles.hint}>Each vein pays in its own stock and is claimed on its own.</p>
              {ready.map((t) => (
                <div key={t.vein.id} className={`${styles.field} ${styles.rows}`}>
                  <div>
                    <dt>{t.vein.ticker} vein</dt>
                    <dd>
                      ≈ {fmtToken(t.amount)} {t.vein.ticker}
                    </dd>
                  </div>
                  <div className={styles.actions}>
                    <BevelButton
                      face="sans"
                      onClick={() => minersContract && tx.run(`Claim ${t.vein.ticker}`, { ...minersContract, functionName: "claim", args: [t.vein.id, t.ids] })}
                    >
                      Claim {t.vein.ticker}
                    </BevelButton>
                  </div>
                </div>
              ))}
            </>
          )}
          <div className={styles.actions}>
            <BevelButton face="sans" onClick={onClose}>
              Close
            </BevelButton>
          </div>
        </div>
      </OsWindow>
    </Modal>
  );
}
