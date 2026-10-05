"use client";

import { BevelButton } from "@/components/os/BevelButton";
import { ProgressDialog } from "@/components/os/ProgressDialog";
import { explorerTx } from "@/lib/chain";
import { Modal } from "./Modal";
import type { TxState } from "./useTx";
import styles from "./app.module.css";

/** Transaction status in a ProgressDialog: signature → digging → done / failed (design 6). */
export function TxDialog({ state, onClose }: { state: TxState; onClose: () => void }) {
  if (state.phase === "idle") return null;
  const busy = state.phase === "signing" || state.phase === "pending";
  const link = "hash" in state && state.hash ? explorerTx(state.hash) : undefined;
  return (
    <Modal onClose={onClose} locked={busy} label={state.label}>
      <ProgressDialog
        title={state.label}
        controls={busy ? [] : ["close"]}
        onClose={busy ? undefined : onClose}
        running={state.phase === "pending"}
        percent={state.phase === "signing" ? 0 : 100}
        meter={busy}
        icon={state.phase === "done" ? "done" : state.phase === "failed" ? "failed" : undefined}
        progressLabel="Transaction progress"
        message={
          <span aria-live="polite">
            {state.phase === "signing" && "Waiting for signature…"}
            {state.phase === "pending" && "Digging… (pending)"}
            {state.phase === "done" && "Done."}
            {state.phase === "failed" && state.error}
          </span>
        }
      >
        {link ? (
          <a className={styles.link} href={link} target="_blank" rel="noreferrer">
            View on explorer ↗
          </a>
        ) : null}
        {!busy ? (
          <BevelButton face="sans" onClick={onClose}>
            Close
          </BevelButton>
        ) : null}
      </ProgressDialog>
    </Modal>
  );
}
