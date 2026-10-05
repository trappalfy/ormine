// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {OrmineMiners} from "../src/OrmineMiners.sol";
import {MockStock} from "../test/mocks/MockStock.sol";

/// Local / testnet only: fills every vein with 100 mock shares and opens minting.
/// The broadcaster must own OrmineMiners. env: MINERS.
contract Seed is Script {
    function run() external {
        require(block.chainid != 4663, "mocks only");
        OrmineMiners m = OrmineMiners(vm.envAddress("MINERS"));
        vm.startBroadcast();
        (, address me,) = vm.readCallers();
        for (uint8 v; v < m.veinCount(); ++v) {
            MockStock token = MockStock(m.veinInfo(v).token);
            token.mint(me, 100e18);
            token.approve(address(m), 100e18);
            m.deposit(v, 100e18);
        }
        m.setMintPaused(false);
        vm.stopBroadcast();
    }
}
