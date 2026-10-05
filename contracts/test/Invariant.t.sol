// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {OrmineMiners, IVeinFunder} from "../src/OrmineMiners.sol";
import {VeinFunder, IOrmineVeins, ISwapRouter02, IPriceFeed} from "../src/VeinFunder.sol";
import {MockStock, MockFeed, MockRouter} from "./mocks/MockStock.sol";

/// Drives random player, keeper and owner actions; tracks what went into and out of every vein.
contract Handler is Test {
    OrmineMiners internal m;
    VeinFunder internal f;
    MockStock[2] internal tokens;
    MockFeed internal ethFeed;
    MockFeed[2] internal feeds;
    address internal owner;
    address[3] internal actors = [address(0xA11CE), address(0xB0B), address(0xCA401)];

    mapping(uint8 => uint256) public deposited;
    mapping(uint8 => uint256) public paid;
    uint256 public sunsetBegun;
    uint256 public ethIn; // every mint and upgrade payment
    uint256 public ethToVeins; // their VEIN_SHARE_BPS parts
    uint256 public ethConverted; // spent by the keeper on swaps

    constructor(
        OrmineMiners m_,
        VeinFunder f_,
        MockStock[2] memory tokens_,
        MockFeed ethFeed_,
        MockFeed[2] memory feeds_,
        address owner_
    ) {
        (m, f, tokens, ethFeed, feeds, owner) = (m_, f_, tokens_, ethFeed_, feeds_, owner_);
        for (uint256 i; i < 3; ++i) {
            vm.deal(actors[i], 10_000 ether);
        }
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % 3];
    }

    function _token(uint256 seed) internal view returns (uint256 id, bool ok) {
        uint256 n = m.totalMinted();
        if (n == 0) return (0, false);
        return (seed % n + 1, true);
    }

    function mint(uint256 who, uint8 vein, uint256 qty) external {
        vein = vein % 2;
        qty = bound(qty, 1, 10);
        if (m.totalMinted() + qty > 300 || m.sunsetAt() != 0 && block.timestamp >= m.sunsetAt()) return;
        _pay(0.02 ether * qty);
        vm.prank(_actor(who));
        m.mint{value: 0.02 ether * qty}(vein, qty);
    }

    function _pay(uint256 value) internal {
        ethIn += value;
        ethToVeins += value * 7_000 / 10_000;
    }

    function deposit(uint8 vein, uint256 amount) external {
        vein = vein % 2;
        amount = bound(amount, 1, 1e24);
        tokens[vein].mint(address(this), amount);
        tokens[vein].approve(address(m), amount);
        m.deposit(vein, amount);
        deposited[vein] += amount;
    }

    function move(uint256 seed, uint8 vein) external {
        (uint256 id, bool ok) = _token(seed);
        if (!ok) return;
        vein = vein % 2;
        OrmineMiners.MinerView memory info = m.minerInfo(id);
        if (info.vein == vein || info.arrivesAt != 0) return;
        uint256 s = m.sunsetAt();
        uint256 arrival = (block.timestamp + 1 days + 599) / 600 * 600;
        if (s != 0 && block.timestamp < s && arrival > s) return;
        vm.prank(info.owner);
        m.move(id, vein);
    }

    function upgrade(uint256 seed) external {
        (uint256 id, bool ok) = _token(seed);
        if (!ok) return;
        uint8 tier = m.minerInfo(id).tier;
        if (tier == 4) return;
        if (m.sunsetAt() != 0 && block.timestamp >= m.sunsetAt()) return;
        uint256[5] memory hash = [uint256(0), 10, 25, 60, 150];
        uint256 price = 0.002 ether * (hash[tier + 1] - hash[tier]);
        _pay(price);
        vm.prank(m.ownerOf(id));
        m.upgrade{value: price}(id);
    }

    function transfer(uint256 seed, uint256 to) external {
        (uint256 id, bool ok) = _token(seed);
        if (!ok) return;
        address from = m.ownerOf(id);
        vm.prank(from);
        m.transferFrom(from, _actor(to), id);
    }

    function claim(uint256 who, uint8 vein) external {
        vein = vein % 2;
        address a = _actor(who);
        uint256 n = m.totalMinted();
        uint256 count;
        uint256[] memory ids = new uint256[](n);
        uint256 expected = m.owed(a, vein);
        for (uint256 id = 1; id <= n; ++id) {
            if (m.ownerOf(id) == a && m.minerInfo(id).vein == vein) {
                ids[count++] = id;
                expected += m.pending(id);
            }
        }
        if (expected == 0) return;
        assembly {
            mstore(ids, count)
        }
        uint256 before = tokens[vein].balanceOf(a);
        vm.prank(a);
        m.claim(vein, ids);
        uint256 got = tokens[vein].balanceOf(a) - before;
        assertEq(got, expected, "claim pays exactly what pending + owed showed");
        paid[vein] += got;
    }

    function convert(uint8 vein, uint256 amount) external {
        vein = vein % 2;
        amount = bound(amount, 1, 2 ether);
        if (amount > f.ethPending(vein)) return;
        ethFeed.set(272_280_000_000);
        feeds[vein].set(23_521_000_000);
        uint256 before = tokens[vein].balanceOf(address(m));
        vm.prank(f.keeper());
        f.convert(vein, amount, 0, block.timestamp);
        ethConverted += amount;
        deposited[vein] += tokens[vein].balanceOf(address(m)) - before;
    }

    function warp(uint256 dt) external {
        vm.warp(block.timestamp + bound(dt, 1, 3 days));
    }

    function sunset() external {
        if (sunsetBegun != 0 || block.timestamp < 1_700_000_000 + 20 days) return;
        sunsetBegun = block.timestamp;
        vm.prank(owner);
        m.beginSunset();
    }
}

contract InvariantTest is Test {
    OrmineMiners internal m;
    VeinFunder internal f;
    Handler internal h;
    MockStock[2] internal tokens;
    address internal owner = makeAddr("owner");

    function setUp() public {
        vm.warp(1_700_000_000);
        tokens = [new MockStock("NVDA", 18), new MockStock("TSLA", 18)];
        MockFeed ethFeed = new MockFeed(8, 272_280_000_000);
        MockFeed[2] memory feeds = [new MockFeed(8, 23_521_000_000), new MockFeed(8, 23_521_000_000)];
        MockRouter router = new MockRouter();
        router.setRate(address(tokens[0]), 11.5e18);
        router.setRate(address(tokens[1]), 11.5e18);

        address predicted = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        f = new VeinFunder(
            owner, IOrmineVeins(predicted), ISwapRouter02(address(router)), IPriceFeed(address(ethFeed)), address(0)
        );
        m = new OrmineMiners(owner, makeAddr("treasury"), IVeinFunder(address(f)), "");
        h = new Handler(m, f, tokens, ethFeed, feeds, owner);
        vm.startPrank(owner);
        m.addVein(IERC20(address(tokens[0])), "NVDA");
        m.addVein(IERC20(address(tokens[1])), "TSLA");
        m.setMintPaused(false);
        f.setRoute(0, 500, IPriceFeed(address(feeds[0])));
        f.setRoute(1, 3000, IPriceFeed(address(feeds[1])));
        f.setKeeper(makeAddr("keeper"));
        vm.stopPrank();
        targetContract(address(h));
    }

    /// Everything that went into a vein is still in it, waiting for claims, or was paid out. Nothing else.
    function invariant_veinConservation() public view {
        for (uint8 v; v < 2; ++v) {
            OrmineMiners.VeinView memory info = m.veinInfo(v);
            assertEq(info.balance + info.reserved + h.paid(v), h.deposited(v));
            assertEq(tokens[v].balanceOf(address(m)), info.balance + info.reserved);
        }
    }

    /// Miners can never be owed more than the vein set aside for them.
    function invariant_claimsCovered() public view {
        uint256[2] memory owedSum;
        uint256[2] memory hashSum;
        uint256[2] memory digging;
        for (uint256 id = 1; id <= m.totalMinted(); ++id) {
            OrmineMiners.MinerView memory info = m.minerInfo(id);
            owedSum[info.vein] += info.pending;
            hashSum[info.vein] += info.hashrate;
            if (info.arrivesAt == 0) digging[info.vein] += 1;
        }
        address[3] memory actors = [address(0xA11CE), address(0xB0B), address(0xCA401)];
        for (uint8 v; v < 2; ++v) {
            for (uint256 i; i < 3; ++i) {
                owedSum[v] += m.owed(actors[i], v);
            }
            OrmineMiners.VeinView memory info = m.veinInfo(v);
            assertLe(owedSum[v], info.reserved);
            assertEq(info.totalHash + info.inTransitHash, hashSum[v]);
            assertEq(info.miners, digging[v], "miner count matches the miners digging there");
        }
    }

    /// The funder's ETH is exactly what veins are waiting for.
    function invariant_funderEth() public view {
        assertEq(address(f).balance, f.ethPending(0) + f.ethPending(1));
    }

    /// Every mint and upgrade payment is split 70/30 between the veins and the treasury; the miners contract keeps none.
    function invariant_ethSplit() public view {
        assertEq(address(m).balance, 0);
        assertEq(address(f).balance + h.ethConverted(), h.ethToVeins());
        assertEq(m.treasury().balance, h.ethIn() - h.ethToVeins());
    }
}
