import type { Metadata } from "next";
import { MyMine } from "@/components/app/MyMine";
import { NetworkGate } from "@/components/app/NetworkGate";

export const metadata: Metadata = { title: "My mine · Ormine" };

export default function MinePage() {
  return (
    <NetworkGate>
      <MyMine />
    </NetworkGate>
  );
}
