// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {OrmineMiners, IVeinFunder} from "../src/OrmineMiners.sol";
import {VeinFunder, IOrmineVeins, ISwapRouter02, IPriceFeed} from "../src/VeinFunder.sol";
import {MockStock, MockFeed, MockRouter} from "../test/mocks/MockStock.sol";
import {MainnetConfig} from "./MainnetConfig.sol";

/// Deploys VeinFunder + OrmineMiners, adds the launch veins and routes, then hands ownership to OWNER.
/// On any chain other than mainnet (4663) it deploys mock stocks, feeds and a router instead of the real ones.
///
/// env: OWNER (Safe; must call acceptOwnership on both contracts), TREASURY, KEEPER, IMAGE_BASE.
/// Mint stays paused; the owner unpauses after seeding the veins.
contract Deploy is Script, MainnetConfig {
    function run() external {
        address owner = vm.envAddress("OWNER");
        address treasury = vm.envAddress("TREASURY");
        address keeper = vm.envAddress("KEEPER");
        string memory imageBase = vm.envString("IMAGE_BASE");

        vm.startBroadcast();
        (, address deployer,) = vm.readCallers();

        address router = ROUTER;
        address ethFeed = ETH_USD;
        VeinConfig[3] memory veins = mainnetVeins();
        if (block.chainid != 4663) (router, ethFeed, veins) = _mocks(veins);

        address predicted = vm.computeCreateAddress(deployer, vm.getNonce(deployer) + 1);
        VeinFunder funder = new VeinFunder(
            deployer, IOrmineVeins(predicted), ISwapRouter02(router), IPriceFeed(ethFeed), keeper
        );
        OrmineMiners miners = new OrmineMiners(deployer, treasury, IVeinFunder(address(funder)), imageBase);
        require(address(miners) == predicted, "address prediction");

        for (uint256 i; i < veins.length; ++i) {
            miners.addVein(IERC20(veins[i].token), veins[i].ticker);
            funder.setRoute(uint8(i), veins[i].poolFee, IPriceFeed(veins[i].feed));
        }
        if (owner != deployer) {
            miners.transferOwnership(owner);
            funder.transferOwnership(owner);
        }
        vm.stopBroadcast();

        console.log("chainId", block.chainid);
        console.log("OrmineMiners", address(miners));
        console.log("VeinFunder", address(funder));
        string memory json = "deployment";
        vm.serializeUint(json, "chainId", block.chainid);
        vm.serializeUint(json, "startBlock", block.number);
        vm.serializeAddress(json, "veinFunder", address(funder));
        string memory out = vm.serializeAddress(json, "miners", address(miners));
        vm.writeJson(out, string.concat("deployments/", vm.toString(block.chainid), ".json"));
    }

    /// Test stand-ins with the same decimals and live-like prices. The router pays 0.3% under the oracle rate.
    function _mocks(VeinConfig[3] memory veins)
        internal
        returns (address router, address ethFeed, VeinConfig[3] memory out)
    {
        MockRouter r = new MockRouter();
        MockFeed eth = new MockFeed(8, 272_280_000_000);
        eth.setUpdatedAt(type(uint256).max);
        ethFeed = address(eth);
        int256[3] memory usd = [int256(23_521_000_000), int256(26_500_000_000), int256(23_800_000_000)];
        for (uint256 i; i < 3; ++i) {
            MockStock token = new MockStock(veins[i].ticker, 18);
            MockFeed feed = new MockFeed(8, usd[i]);
            feed.setUpdatedAt(type(uint256).max);
            out[i] = VeinConfig(address(token), veins[i].ticker, veins[i].poolFee, address(feed));
            r.setRate(address(token), uint256(272_280_000_000) * 1e18 / uint256(usd[i]) * 997 / 1000);
        }
        router = address(r);
    }
}
