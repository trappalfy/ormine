"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { BevelButton } from "@/components/os/BevelButton";

/** Connect / account button in the top line, styled as an OS button. */
export function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, openAccountModal, openChainModal, mounted }) => {
        if (!mounted) return <BevelButton disabled>Connect wallet</BevelButton>;
        if (!account) return <BevelButton onClick={openConnectModal}>Connect wallet</BevelButton>;
        if (chain?.unsupported) return <BevelButton onClick={openChainModal}>Wrong network</BevelButton>;
        return <BevelButton onClick={openAccountModal}>{account.displayName}</BevelButton>;
      }}
    </ConnectButton.Custom>
  );
}
