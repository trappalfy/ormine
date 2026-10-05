"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import type { ReactNode } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { BevelButton } from "@/components/os/BevelButton";
import { OsWindow } from "@/components/os/OsWindow";
import { PixelIcon } from "@/components/os/PixelIcon";
import { appChain, deployment } from "@/lib/chain";
import styles from "./app.module.css";

/** Shows "Log on to Ormine" until a wallet is connected on the right chain, then the screen. */
export function NetworkGate({ children, needsWallet = true }: { children: ReactNode; needsWallet?: boolean }) {
  const { isConnected, chainId } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { switchChain, isPending } = useSwitchChain();

  if (!deployment) {
    return (
      <OsWindow title="Ormine" controls={["close"]} className={styles.small}>
        <div className={styles.notice}>
          <PixelIcon name="warning" size={48} />
          <p>The mine isn&apos;t open on {appChain.name} yet. Check back soon.</p>
        </div>
      </OsWindow>
    );
  }
  if (needsWallet && !isConnected) {
    return (
      <OsWindow title="Log on to Ormine" controls={["help", "close"]} className={styles.small}>
        <div className={styles.notice}>
          <PixelIcon name="cartmini" size={64} />
          <p>Connect a wallet on {appChain.name} to see your miners and dig.</p>
          <BevelButton variant="large" onClick={openConnectModal}>
            Connect wallet
          </BevelButton>
        </div>
      </OsWindow>
    );
  }
  if (isConnected && chainId !== appChain.id) {
    return (
      <OsWindow title="Wrong network" controls={["close"]} className={styles.small}>
        <div className={styles.notice}>
          <PixelIcon name="warning" size={64} />
          <p>Wrong network. Ormine runs on {appChain.name}.</p>
          <BevelButton variant="large" disabled={isPending} onClick={() => switchChain({ chainId: appChain.id })}>
            Switch network
          </BevelButton>
        </div>
      </OsWindow>
    );
  }
  return <>{children}</>;
}
