"use client";

import { useMemo } from "react";
import type { Address } from "viem";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { minersContract } from "./chain";

export { deployment, minersContract } from "./chain";

export type Vein = {
  id: number;
  token: Address;
  ticker: string;
  closed: boolean;
  balance: bigint;
  epochStart: bigint;
  epochRelease: bigint;
  totalHash: bigint;
  inTransitHash: bigint;
  miners: bigint;
};

export type MyMiner = {
  id: bigint;
  tier: number;
  vein: number;
  hashrate: bigint;
  arrivesAt: bigint; // 0 while digging
  pending: bigint;
};

const LIVE = 15_000;

/** All veins, read live from OrmineMiners. */
export function useVeins(refetchInterval = LIVE) {
  const count = useReadContract({
    ...minersContract!,
    functionName: "veinCount",
    query: { enabled: !!minersContract, refetchInterval },
  });
  const n = Number(count.data ?? 0);
  const infos = useReadContracts({
    contracts: Array.from({ length: n }, (_, i) => ({ ...minersContract!, functionName: "veinInfo", args: [i] }) as const),
    query: { enabled: n > 0, refetchInterval },
  });
  const veins = useMemo<Vein[] | undefined>(() => {
    if (!infos.data) return n === 0 && count.isSuccess ? [] : undefined;
    return infos.data.flatMap((r, id) => (r.status === "success" ? [{ id, ...r.result }] : []));
  }, [infos.data, n, count.isSuccess]);
  return {
    veins,
    isLoading: count.isLoading || infos.isLoading,
    isError: count.isError || infos.isError,
    refetch: () => Promise.all([count.refetch(), infos.refetch()]),
  };
}

const PAGE = 2_000n;

/** The connected wallet's miners, paged through OrmineMiners.minersOf (no indexer needed). */
export function useMyMiners() {
  const { address } = useAccount();
  const total = useReadContract({
    ...minersContract!,
    functionName: "totalMinted",
    query: { enabled: !!minersContract && !!address, refetchInterval: LIVE },
  });
  const pages = total.data ? Number((total.data + PAGE - 1n) / PAGE) : 0;
  const reads = useReadContracts({
    contracts: Array.from(
      { length: pages },
      (_, p) =>
        ({
          ...minersContract!,
          functionName: "minersOf",
          args: [address!, BigInt(p) * PAGE + 1n, BigInt(p + 1) * PAGE],
        }) as const,
    ),
    query: { enabled: pages > 0 && !!address, refetchInterval: LIVE },
  });
  const miners = useMemo<MyMiner[] | undefined>(() => {
    if (!address) return undefined;
    if (total.data === 0n) return [];
    if (!reads.data) return undefined;
    return reads.data.flatMap((r) => {
      if (r.status !== "success") return [];
      const [ids, infos] = r.result;
      return ids.map((id, i) => ({
        id,
        tier: infos[i].tier,
        vein: infos[i].vein,
        hashrate: infos[i].hashrate,
        arrivesAt: infos[i].arrivesAt,
        pending: infos[i].pending,
      }));
    });
  }, [address, total.data, reads.data]);
  return {
    miners,
    isLoading: total.isLoading || reads.isLoading,
    isError: total.isError || reads.isError,
    refetch: () => Promise.all([total.refetch(), reads.refetch()]),
  };
}

/** Rewards the wallet left behind in each vein (moves, transfers). */
export function useOwed(veinCount: number) {
  const { address } = useAccount();
  const r = useReadContracts({
    contracts: Array.from(
      { length: veinCount },
      (_, v) => ({ ...minersContract!, functionName: "owed", args: [address!, v] }) as const,
    ),
    query: { enabled: !!address && veinCount > 0, refetchInterval: LIVE },
  });
  const owed = useMemo(() => r.data?.map((x) => (x.status === "success" ? x.result : 0n)), [r.data]);
  return { owed, refetch: r.refetch };
}

/** Mint state shared by the mint window. */
export function useMintState() {
  const r = useReadContracts({
    contracts: [
      { ...minersContract!, functionName: "mintPaused" },
      { ...minersContract!, functionName: "totalMinted" },
      { ...minersContract!, functionName: "sunsetAt" },
    ],
    query: { enabled: !!minersContract, refetchInterval: LIVE },
  });
  const [paused, minted, sunsetAt] = r.data ?? [];
  return {
    paused: paused?.status === "success" ? paused.result : undefined,
    minted: minted?.status === "success" ? minted.result : undefined,
    sunsetAt: sunsetAt?.status === "success" ? sunsetAt.result : undefined,
    refetch: r.refetch,
  };
}
