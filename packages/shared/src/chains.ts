import { robinhood, robinhoodTestnet } from "viem/chains";
import { defineChain } from "viem";

export { robinhood, robinhoodTestnet };

// Local anvil, used in development only.
export const anvil = defineChain({
  id: 31_337,
  name: "Anvil",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
});

export const SUPPORTED_CHAIN_IDS = [robinhood.id, robinhoodTestnet.id, anvil.id] as const;
