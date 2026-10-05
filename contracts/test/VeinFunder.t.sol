// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {OrmineMiners, IVeinFunder} from "../src/OrmineMiners.sol";
import {VeinFunder, IOrmineVeins, ISwapRouter02, IPriceFeed} from "../src/VeinFunder.sol";
import {MockStock, MockFeed, MockRouter} from "./mocks/MockStock.sol";

contract VeinFunderTest is Test {
    uint8 internal constant NVDA = 0;
    OrmineMiners internal m;
    VeinFunder internal f;
    MockStock internal nvda;
    MockFeed internal ethFeed;
    MockFeed internal nvdaFeed;
    MockRouter internal router;

    address internal owner = makeAddr("owner");
    address internal treasury = makeAddr("treasury");
    address internal keeper = makeAddr("keeper");
    address internal alice = makeAddr("alice");

    // 1 ETH = 2722.80 USD, 1 NVDA = 235.21 USD -> 11.5760 NVDA per ETH at oracle prices.
    uint256 internal constant FAIR = 11_576_038_433_740_062_072;

    function setUp() public {
        vm.warp(1_700_000_000);
        nvda = new MockStock("NVDA", 18);
        ethFeed = new MockFeed(8, 272_280_000_000);
        nvdaFeed = new MockFeed(8, 23_521_000_000);
        router = new MockRouter();
        address predicted = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        f = new VeinFunder(
            owner, IOrmineVeins(predicted), ISwapRouter02(address(router)), IPriceFeed(address(ethFeed)), keeper
        );
        m = new OrmineMiners(owner, treasury, IVeinFunder(address(f)), "");
        assertEq(address(m), predicted);
        vm.startPrank(owner);
        m.addVein(IERC20(address(nvda)), "NVDA");
        m.setMintPaused(false);
        f.setRoute(NVDA, 500, IPriceFeed(address(nvdaFeed)));
        vm.stopPrank();
        vm.deal(alice, 1_000 ether);
        // 100 mints = 1.4 ETH pending for NVDA
        for (uint256 i; i < 10; ++i) {
            vm.prank(alice);
            m.mint{value: 0.2 ether}(NVDA, 10);
        }
    }

    function test_fund_onlyFromMiners() public {
        assertEq(f.ethPending(NVDA), 1.4 ether);
        assertEq(address(f).balance, 1.4 ether);
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(VeinFunder.OnlyMiners.selector);
        f.fund{value: 1 ether}(NVDA);
    }

    function test_fairOut() public view {
        assertApproxEqRel(f.fairOut(NVDA, 1 ether), FAIR, 1e12);
    }

    function test_convert_depositsIntoVein() public {
        router.setRate(address(nvda), FAIR * 9_975 / 10_000); // 0.25% worse than the oracle, like the live pool
        vm.prank(keeper);
        uint256 out = f.convert(NVDA, 1 ether, 0, block.timestamp);
        assertEq(out, FAIR * 9_975 / 10_000);
        assertEq(f.ethPending(NVDA), 0.4 ether);
        assertEq(address(f).balance, 0.4 ether);
        assertEq(m.veinInfo(NVDA).balance, out);
        assertEq(nvda.balanceOf(address(m)), out);
    }

    function test_convert_refusesBadRate() public {
        router.setRate(address(nvda), FAIR * 9_800 / 10_000); // 2% worse: below the 1.5% floor
        vm.prank(keeper);
        vm.expectRevert("Too little received");
        f.convert(NVDA, 1 ether, 0, block.timestamp);
        // The keeper can only make the floor stricter.
        router.setRate(address(nvda), FAIR);
        vm.prank(keeper);
        vm.expectRevert("Too little received");
        f.convert(NVDA, 1 ether, FAIR + 1, block.timestamp);
    }

    function test_convert_guards() public {
        router.setRate(address(nvda), FAIR);
        vm.expectRevert(VeinFunder.OnlyKeeper.selector);
        f.convert(NVDA, 1 ether, 0, block.timestamp);
        vm.startPrank(keeper);
        vm.expectRevert(VeinFunder.Expired.selector);
        f.convert(NVDA, 1 ether, 0, block.timestamp - 1);
        vm.expectRevert(VeinFunder.BadAmount.selector);
        f.convert(NVDA, 1.5 ether, 0, block.timestamp);
        vm.expectRevert(VeinFunder.BadAmount.selector);
        f.convert(NVDA, 0, 0, block.timestamp);
        vm.stopPrank();
        vm.expectRevert(VeinFunder.NoRoute.selector);
        f.fairOut(1, 0.1 ether);
    }

    function test_convert_maxPerCall() public {
        vm.deal(alice, 1_000 ether);
        for (uint256 i; i < 20; ++i) {
            vm.prank(alice);
            m.mint{value: 0.2 ether}(NVDA, 10);
        }
        router.setRate(address(nvda), FAIR);
        vm.prank(keeper);
        vm.expectRevert(VeinFunder.BadAmount.selector);
        f.convert(NVDA, 2 ether + 1, 0, block.timestamp);
        vm.prank(keeper);
        f.convert(NVDA, 2 ether, 0, block.timestamp);
    }

    function test_convert_stalePriceOrCorporateAction() public {
        router.setRate(address(nvda), FAIR);
        vm.warp(block.timestamp + 27 hours);
        vm.prank(keeper);
        vm.expectRevert(VeinFunder.StalePrice.selector);
        f.convert(NVDA, 1 ether, 0, block.timestamp);
        ethFeed.set(272_280_000_000);
        nvdaFeed.set(23_521_000_000);
        nvda.setOraclePaused(true);
        vm.prank(keeper);
        vm.expectRevert(VeinFunder.PricePaused.selector);
        f.convert(NVDA, 1 ether, 0, block.timestamp);
    }

    function test_owner_cannotTakeEth() public {
        vm.startPrank(owner);
        f.setKeeper(owner);
        vm.stopPrank();
        router.setRate(address(nvda), FAIR);
        // Even as keeper, the owner can only turn the ETH into NVDA inside the vein.
        vm.prank(owner);
        uint256 out = f.convert(NVDA, 1 ether, 0, block.timestamp);
        assertEq(m.veinInfo(NVDA).balance, out);
        assertEq(owner.balance, 0);
        vm.prank(owner);
        vm.expectRevert(VeinFunder.BadAddress.selector);
        f.renounceOwnership();
    }

    function test_constructor_rejectsZeroAddresses() public {
        vm.expectRevert(VeinFunder.BadAddress.selector);
        new VeinFunder(owner, IOrmineVeins(address(0)), ISwapRouter02(address(router)), IPriceFeed(address(ethFeed)), keeper);
        vm.expectRevert(VeinFunder.BadAddress.selector);
        new VeinFunder(owner, IOrmineVeins(address(m)), ISwapRouter02(address(router)), IPriceFeed(address(0)), keeper);
    }

    function test_convert_needsRoute() public {
        MockStock tsla = new MockStock("TSLA", 18);
        vm.startPrank(owner);
        m.addVein(IERC20(address(tsla)), "TSLA");
        vm.expectRevert(VeinFunder.BadAddress.selector);
        f.setRoute(1, 3000, IPriceFeed(address(0)));
        vm.stopPrank();
        vm.prank(alice);
        m.mint{value: 0.02 ether}(1, 1);
        vm.prank(keeper);
        vm.expectRevert(VeinFunder.NoRoute.selector);
        f.convert(1, 0.014 ether, 0, block.timestamp);
    }

    function test_fairOut_rejectsBadPrice() public {
        nvdaFeed.set(0);
        vm.expectRevert(VeinFunder.StalePrice.selector);
        f.fairOut(NVDA, 1 ether);
        nvdaFeed.set(-1);
        vm.expectRevert(VeinFunder.StalePrice.selector);
        f.fairOut(NVDA, 1 ether);
    }

    function test_fairOut_otherDecimals() public {
        MockStock six = new MockStock("SIX", 6);
        MockFeed feed18 = new MockFeed(18, 235.21e18);
        vm.startPrank(owner);
        m.addVein(IERC20(address(six)), "SIX");
        f.setRoute(1, 500, IPriceFeed(address(feed18)));
        vm.stopPrank();
        // 1 ETH at 2722.80 / 235.21 = 11.576038 tokens with 6 decimals
        assertEq(f.fairOut(1, 1 ether), 11_576_038);
    }
}
