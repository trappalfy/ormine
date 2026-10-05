#!/usr/bin/env bash
# Deploys mock-backed contracts to a running anvil (`pnpm chain`), seeds the veins and exports the ABI.
# Uses anvil's public test account #0; never use this key anywhere else.
set -euo pipefail
cd "$(dirname "$0")/../contracts"
export PATH="$HOME/.foundry/bin:$PATH"
KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
ME=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
RPC=http://127.0.0.1:8545
OWNER=$ME TREASURY=$ME KEEPER=$ME IMAGE_BASE=http://localhost:3000/nft/ \
  forge script script/Deploy.s.sol --rpc-url $RPC --broadcast --private-key $KEY -q
MINERS=$(node -e "console.log(require('./deployments/31337.json').miners)")
MINERS=$MINERS forge script script/Seed.s.sol --rpc-url $RPC --broadcast --private-key $KEY -q
node ../scripts/export-abi.mjs
echo "Local deployment ready: OrmineMiners $MINERS"
