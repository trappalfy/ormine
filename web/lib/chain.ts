import { anvil, deploymentFor, ormineMinersAbi, robinhood, robinhoodTestnet } from "@ormine/shared";

// One chain per build: NEXT_PUBLIC_CHAIN_ID = 4663 (mainnet), 46630 (testnet) or 31337 (local anvil).
export const APP_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? robinhoodTestnet.id);

export const appChain = APP_CHAIN_ID === robinhood.id ? robinhood : APP_CHAIN_ID === anvil.id ? anvil : robinhoodTestnet;

export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || appChain.rpcUrls.default.http[0];

export const deployment = deploymentFor(appChain.id);

export const minersContract = deployment ? ({ address: deployment.miners, abi: ormineMinersAbi } as const) : undefined;

export const explorerTx = (hash: string) =>
  appChain.blockExplorers ? `${appChain.blockExplorers.default.url}/tx/${hash}` : undefined;
