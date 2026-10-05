// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {stdStorage, StdStorage} from "forge-std/Test.sol";
import {VmSafe} from "forge-std/Vm.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {OrmineMiners, IVeinFunder} from "../src/OrmineMiners.sol";
import {Base} from "./Base.sol";
import {FeeStock} from "./mocks/MockStock.sol";

contract MintReentrant is IERC721Receiver {
    OrmineMiners internal immutable m;

    constructor(OrmineMiners m_) {
        m = m_;
    }

    function go() external payable {
        m.mint{value: msg.value}(0, 1);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external returns (bytes4) {
        m.mint{value: 0.02 ether}(0, 1);
        return this.onERC721Received.selector;
    }

    receive() external payable {}
}

contract OrmineMinersTest is Base {
    using stdStorage for StdStorage;

    // ------------------------------------------------------------ mint

    function test_mint_splitsPayment() public {
        uint256 id = _mint(alice, NVDA, 3);
        assertEq(id, 1);
        assertEq(m.ownerOf(3), alice);
        assertEq(funder.ethPending(NVDA), 0.042 ether);
        assertEq(treasury.balance, 0.018 ether);
        assertEq(address(m).balance, 0);
        OrmineMiners.MinerView memory info = m.minerInfo(2);
        assertEq(info.tier, 1);
        assertEq(info.vein, NVDA);
        assertEq(info.hashrate, 10);
        assertEq(m.veinInfo(NVDA).totalHash, 30);
    }

    function test_mint_rejects() public {
        vm.startPrank(alice);
        vm.expectRevert(OrmineMiners.WrongPayment.selector);
        m.mint{value: 0.01 ether}(NVDA, 1);
        vm.expectRevert(OrmineMiners.BadQuantity.selector);
        m.mint{value: 0}(NVDA, 0);
        vm.expectRevert(OrmineMiners.BadQuantity.selector);
        m.mint{value: 0.22 ether}(NVDA, 11);
        vm.expectRevert(OrmineMiners.UnknownVein.selector);
        m.mint{value: 0.02 ether}(7, 1);
        vm.stopPrank();

        vm.prank(owner);
        m.setMintPaused(true);
        vm.prank(alice);
        vm.expectRevert(OrmineMiners.MintClosed.selector);
        m.mint{value: 0.02 ether}(NVDA, 1);
    }

    function test_mint_soldOut() public {
        stdstore.target(address(m)).sig("totalMinted()").checked_write(uint256(9_995));
        vm.prank(alice);
        vm.expectRevert(OrmineMiners.SoldOut.selector);
        m.mint{value: 0.12 ether}(NVDA, 6);
        _mint(alice, NVDA, 5);
        assertEq(m.ownerOf(10_000), alice);
    }

    function test_mint_startsPaused() public {
        OrmineMiners fresh = new OrmineMiners(owner, treasury, IVeinFunder(address(funder)), "");
        assertTrue(fresh.mintPaused());
    }

    function test_mint_reentryThroughReceiverFails() public {
        MintReentrant attacker = new MintReentrant(m);
        vm.deal(address(attacker), 1 ether);
        vm.expectRevert();
        attacker.go{value: 0.02 ether}();
    }

    // ------------------------------------------------------------ releases

    function test_release_firstEpochEmptyThenOnePercent() public {
        _mint(alice, NVDA, 1);
        _deposit(NVDA, 100 * E);
        vm.warp(T0 + 1 days);
        assertEq(m.pending(1), 0, "deposit counts from the next epoch");
        vm.warp(T0 + 1 days + 12 hours);
        assertEq(m.pending(1), E / 2);
        vm.warp(T0 + 2 days);
        assertEq(m.pending(1), E);
        assertEq(m.veinInfo(NVDA).balance, 99 * E);
        assertEq(m.veinInfo(NVDA).epochRelease, E);
    }

    function test_release_splitByHashrate() public {
        _mint(alice, NVDA, 3);
        _mint(bob, NVDA, 1);
        _deposit(NVDA, 100 * E);
        vm.warp(T0 + 2 days);
        assertEq(m.pending(1) + m.pending(2) + m.pending(3), 0.75e18);
        assertEq(m.pending(4), 0.25e18);
        assertEq(_claim(alice, NVDA, _ids(1, 2)) + _claim(alice, NVDA, _ids(3)), 0.75e18);
        assertEq(_claim(bob, NVDA, _ids(4)), 0.25e18);
    }

    function test_release_midEpochDepositWaitsForNextEpoch() public {
        _mint(alice, NVDA, 1);
        _deposit(NVDA, 100 * E);
        vm.warp(T0 + 1 days + 12 hours);
        _deposit(NVDA, 900 * E);
        vm.warp(T0 + 2 days);
        assertEq(m.pending(1), E);
        vm.warp(T0 + 3 days);
        assertEq(m.pending(1), E + 9.99e18);
    }

    function test_release_noHashKeepsBalance() public {
        _deposit(NVDA, 100 * E);
        vm.warp(T0 + 30 days);
        assertEq(m.veinInfo(NVDA).balance, 100 * E);
        assertEq(m.veinInfo(NVDA).reserved, 0);
    }

    function test_release_longIdleMatchesStepwiseMath() public {
        _mint(alice, NVDA, 1);
        _deposit(NVDA, 1_000 * E);
        uint256 epochs = 3 * 365;
        vm.warp(T0 + epochs * 1 days);
        uint256 gasBefore = gasleft();
        m.poke(NVDA);
        uint256 used = gasBefore - gasleft();
        if (!vm.isContext(VmSafe.ForgeContext.Coverage)) assertLt(used, 1_500_000, "three idle years stay cheap");

        uint256 bal = 1_000 * E;
        for (uint256 i = 1; i < epochs; ++i) {
            bal -= bal * 100 / 10_000;
        }
        assertEq(m.veinInfo(NVDA).balance, bal);
        assertEq(m.pending(1), 1_000 * E - bal);
    }

    // ------------------------------------------------------------ move

    function test_move_travelsThenDigs() public {
        _mint(alice, NVDA, 1);
        _mint(bob, TSLA, 1);
        _deposit(NVDA, 100 * E);
        _deposit(TSLA, 100 * E);
        vm.warp(T0 + 1 days);

        vm.prank(alice);
        m.move(1, TSLA);
        uint256 arrivesAt = (T0 + 2 days + 599) / 600 * 600;
        assertEq(m.minerInfo(1).arrivesAt, arrivesAt);
        assertEq(m.veinInfo(NVDA).totalHash, 0);
        assertEq(m.veinInfo(TSLA).totalHash, 10);
        assertEq(m.veinInfo(TSLA).inTransitHash, 10);
        assertEq(m.owed(alice, NVDA), 0, "nothing was released in epoch 0");

        vm.warp(arrivesAt - 1);
        assertEq(m.pending(1), 0, "no digging on the way");
        assertEq(m.veinInfo(TSLA).totalHash, 10);

        vm.warp(T0 + 3 days);
        assertEq(m.veinInfo(TSLA).totalHash, 20);
        assertEq(m.veinInfo(TSLA).inTransitHash, 0);
        assertEq(m.veinInfo(TSLA).miners, 2);
        assertEq(m.veinInfo(NVDA).miners, 0);
        // TSLA epoch 2 releases 0.99 TSLA; alice shares it 50/50 from arrival on.
        uint256 afterArrival = 0.99e18 * (T0 + 3 days - arrivesAt) / 1 days;
        assertApproxEqAbs(m.pending(1), afterArrival / 2, 2);
        assertApproxEqAbs(m.pending(2), 1e18 + 0.99e18 - afterArrival / 2, 2);
        uint256 due = m.pending(1);
        assertEq(_claim(alice, TSLA, _ids(1)), due);
    }

    function test_move_keepsOldVeinEarningsAsOwed() public {
        _mint(alice, NVDA, 1);
        _deposit(NVDA, 100 * E);
        vm.warp(T0 + 2 days);
        vm.prank(alice);
        m.move(1, TSLA);
        assertEq(m.owed(alice, NVDA), E);
        assertEq(m.pending(1), 0);
        assertEq(_claim(alice, NVDA, new uint256[](0)), E);
    }

    function test_move_rejects() public {
        _mint(alice, NVDA, 1);
        vm.startPrank(alice);
        vm.expectRevert(OrmineMiners.SameVein.selector);
        m.move(1, NVDA);
        m.move(1, TSLA);
        vm.expectRevert(OrmineMiners.StillTravelling.selector);
        m.move(1, NVDA);
        vm.stopPrank();
        vm.prank(bob);
        vm.expectRevert(OrmineMiners.NotMinerOwner.selector);
        m.move(1, NVDA);

        vm.prank(owner);
        m.closeVein(NVDA);
        vm.warp(T0 + 2 days);
        vm.prank(alice);
        vm.expectRevert(OrmineMiners.VeinIsClosed.selector);
        m.move(1, NVDA);
    }

    function test_move_manyArrivalsInOneVein() public {
        for (uint256 i; i < 30; ++i) {
            _mint(alice, NVDA, 1);
        }
        for (uint256 i = 1; i <= 30; ++i) {
            vm.warp(T0 + i * 47 minutes);
            vm.prank(alice);
            m.move(i, TSLA);
        }
        vm.warp(T0 + 30 * 47 minutes + 1 days + 600);
        assertEq(m.veinInfo(TSLA).totalHash, 300);
        assertEq(m.veinInfo(TSLA).inTransitHash, 0);
        m.poke(TSLA);
        assertEq(m.veinInfo(TSLA).totalHash, 300);
    }

    // ------------------------------------------------------------ upgrade

    function test_upgrade_closedWhilePausedAndExactPrice() public {
        _mint(alice, NVDA, 1);
        vm.prank(owner);
        m.setMintPaused(true);
        vm.prank(alice);
        vm.expectRevert(OrmineMiners.UpgradesClosed.selector);
        m.upgrade{value: 0.03 ether}(1);
        vm.prank(owner);
        m.setMintPaused(false);
        vm.startPrank(alice);
        vm.expectRevert(OrmineMiners.WrongPayment.selector);
        m.upgrade{value: 0.02 ether}(1);
        vm.expectRevert(OrmineMiners.WrongPayment.selector);
        m.upgrade(1);
        vm.stopPrank();
        vm.prank(bob);
        vm.expectRevert(OrmineMiners.NotMinerOwner.selector);
        m.upgrade{value: 0.03 ether}(1);
    }

    function test_upgrade_paysEthLikeAMintAndRaisesHash() public {
        _mint(alice, NVDA, 1);
        uint256 fundedBefore = funder.ethPending(NVDA);
        uint256 treasuryBefore = treasury.balance;
        // 15 + 35 + 90 hash at 0.002 ETH = 0.03 + 0.07 + 0.18 ETH
        uint256[3] memory prices = [uint256(0.03 ether), 0.07 ether, 0.18 ether];
        uint256[3] memory hashes = [uint256(25), 60, 150];
        uint256 total;
        for (uint256 i; i < 3; ++i) {
            assertEq(_upgradePrice(1), prices[i]);
            vm.expectEmit(address(m));
            emit OrmineMiners.Upgraded(1, uint8(i + 1), uint8(i + 2), prices[i]);
            _upgrade(alice, 1);
            total += prices[i];
            assertEq(m.minerInfo(1).hashrate, hashes[i]);
            assertEq(m.veinInfo(NVDA).totalHash, hashes[i]);
        }
        assertEq(funder.ethPending(NVDA) - fundedBefore, total * 7_000 / 10_000);
        assertEq(treasury.balance - treasuryBefore, total * 3_000 / 10_000);
        assertEq(address(m).balance, 0);
        vm.prank(alice);
        vm.expectRevert(OrmineMiners.MaxTier.selector);
        m.upgrade{value: 0.18 ether}(1);
    }

    function test_upgrade_settlesAtOldHashFirst() public {
        _mint(alice, NVDA, 1);
        _mint(bob, NVDA, 1);
        _deposit(NVDA, 100 * E);
        vm.warp(T0 + 1 days + 12 hours);
        _upgrade(alice, 1);
        vm.warp(T0 + 2 days);
        // First half: 0.5 split 10/20. Second half: 0.5 split 25/35.
        assertApproxEqAbs(m.pending(1), 0.25e18 + uint256(0.5e18) * 25 / 35, 2);
        assertApproxEqAbs(m.pending(2), 0.25e18 + uint256(0.5e18) * 10 / 35, 2);
    }

    function test_upgrade_whileTravellingCountsOnArrivalAndFundsNewVein() public {
        _mint(alice, NVDA, 1);
        vm.prank(alice);
        m.move(1, TSLA);
        vm.warp(T0 + 12 hours);
        uint256 nvdaBefore = funder.ethPending(NVDA);
        _upgrade(alice, 1);
        assertEq(funder.ethPending(TSLA), 0.021 ether);
        assertEq(funder.ethPending(NVDA), nvdaBefore);
        assertEq(m.veinInfo(TSLA).totalHash, 0);
        assertEq(m.veinInfo(TSLA).inTransitHash, 25);
        vm.warp(T0 + 2 days);
        assertEq(m.veinInfo(TSLA).totalHash, 25);
    }

    function test_upgrade_failsIfTreasuryRejectsEth() public {
        _mint(alice, NVDA, 1);
        vm.prank(owner);
        m.setTreasury(address(nvda)); // a contract with no receive()
        vm.prank(alice);
        vm.expectRevert(OrmineMiners.EthTransferFailed.selector);
        m.upgrade{value: 0.03 ether}(1);
    }

    // ------------------------------------------------------------ claim and transfer

    function test_claim_rejects() public {
        _mint(alice, NVDA, 1);
        _mint(bob, TSLA, 1);
        vm.startPrank(alice);
        vm.expectRevert(OrmineMiners.NothingToClaim.selector);
        m.claim(NVDA, _ids(1));
        vm.expectRevert(OrmineMiners.NotMinerOwner.selector);
        m.claim(TSLA, _ids(2));
        vm.expectRevert(OrmineMiners.WrongVein.selector);
        m.claim(TSLA, _ids(1));
        vm.stopPrank();
    }

    function test_claim_pausedTokenWaits() public {
        _mint(alice, NVDA, 1);
        _deposit(NVDA, 100 * E);
        vm.warp(T0 + 2 days);
        nvda.setPaused(true);
        vm.prank(alice);
        vm.expectRevert("paused");
        m.claim(NVDA, _ids(1));
        // Other veins are not affected.
        _mint(bob, TSLA, 1);
        vm.warp(T0 + 3 days);
        nvda.setPaused(false);
        assertEq(_claim(alice, NVDA, _ids(1)), E + 0.99e18);
    }

    function test_transfer_previousOwnerKeepsEarnings() public {
        _mint(alice, NVDA, 1);
        _deposit(NVDA, 100 * E);
        vm.warp(T0 + 2 days);
        vm.prank(alice);
        m.transferFrom(alice, bob, 1);
        assertEq(m.owed(alice, NVDA), E);
        assertEq(m.pending(1), 0);
        vm.warp(T0 + 3 days);
        assertEq(_claim(bob, NVDA, _ids(1)), 0.99e18);
        assertEq(_claim(alice, NVDA, new uint256[](0)), E);
    }

    function test_transfer_worksForBlockedOwner() public {
        _mint(alice, NVDA, 1);
        _deposit(NVDA, 100 * E);
        vm.warp(T0 + 2 days);
        nvda.setBlocked(alice, true);
        vm.prank(alice);
        m.transferFrom(alice, bob, 1);
        vm.prank(alice);
        vm.expectRevert("blocked");
        m.claim(NVDA, new uint256[](0));
        assertEq(m.owed(alice, NVDA), E);
    }

    // ------------------------------------------------------------ deposit

    function test_deposit_countsWhatArrived() public {
        FeeStock fee = new FeeStock();
        vm.prank(owner);
        uint8 v = m.addVein(IERC20(address(fee)), "FEE");
        fee.mint(address(this), 100 * E);
        fee.approve(address(m), 100 * E);
        m.deposit(v, 100 * E);
        assertEq(m.veinInfo(v).balance, 99 * E);
        vm.expectRevert(OrmineMiners.NothingDeposited.selector);
        m.deposit(v, 0);
    }

    // ------------------------------------------------------------ sunset

    function test_sunset_timelockAndCancel() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        m.beginSunset();
        vm.startPrank(owner);
        m.beginSunset();
        assertEq(m.sunsetAt(), T0 + 7 days);
        vm.expectRevert(OrmineMiners.SunsetState.selector);
        m.beginSunset();
        vm.warp(T0 + 6 days);
        m.cancelSunset();
        assertEq(m.sunsetAt(), 0);
        m.beginSunset();
        vm.warp(T0 + 13 days);
        vm.expectRevert(OrmineMiners.SunsetState.selector);
        m.cancelSunset();
        vm.stopPrank();
        vm.prank(alice);
        vm.expectRevert(OrmineMiners.MintClosed.selector);
        m.mint{value: 0.02 ether}(NVDA, 1);
    }

    function test_sunset_finalReleaseAndEmptyVeinKeepsFlowing() public {
        _mint(alice, NVDA, 1);
        _mint(bob, NVDA, 1);
        _deposit(NVDA, 100 * E);
        _deposit(TSLA, 50 * E);
        vm.prank(owner);
        m.beginSunset();

        vm.warp(T0 + 7 days + 1);
        OrmineMiners.VeinView memory n = m.veinInfo(NVDA);
        assertLe(n.balance, 1, "everything released at the sunset");
        assertApproxEqAbs(m.pending(1) + m.pending(2), 100 * E, 2);
        assertEq(m.veinInfo(TSLA).balance, 50 * E, "nobody in TSLA: nothing released");

        // Decision 1А: after the sunset miners may still move and the empty vein pays as usual.
        vm.prank(bob);
        m.move(2, TSLA);
        vm.warp(T0 + 10 days);
        assertGt(m.pending(2), 0);
        assertApproxEqAbs(_claim(alice, NVDA, _ids(1)), 50 * E, 2);
    }

    function test_sunset_noTripsAcrossIt() public {
        _mint(alice, NVDA, 2);
        vm.prank(owner);
        m.beginSunset();
        vm.warp(T0 + 6 days + 1 hours);
        vm.prank(alice);
        vm.expectRevert(OrmineMiners.TooCloseToSunset.selector);
        m.move(1, TSLA);
        vm.warp(T0 + 5 days);
        vm.prank(alice);
        m.move(2, TSLA);
    }

    function test_sunset_upgradesClose() public {
        _mint(alice, NVDA, 1);
        vm.prank(owner);
        m.beginSunset();
        vm.warp(T0 + 7 days);
        vm.prank(alice);
        vm.expectRevert(OrmineMiners.UpgradesClosed.selector);
        m.upgrade{value: 0.03 ether}(1);
    }

    // ------------------------------------------------------------ owner

    function test_owner_limits() public {
        vm.startPrank(owner);
        vm.expectRevert(OrmineMiners.RenounceDisabled.selector);
        m.renounceOwnership();
        vm.expectRevert(OrmineMiners.RoyaltyTooHigh.selector);
        m.setRoyalty(treasury, 1_001);
        vm.expectRevert(OrmineMiners.BadAddress.selector);
        m.addVein(IERC20(address(nvda)), "NVDA2");
        vm.stopPrank();
        (address r, uint256 amt) = m.royaltyInfo(1, 1 ether);
        assertEq(r, treasury);
        assertEq(amt, 0.05 ether);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        m.closeVein(NVDA);
    }

    function test_closedVeinKeepsPaying() public {
        _mint(alice, NVDA, 1);
        _deposit(NVDA, 100 * E);
        vm.prank(owner);
        m.closeVein(NVDA);
        vm.prank(bob);
        vm.expectRevert(OrmineMiners.VeinIsClosed.selector);
        m.mint{value: 0.02 ether}(NVDA, 1);
        vm.warp(T0 + 2 days);
        assertEq(_claim(alice, NVDA, _ids(1)), E);
    }

    function test_minersOf() public {
        _mint(alice, NVDA, 2);
        _mint(bob, TSLA, 1);
        _mint(alice, TSLA, 1);
        (uint256[] memory ids, OrmineMiners.MinerView[] memory infos) = m.minersOf(alice, 1, 100);
        assertEq(ids.length, 3);
        assertEq(ids[2], 4);
        assertEq(infos[2].vein, TSLA);
        (ids,) = m.minersOf(alice, 2, 3);
        assertEq(ids.length, 1);
        (ids,) = m.minersOf(carol, 1, 4);
        assertEq(ids.length, 0);
    }

    function test_tokenURI() public {
        _mint(alice, TSLA, 1);
        string memory json = string.concat(
            '{"name":"Ormine Miner #1","description":"An Ormine miner. It digs tokenized stocks on Robinhood Chain.",',
            '"image":"https://ormine.test/nft/digger.png","attributes":[{"trait_type":"Tier","value":1},',
            '{"trait_type":"Name","value":"Digger"},{"trait_type":"Hashrate","value":10},',
            '{"trait_type":"Vein","value":"TSLA"}]}'
        );
        assertEq(m.tokenURI(1), string.concat("data:application/json;base64,", Base64.encode(bytes(json))));
        assertTrue(m.supportsInterface(0x49064906));
        assertTrue(m.supportsInterface(0x2a55205a));
    }

    // ------------------------------------------------------------ edges

    function test_constructor_rejectsZeroAddresses() public {
        vm.expectRevert(OrmineMiners.BadAddress.selector);
        new OrmineMiners(owner, address(0), IVeinFunder(address(funder)), "");
        vm.expectRevert(OrmineMiners.BadAddress.selector);
        new OrmineMiners(owner, treasury, IVeinFunder(address(0)), "");
    }

    function test_mint_treasuryMustAcceptEth() public {
        vm.prank(owner);
        m.setTreasury(address(nvda)); // a contract without receive()
        vm.prank(alice);
        vm.expectRevert(OrmineMiners.EthTransferFailed.selector);
        m.mint{value: 0.02 ether}(NVDA, 1);
    }

    function test_owner_settersAndEvents() public {
        vm.startPrank(owner);
        vm.expectRevert(OrmineMiners.BadAddress.selector);
        m.setTreasury(address(0));
        m.setTreasury(carol);
        assertEq(m.treasury(), carol);
        m.setRoyalty(carol, 250);
        vm.expectEmit(address(m));
        emit OrmineMiners.BatchMetadataUpdate(1, type(uint256).max);
        m.setImageBase("ipfs://cid/");
        assertEq(m.imageBase(), "ipfs://cid/");
        vm.expectRevert(OrmineMiners.BadAddress.selector);
        m.addVein(IERC20(address(0)), "ZERO");
        vm.stopPrank();
        (address r, uint256 amt) = m.royaltyInfo(1, 1 ether);
        assertEq(r, carol);
        assertEq(amt, 0.025 ether);
        assertEq(m.hashrateOf(3), 60);
        assertEq(m.hashrateOf(0), 0);
    }

    function test_owner_veinLimit() public {
        vm.startPrank(owner);
        for (uint256 i = 2; i < 255; ++i) {
            m.addVein(IERC20(address(uint160(0x1000 + i))), "X");
        }
        assertEq(m.veinCount(), 255);
        vm.expectRevert(OrmineMiners.TooManyVeins.selector);
        m.addVein(IERC20(address(0xBEEF)), "X");
        vm.stopPrank();
    }

    function test_tokenURI_followsUpgrades() public {
        _mint(alice, NVDA, 1);
        string[3] memory names = ["Miner", "Driller", "Rig"];
        string[3] memory hashes = ["25", "60", "150"];
        for (uint256 i; i < 3; ++i) {
            vm.expectEmit(address(m));
            emit OrmineMiners.MetadataUpdate(1);
            _upgrade(alice, 1);
            string memory json = string.concat(
                '{"name":"Ormine Miner #1","description":"An Ormine miner. It digs tokenized stocks on Robinhood Chain.",',
                '"image":"https://ormine.test/nft/',
                _lower(names[i]),
                '.png","attributes":[{"trait_type":"Tier","value":',
                vm.toString(i + 2),
                '},{"trait_type":"Name","value":"',
                names[i],
                '"},{"trait_type":"Hashrate","value":',
                hashes[i],
                '},{"trait_type":"Vein","value":"NVDA"}]}'
            );
            assertEq(m.tokenURI(1), string.concat("data:application/json;base64,", Base64.encode(bytes(json))));
        }
    }

    function test_sunset_dumpWithEmptyBalance() public {
        _mint(alice, NVDA, 1);
        vm.prank(owner);
        m.beginSunset();
        vm.warp(T0 + 8 days);
        m.poke(NVDA);
        assertEq(m.veinInfo(NVDA).balance, 0);
        assertEq(m.pending(1), 0);
    }

    function test_pending_arrivedButNotSettled() public {
        _mint(alice, NVDA, 1);
        _mint(bob, TSLA, 1);
        _deposit(TSLA, 100 * E);
        vm.prank(alice);
        m.move(1, TSLA);
        // Sync TSLA after the arrival so the bucket is stored, then read pending from storage.
        vm.warp(T0 + 1 days + 600);
        m.poke(TSLA);
        vm.warp(T0 + 2 days);
        uint256 viewed = m.pending(1);
        assertGt(viewed, 0);
        assertEq(_claim(alice, TSLA, _ids(1)), viewed);
    }

    function _lower(string memory x) internal pure returns (string memory) {
        bytes memory b = bytes.concat(bytes(x)); // a copy: bytes(x) would alias the caller's string
        if (b[0] >= "A" && b[0] <= "Z") b[0] = bytes1(uint8(b[0]) + 32);
        return string(b);
    }
}
