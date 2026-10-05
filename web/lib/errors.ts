import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from "viem";

const MESSAGES: Record<string, string> = {
  MintClosed: "Minting is closed right now.",
  SoldOut: "All miners are minted.",
  WrongPayment: "The ETH amount doesn't match the price.",
  BadQuantity: "Pick between 1 and the per-transaction limit.",
  VeinIsClosed: "This vein is closed to new miners.",
  UnknownVein: "That vein doesn't exist.",
  SameVein: "The miner is already in that vein.",
  StillTravelling: "The miner is still on the way.",
  TooCloseToSunset: "The mine closes before this trip would end.",
  UpgradesClosed: "Upgrades are closed right now.",
  MaxTier: "This miner is already a Rig.",
  NothingToClaim: "Nothing to claim in this vein yet.",
  NotMinerOwner: "You don't own this miner.",
  WrongVein: "That miner works in another vein.",
};

/** A short, human message for a failed simulation, signature or transaction. */
export function txError(e: unknown): string {
  if (e instanceof BaseError) {
    if (e.walk((x) => x instanceof UserRejectedRequestError)) return "You cancelled the signature.";
    const revert = e.walk((x) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
    const name = revert?.data?.errorName;
    if (name && MESSAGES[name]) return MESSAGES[name];
    if (revert?.reason) return revert.reason;
    if (/insufficient funds/i.test(e.message)) return "Not enough ETH to pay for this and the gas.";
    return e.shortMessage;
  }
  return "Something went wrong. Try again.";
}
