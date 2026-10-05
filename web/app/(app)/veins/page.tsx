import type { Metadata } from "next";
import { NetworkGate } from "@/components/app/NetworkGate";
import { VeinsBoard } from "@/components/app/VeinsBoard";

export const metadata: Metadata = { title: "Veins · Ormine" };

export default function VeinsPage() {
  return (
    <NetworkGate needsWallet={false}>
      <VeinsBoard />
    </NetworkGate>
  );
}
