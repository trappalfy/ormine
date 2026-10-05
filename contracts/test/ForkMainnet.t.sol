// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {OrmineMiners, IVeinFunder} from "../src/OrmineMiners.sol";
import {VeinFunder, IOrmineVeins, ISwapRouter02, IPriceFeed} from "../src/VeinFunder.sol";
import {MainnetConfig} from "../script/MainnetConfig.sol";

interface IUniV3Factory {
    function getPool(address a, address b, uint24 fee) external view returns (address);
}

/// Runs only with FORK_MAINNET=1: swaps real ETH for real stock tokens on a local fork of Robinhood Chain.
contract ForkMainnetTest is Test, MainnetConfig {
    OrmineMiners internal m;
    VeinFunder internal f;
    address internal owner = makeAddr("owner");
    address internal keeper = makeAddr("keeper");
    address internal alice = makeAddr("alice");

    function setUp() public {
        if (!vm.envOr("FORK_MAINNET", false)) vm.skip(true);
        vm.createSelectFork(vm.envOr("ROBINHOOD_RPC_URL", string("https://rpc.mainnet.chain.robinhood.com")));
        address predicted = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        f = new VeinFunder(owner, IOrmineVeins(predicted), ISwapRouter02(ROUTER), IPriceFeed(ETH_USD), keeper);
        m = new OrmineMiners(owner, makeAddr("treasury"), IVeinFunder(address(f)), "");
        VeinConfig[3] memory veins = mainnetVeins();
        vm.startPrank(owner);
        for (uint256 i; i < veins.length; ++i) {
            m.addVein(IERC20(veins[i].token), veins[i].ticker);
            f.setRoute(uint8(i), veins[i].poolFee, IPriceFeed(veins[i].feed));
        }
        m.setMintPaused(false);
        vm.stopPrank();
        vm.deal(alice, 100 ether);
    }

    function test_fork_poolsExist() public view {
        VeinConfig[3] memory veins = mainnetVeins();
        for (uint256 i; i < veins.length; ++i) {
            address pool = IUniV3Factory(UNI_V3_FACTORY).getPool(WETH, veins[i].token, veins[i].poolFee);
            assertTrue(pool != address(0), veins[i].ticker);
            console.log(veins[i].ticker, pool, IERC20(WETH).balanceOf(pool));
        }
    }

    function test_fork_mintConvertClaim() public {
        VeinConfig[3] memory veins = mainnetVeins();
        for (uint8 v; v < 3; ++v) {
            vm.prank(alice);
            m.mint{value: 0.2 ether}(v, 10);
            if (v == 0) {
                vm.prank(alice);
                m.upgrade{value: 0.03 ether}(1);
            }
            uint256 pending = f.ethPending(v);
            uint256 paidIn = v == 0 ? 0.23 ether : 0.2 ether;
            assertEq(pending, paidIn * 7_000 / 10_000);
            uint256 fair = f.fairOut(v, pending);
            vm.prank(keeper);
            uint256 out = f.convert(v, pending, 0, block.timestamp);
            console.log(veins[v].ticker, "fair", fair);
            console.log(veins[v].ticker, "got ", out);
            assertGe(out, fair * 9_850 / 10_000);
            assertEq(m.veinInfo(v).balance, out);
        }
        vm.warp(block.timestamp + 2 days);
        uint256[] memory ids = new uint256[](10);
        for (uint256 i; i < 10; ++i) {
            ids[i] = i + 1;
        }
        uint256 due;
        for (uint256 i; i < 10; ++i) {
            due += m.pending(ids[i]);
        }
        assertGt(due, 0);
        vm.prank(alice);
        m.claim(0, ids);
        assertEq(IERC20(veins[0].token).balanceOf(alice), due);
    }
}
