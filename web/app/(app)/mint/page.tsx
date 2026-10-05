import type { Metadata } from "next";
import { MintWindow } from "@/components/app/MintWindow";
import { NetworkGate } from "@/components/app/NetworkGate";

export const metadata: Metadata = { title: "Mint a Digger · Ormine" };

export default async function MintPage({ searchParams }: { searchParams: Promise<{ vein?: string }> }) {
  const { vein } = await searchParams;
  return (
    <NetworkGate needsWallet={false}>
      <MintWindow initialVein={vein} />
    </NetworkGate>
  );
}
