import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import type { Address, Chain } from "viem";
import { createConfig, http } from "wagmi";
import { mock } from "wagmi/connectors";
import { anvil } from "@ormine/shared";
import { appChain, RPC_URL } from "./chain";

// End-to-end tests drive the app with anvil's unlocked accounts instead of a wallet extension.
// Only honoured on the local anvil chain, so it can never reach a testnet or mainnet build.
export const E2E_ACCOUNT =
  appChain.id === anvil.id ? (process.env.NEXT_PUBLIC_E2E_ACCOUNT as Address | undefined) : undefined;

const chains: [Chain] = [appChain];
const transports = { [appChain.id]: http(RPC_URL) };

export const wagmiConfig = E2E_ACCOUNT
  ? createConfig({
      chains,
      connectors: [mock({ accounts: [E2E_ACCOUNT], features: { reconnect: true } })],
      transports,
      ssr: true,
    })
  : getDefaultConfig({
      appName: "Ormine",
      // A WalletConnect Cloud project id enables mobile wallets; browser wallets work without it.
      projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "00000000000000000000000000000000",
      chains,
      transports,
      ssr: true,
    });
