import type { Address } from "viem";
import { deployments } from "./generated.ts";

export type Deployment = {
  miners: Address;
  veinFunder: Address;
  startBlock: number;
};

// Written by scripts/export-abi.mjs from contracts/deployments/<chainId>.json.
export const DEPLOYMENTS = deployments as unknown as Partial<Record<number, Deployment>>;

export const deploymentFor = (chainId: number | undefined) => (chainId === undefined ? undefined : DEPLOYMENTS[chainId]);
