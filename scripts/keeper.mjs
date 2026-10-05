// Keeper: swaps each vein's waiting ETH for its stock through VeinFunder.convert.
// The contract enforces the real safety (oracle floor 1.5%, 2 ETH per call); this script adds a tighter
// floor from a live Uniswap quote and only converts when enough ETH is waiting.
//
//   KEEPER_KEY=0x... CHAIN_ID=4663 node scripts/keeper.mjs            # one pass
//   KEEPER_KEY=0x... CHAIN_ID=4663 LOOP_MINUTES=60 node scripts/keeper.mjs
//
// Optional: RPC_URL, MIN_ETH (default 0.05), SLIPPAGE_BPS vs. the live quote (default 50).
// ABIs and addresses come from packages/shared/src/generated.ts (`pnpm abi`), so no contract build is needed.
import { createPublicClient, createWalletClient, formatEther, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as chains from "viem/chains";
import { deployments, ormineMinersAbi as minersAbi, veinFunderAbi as funderAbi } from "../packages/shared/src/generated.ts";

const chainId = Number(process.env.CHAIN_ID ?? 4663);
const chain = { 4663: chains.robinhood, 46630: chains.robinhoodTestnet, 31337: chains.anvil }[chainId];
const transport = http(process.env.RPC_URL || chain.rpcUrls.default.http[0]);
const dep = deployments[chainId];
if (!dep) throw new Error(`no deployment for chain ${chainId} in generated.ts`);
const quoterAbi = [
  {
    type: "function",
    name: "quoteExactInputSingle",
    stateMutability: "nonpayable",
    inputs: [{ type: "tuple", components: [
      { name: "tokenIn", type: "address" }, { name: "tokenOut", type: "address" }, { name: "amountIn", type: "uint256" },
      { name: "fee", type: "uint24" }, { name: "sqrtPriceLimitX96", type: "uint160" }] }],
    outputs: [{ type: "uint256" }, { type: "uint160" }, { type: "uint32" }, { type: "uint256" }],
  },
];
const QUOTER = chainId === 4663 ? "0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7" : undefined;
const MAX = parseEther("2");
const MIN = parseEther(process.env.MIN_ETH ?? "0.05");
const SLIP = BigInt(process.env.SLIPPAGE_BPS ?? 50);

// Wallet exports often drop the 0x prefix, and pasted secrets can carry a trailing newline.
const rawKey = (process.env.KEEPER_KEY ?? "").trim();
const account = privateKeyToAccount(rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`);
const pub = createPublicClient({ chain, transport });
const wallet = createWalletClient({ chain, transport, account });

async function pass() {
  const count = await pub.readContract({ address: dep.miners, abi: minersAbi, functionName: "veinCount" });
  const weth = await pub.readContract({ address: dep.veinFunder, abi: funderAbi, functionName: "weth" });
  for (let v = 0; v < count; v++) {
    const waiting = await pub.readContract({ address: dep.veinFunder, abi: funderAbi, functionName: "ethPending", args: [v] });
    if (waiting < MIN) {
      console.log(`vein ${v}: ${formatEther(waiting)} ETH waiting, below ${formatEther(MIN)}`);
      continue;
    }
    const ethIn = waiting > MAX ? MAX : waiting;
    const info = await pub.readContract({ address: dep.miners, abi: minersAbi, functionName: "veinInfo", args: [v] });
    let minOut = 0n;
    if (QUOTER) {
      // Route is (poolFee, stockFeed).
      const [fee] = await pub.readContract({ address: dep.veinFunder, abi: funderAbi, functionName: "routes", args: [v] });
      const { result } = await pub.simulateContract({
        address: QUOTER, abi: quoterAbi, functionName: "quoteExactInputSingle",
        args: [{ tokenIn: weth, tokenOut: info.token, amountIn: ethIn, fee, sqrtPriceLimitX96: 0n }],
      });
      minOut = (result[0] * (10_000n - SLIP)) / 10_000n;
    }
    try {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
      const { request } = await pub.simulateContract({
        account, address: dep.veinFunder, abi: funderAbi, functionName: "convert", args: [v, ethIn, minOut, deadline],
      });
      const hash = await wallet.writeContract(request);
      const r = await pub.waitForTransactionReceipt({ hash });
      console.log(`${info.ticker}: converted ${formatEther(ethIn)} ETH (${r.status}) ${hash}`);
    } catch (e) {
      console.log(`${info.ticker}: skipped, ${e.shortMessage ?? e.message}`);
    }
  }
}

await pass();
const loop = Number(process.env.LOOP_MINUTES ?? 0);
if (loop > 0) setInterval(() => pass().catch((e) => console.error(e)), loop * 60_000);
