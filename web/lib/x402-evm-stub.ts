// Stand-in for @x402/evm, which @coinbase/cdp-sdk imports statically but Ormine never calls (see next.config.ts).
export function toClientEvmSigner(): never {
  throw new Error("x402 payments are not available in Ormine");
}
