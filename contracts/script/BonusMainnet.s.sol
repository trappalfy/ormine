// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {OrmineMiners} from "../src/OrmineMiners.sol";
import {VeinFunder, ISwapRouter02, IPriceFeed} from "../src/VeinFunder.sol";
import {MainnetConfig} from "./MainnetConfig.sol";
import {IQuoterV2} from "./SeedMainnet.s.sol";

/// One-off bonus on mainnet: buys each vein's stock with the broadcaster's ETH and sends it straight to the owners
/// of the miners digging in that vein at this moment, split by hashrate. A vein releases only 1% of its balance a
/// day, so a payout meant to land at once goes around the veins. Miners still on the way get nothing; the
/// broadcaster's own miners leave their share in its wallet.
/// Swaps are priced like SeedMainnet: refused more than 1.5% under Chainlink, and only what the swap is guaranteed
/// to return (0.5% under the live quote) is shared out; anything above that stays with the broadcaster.
/// env: BONUS_USD = dollars per vein; BONUS_USD_NVDA / BONUS_USD_TSLA / BONUS_USD_AAPL override one vein (0 skips it).
/// Without --broadcast it only prints the split.
contract BonusMainnet is Script, MainnetConfig {
    using SafeERC20 for IERC20;

    uint256 internal constant ORACLE_FLOOR_BPS = 9_850;
    uint256 internal constant SLIPPAGE_BPS = 50;

    // Per vein: owner => position + 1 in that vein's recipient list.
    mapping(uint8 => mapping(address => uint256)) private _slot;

    function run() external {
        require(block.chainid == 4663, "mainnet only");
        string memory dep = vm.readFile("deployments/4663.json");
        OrmineMiners m = OrmineMiners(vm.parseJsonAddress(dep, ".miners"));
        VeinFunder f = VeinFunder(payable(vm.parseJsonAddress(dep, ".veinFunder")));
        VeinConfig[3] memory veins = mainnetVeins();
        uint256 each = vm.envOr("BONUS_USD", uint256(0));

        uint256 n = m.totalMinted();
        OrmineMiners.MinerView[] memory miners = new OrmineMiners.MinerView[](n);
        for (uint256 i; i < n; ++i) {
            miners[i] = m.minerInfo(i + 1);
        }
        console.log("snapshot at unix time", block.timestamp, "miners minted:", n);

        for (uint8 v; v < veins.length; ++v) {
            VeinConfig memory c = veins[v];
            uint256 usd = vm.envOr(string.concat("BONUS_USD_", c.ticker), each);
            if (usd == 0) continue;
            require(m.veinInfo(v).token == c.token, "vein token mismatch");

            (address[] memory owners, uint256[] memory hashes, uint256 total) = _diggers(miners, v);
            require(total == m.veinInfo(v).totalHash, string.concat(c.ticker, ": snapshot disagrees with the vein's hashrate"));
            if (total == 0) {
                console.log(c.ticker, "nobody digging, skipped");
                continue;
            }

            uint256 ethIn = _usdToWei(f.ethFeed(), usd);
            uint256 fair = f.fairOut(v, ethIn);
            (uint256 quoted,,,) = IQuoterV2(QUOTER_V2).quoteExactInputSingle(
                IQuoterV2.QuoteExactInputSingleParams(WETH, c.token, ethIn, c.poolFee, 0)
            );
            require(quoted * 10_000 >= fair * ORACLE_FLOOR_BPS, string.concat(c.ticker, ": pool price too far under Chainlink"));
            uint256 amount = quoted * (10_000 - SLIPPAGE_BPS) / 10_000;

            console.log(c.ticker, "USD:", usd);
            console.log(c.ticker, "ETH in (wei):", ethIn);
            console.log(c.ticker, "shared out (1e18 = 1 share):", amount);
            console.log(c.ticker, "hashrate digging:", total);
            console.log(c.ticker, "owners:", owners.length);

            vm.startBroadcast();
            (, address me,) = vm.readCallers();
            ISwapRouter02(ROUTER).exactInputSingle{value: ethIn}(
                ISwapRouter02.ExactInputSingleParams(WETH, c.token, c.poolFee, me, ethIn, amount, 0)
            );
            for (uint256 i; i < owners.length; ++i) {
                uint256 share = amount * hashes[i] / total;
                console.log(owners[i], hashes[i], share);
                if (share == 0 || owners[i] == me) continue;
                IERC20(c.token).safeTransfer(owners[i], share);
            }
            vm.stopBroadcast();
        }
    }

    /// Owners of the miners digging in `vein` now, with their summed hashrate.
    function _diggers(OrmineMiners.MinerView[] memory miners, uint8 vein)
        private
        returns (address[] memory owners, uint256[] memory hashes, uint256 total)
    {
        owners = new address[](miners.length);
        hashes = new uint256[](miners.length);
        uint256 count;
        for (uint256 i; i < miners.length; ++i) {
            OrmineMiners.MinerView memory mi = miners[i];
            if (mi.vein != vein || mi.arrivesAt != 0) continue;
            uint256 slot = _slot[vein][mi.owner];
            if (slot == 0) {
                owners[count] = mi.owner;
                slot = _slot[vein][mi.owner] = ++count;
            }
            hashes[slot - 1] += mi.hashrate;
            total += mi.hashrate;
        }
        assembly ("memory-safe") {
            mstore(owners, count)
            mstore(hashes, count)
        }
    }

    function _usdToWei(IPriceFeed feed, uint256 usd) private view returns (uint256) {
        (, int256 price,, uint256 updatedAt,) = feed.latestRoundData();
        require(price > 0 && block.timestamp - updatedAt < 1 days, "ETH/USD feed stale");
        return usd * 10 ** (18 + uint256(feed.decimals())) / uint256(price);
    }
}
