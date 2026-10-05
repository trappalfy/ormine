"use client";

import { useCallback, useState } from "react";
import type { Abi, ContractFunctionArgs, ContractFunctionName, Hash } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { txError } from "@/lib/errors";

export type TxState =
  | { phase: "idle" }
  | { phase: "signing"; label: string }
  | { phase: "pending"; label: string; hash: Hash }
  | { phase: "done"; label: string; hash: Hash }
  | { phase: "failed"; label: string; hash?: Hash; error: string };

type Request<abi extends Abi, fn extends ContractFunctionName<abi, "nonpayable" | "payable">> = {
  address: `0x${string}`;
  abi: abi;
  functionName: fn;
  args: ContractFunctionArgs<abi, "nonpayable" | "payable", fn>;
  value?: bigint;
};

/** Simulate → sign → wait, with a state the TxDialog renders. Simulating first gives readable revert reasons. */
export function useTx() {
  const { address } = useAccount();
  const client = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [state, setState] = useState<TxState>({ phase: "idle" });

  const run = useCallback(
    async <abi extends Abi, fn extends ContractFunctionName<abi, "nonpayable" | "payable">>(
      label: string,
      req: Request<abi, fn>,
    ): Promise<boolean> => {
      if (!client || !address) return false;
      setState({ phase: "signing", label });
      let hash: Hash | undefined;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- viem's generics don't survive this wrapper
        const { request } = await client.simulateContract({ ...(req as any), account: address });
        hash = await writeContractAsync(request);
        setState({ phase: "pending", label, hash });
        const receipt = await client.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new Error("reverted");
        setState({ phase: "done", label, hash });
        return true;
      } catch (e) {
        const error = e instanceof Error && e.message === "reverted" ? "The transaction was reverted." : txError(e);
        setState({ phase: "failed", label, hash, error });
        return false;
      }
    },
    [client, address, writeContractAsync],
  );

  const reset = useCallback(() => setState({ phase: "idle" }), []);
  return { state, run, reset, busy: state.phase === "signing" || state.phase === "pending" };
}
