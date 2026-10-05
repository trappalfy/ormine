// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {OrmineMiners, IVeinFunder} from "../src/OrmineMiners.sol";
import {MockStock, MockFunder} from "./mocks/MockStock.sol";

abstract contract Base is Test {
    uint256 internal constant E = 1e18;
    uint256 internal constant T0 = 1_700_000_000;
    uint8 internal constant NVDA = 0;
    uint8 internal constant TSLA = 1;

    OrmineMiners internal m;
    MockFunder internal funder;
    MockStock internal nvda;
    MockStock internal tsla;

    address internal owner = makeAddr("owner");
    address internal treasury = makeAddr("treasury");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    function setUp() public virtual {
        vm.warp(T0);
        funder = new MockFunder();
        m = new OrmineMiners(owner, treasury, IVeinFunder(address(funder)), "https://ormine.test/nft/");
        nvda = new MockStock("NVDA", 18);
        tsla = new MockStock("TSLA", 18);
        vm.startPrank(owner);
        m.addVein(IERC20(address(nvda)), "NVDA");
        m.addVein(IERC20(address(tsla)), "TSLA");
        m.setMintPaused(false);
        vm.stopPrank();
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(carol, 100 ether);
    }

    function _mint(address who, uint8 vein, uint256 qty) internal returns (uint256 first) {
        first = m.totalMinted() + 1;
        uint256 price = m.MINT_PRICE() * qty;
        vm.prank(who);
        m.mint{value: price}(vein, qty);
    }

    function _deposit(uint8 vein, uint256 amount) internal {
        MockStock t = vein == NVDA ? nvda : tsla;
        t.mint(address(this), amount);
        t.approve(address(m), amount);
        m.deposit(vein, amount);
    }

    function _ids(uint256 a) internal pure returns (uint256[] memory ids) {
        ids = new uint256[](1);
        ids[0] = a;
    }

    function _ids(uint256 a, uint256 b) internal pure returns (uint256[] memory ids) {
        ids = new uint256[](2);
        ids[0] = a;
        ids[1] = b;
    }

    function _claim(address who, uint8 vein, uint256[] memory ids) internal returns (uint256 got) {
        IERC20 t = vein == NVDA ? IERC20(address(nvda)) : IERC20(address(tsla));
        uint256 before = t.balanceOf(who);
        vm.prank(who);
        m.claim(vein, ids);
        got = t.balanceOf(who) - before;
    }

    /// ETH price of the next upgrade of `id`: UPGRADE_PRICE_PER_HASH for every hash gained.
    function _upgradePrice(uint256 id) internal view returns (uint256) {
        uint256[5] memory hash = [uint256(0), 10, 25, 60, 150];
        uint8 tier = m.minerInfo(id).tier;
        return m.UPGRADE_PRICE_PER_HASH() * (hash[tier + 1] - hash[tier]);
    }

    function _upgrade(address who, uint256 id) internal {
        uint256 price = _upgradePrice(id);
        vm.prank(who);
        m.upgrade{value: price}(id);
    }
}
