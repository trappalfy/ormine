"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, lightTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { WagmiProvider, useAccount, useConnect } from "wagmi";
import { appChain } from "@/lib/chain";
import { E2E_ACCOUNT, wagmiConfig } from "@/lib/wagmi";

const theme = lightTheme({ accentColor: "#B8641A", accentColorForeground: "#fff", borderRadius: "none", fontStack: "system" });

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 5_000 } } }));
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme} initialChain={appChain} modalSize="compact">
          {E2E_ACCOUNT ? <E2EAutoConnect /> : null}
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

/** Local e2e runs only: connects the mock anvil account on load. */
function E2EAutoConnect() {
  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  useEffect(() => {
    if (!isConnected && connectors[0]) connect({ connector: connectors[0] });
  }, [isConnected, connect, connectors]);
  return null;
}
