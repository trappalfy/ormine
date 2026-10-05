"use client";

import { useEffect, useState } from "react";
import { createPublicClient, formatUnits, http } from "viem";
import { LAUNCH_VEINS, ormineMinersAbi } from "@ormine/shared";
import { appChain, deployment, RPC_URL } from "./chain";

// Per-vein numbers shown on the landing.
// Strings are already converted from token units (e.g. "12.3456"); null means "not known".
export type VeinSummary = {
  id: number;
  ticker: string;
  balance: string | null;
  releasedToday: string | null;
  miners: number | null;
  totalHash: number | null;
};

// "soon": the contracts are not deployed on this chain yet.
export type VeinsState = { status: "loading" | "error" | "soon" | "ready"; veins: VeinSummary[] };

const REFRESH_MS = 60_000; // design 4.5

const placeholder = (status: VeinsState["status"]): VeinsState => ({
  status,
  veins: LAUNCH_VEINS.map((ticker, id) => ({ id, ticker, balance: null, releasedToday: null, miners: null, totalHash: null })),
});

// Stock tokens on Robinhood Chain have 18 decimals; the contract keeps raw token units.
const toAmount = (v: bigint) => formatUnits(v, 18);

async function readVeins(): Promise<VeinSummary[]> {
  if (!deployment) throw new Error("not deployed");
  const client = createPublicClient({ chain: appChain, transport: http(RPC_URL), batch: { multicall: true } });
  const contract = { address: deployment.miners, abi: ormineMinersAbi } as const;
  const count = await client.readContract({ ...contract, functionName: "veinCount" });
  const infos = await Promise.all(
    Array.from({ length: count }, (_, i) => client.readContract({ ...contract, functionName: "veinInfo", args: [i] })),
  );
  return infos.map((v, id) => ({
    id,
    ticker: v.ticker,
    balance: toAmount(v.balance),
    releasedToday: toAmount(v.epochRelease),
    miners: Number(v.miners),
    totalHash: Number(v.totalHash),
  }));
}

/** Live vein numbers from OrmineMiners, refreshed every minute. Client components only. */
export function useVeinsSummary(): VeinsState {
  const [state, setState] = useState<VeinsState>(() => placeholder(deployment ? "loading" : "soon"));
  useEffect(() => {
    if (!deployment) return;
    let alive = true;
    const load = () =>
      readVeins().then(
        (veins) => alive && setState({ status: "ready", veins }),
        () => alive && setState((s) => (s.status === "ready" ? s : placeholder("error"))),
      );
    void load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return state;
}
