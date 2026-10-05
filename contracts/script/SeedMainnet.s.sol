// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {OrmineMiners} from "../src/OrmineMiners.sol";
import {VeinFunder, ISwapRouter02} from "../src/VeinFunder.sol";
import {MainnetConfig} from "./MainnetConfig.sol";

interface IQuoterV2 {
    struct QuoteExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint24 fee;
        uint160 sqrtPriceLimitX96;
    }

    function quoteExactInputSingle(QuoteExactInputSingleParams memory params)
        external
        returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate);
}

/// Starting pool on mainnet: buys each vein's stock with the broadcaster's ETH on Uniswap and deposits it.
/// Refuses a swap more than 1.5% under the Chainlink price, like the keeper's swaps. Up to 0.5% below the live
/// quote stays in the broadcaster's wallet as slippage room. A deposit counts from the vein's next day.
/// env: SEED_WEI = ETH per vein in wei; SEED_WEI_NVDA / SEED_WEI_TSLA / SEED_WEI_AAPL override one vein (0 skips it).
contract SeedMainnet is Script, MainnetConfig {
    uint256 internal constant ORACLE_FLOOR_BPS = 9_850;
    uint256 internal constant SLIPPAGE_BPS = 50;

    function run() external {
        require(block.chainid == 4663, "mainnet only");
        string memory dep = vm.readFile("deployments/4663.json");
        OrmineMiners m = OrmineMiners(vm.parseJsonAddress(dep, ".miners"));
        VeinFunder f = VeinFunder(payable(vm.parseJsonAddress(dep, ".veinFunder")));
        VeinConfig[3] memory veins = mainnetVeins();
        uint256 each = vm.envOr("SEED_WEI", uint256(0));

        for (uint8 v; v < veins.length; ++v) {
            VeinConfig memory c = veins[v];
            uint256 ethIn = vm.envOr(string.concat("SEED_WEI_", c.ticker), each);
            if (ethIn == 0) continue;
            require(m.veinInfo(v).token == c.token, "vein token mismatch");

            // Priced before broadcasting: the live quote, checked against Chainlink.
            uint256 fair = f.fairOut(v, ethIn);
            (uint256 quoted,,,) = IQuoterV2(QUOTER_V2).quoteExactInputSingle(
                IQuoterV2.QuoteExactInputSingleParams(WETH, c.token, ethIn, c.poolFee, 0)
            );
            require(quoted * 10_000 >= fair * ORACLE_FLOOR_BPS, string.concat(c.ticker, ": pool price too far under Chainlink"));
            uint256 amount = quoted * (10_000 - SLIPPAGE_BPS) / 10_000;

            vm.startBroadcast();
            (, address me,) = vm.readCallers();
            ISwapRouter02(ROUTER).exactInputSingle{value: ethIn}(
                ISwapRouter02.ExactInputSingleParams(WETH, c.token, c.poolFee, me, ethIn, amount, 0)
            );
            IERC20(c.token).approve(address(m), amount);
            m.deposit(v, amount);
            vm.stopBroadcast();

            uint256 next = m.veinInfo(v).epochStart;
            while (next <= block.timestamp) next += m.EPOCH();
            console.log(c.ticker, "ETH in (wei):", ethIn);
            console.log(c.ticker, "deposited (1e18 = 1 share):", amount);
            console.log(c.ticker, "starts paying out at unix time", next);
        }
    }
}
