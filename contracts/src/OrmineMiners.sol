// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

interface IVeinFunder {
    function fund(uint8 vein) external payable;
}

/// @title Ormine miners
/// @notice NFT miners that dig tokenized stocks out of per-stock veins (ORMINE_TECH_SPEC.md, sections 4, 6, 7).
///         Each vein releases RELEASE_BPS of its balance per epoch, split between the miners digging there by
///         hashrate. Nothing in this contract can send a vein's tokens anywhere except to the miners that earned them.
contract OrmineMiners is ERC721, ERC2981, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeCast for uint256;
    using Strings for uint256;

    // Economics are fixed at deploy. Mirrored in packages/shared/src/constants.ts (a test keeps them in sync).
    uint256 public constant MINT_PRICE = 0.02 ether;
    /// @dev Upgrades cost this much ETH for every hash the miner gains, the same rate as a mint (0.02 ETH, 10 H).
    uint256 public constant UPGRADE_PRICE_PER_HASH = 0.002 ether;
    uint256 public constant MAX_SUPPLY = 10_000;
    uint256 public constant MAX_PER_TX = 10;
    uint256 public constant VEIN_SHARE_BPS = 7_000;
    uint256 public constant RELEASE_BPS = 100;
    uint256 public constant EPOCH = 1 days;
    uint256 public constant TRAVEL = 1 days;
    uint256 public constant SUNSET_DELAY = 7 days;
    uint96 public constant ROYALTY_BPS = 500;
    uint96 public constant MAX_ROYALTY_BPS = 1_000;

    /// @dev Arrivals are grouped into buckets of this length, so catching a vein up scans at most
    ///      TRAVEL / BUCKET + 1 buckets however many miners are on the way.
    uint256 public constant BUCKET = 10 minutes;
    uint256 private constant MAX_SCAN = TRAVEL / BUCKET + 2;
    uint256 private constant ACC = 1e27;

    struct Vein {
        IERC20 token;
        bool closed;
        uint64 lastUpdate;
        uint64 epochStart;
        uint64 totalHash; // digging now
        uint64 inTransitHash; // on the way here
        uint32 miners; // digging now
        uint32 inTransitMiners; // on the way here
        uint128 balance; // still in the vein
        uint128 epochRelease; // released over the current epoch
        uint128 releasedInEpoch; // part of epochRelease whose time has passed
        uint128 reserved; // released to miners, not yet claimed
        uint256 acc; // released per unit of hash, scaled by ACC
    }

    struct Miner {
        uint8 tier;
        uint8 vein;
        uint64 arrivalBucket; // non-zero while travelling or arrived but not yet settled
        uint128 accrued; // settled and unclaimed, paid in `vein`
        uint256 snap; // vein.acc at the last settle
    }

    struct VeinView {
        address token;
        string ticker;
        bool closed;
        uint256 balance;
        uint256 epochStart;
        uint256 epochRelease;
        uint256 totalHash;
        uint256 inTransitHash;
        uint256 miners;
        uint256 reserved;
    }

    struct MinerView {
        address owner;
        uint8 tier;
        uint8 vein;
        uint256 hashrate;
        uint256 arrivesAt; // 0 when digging
        uint256 pending;
    }

    IVeinFunder public immutable funder;

    uint8 public veinCount;
    bool public mintPaused = true;
    address public treasury;
    uint256 public totalMinted;
    uint256 public sunsetAt;
    string public imageBase;

    mapping(uint8 => Vein) private _veins;
    mapping(uint8 => string) public veinTicker;
    mapping(address => bool) private _veinToken;
    mapping(uint8 => mapping(uint256 => uint256)) public arrivalHash; // vein => bucket => hash arriving
    mapping(uint8 => mapping(uint256 => uint256)) private _arrivalCount; // vein => bucket => miners arriving
    mapping(uint8 => mapping(uint256 => uint256)) private _bucketAcc; // vein => bucket => acc on arrival
    mapping(uint256 => Miner) private _miners;
    mapping(address => mapping(uint8 => uint256)) public owed; // rewards left behind by moves and transfers

    event Minted(address indexed owner, uint256 indexed tokenId, uint8 indexed vein);
    event Upgraded(uint256 indexed tokenId, uint8 fromTier, uint8 toTier, uint256 paid);
    event Moved(uint256 indexed tokenId, uint8 fromVein, uint8 toVein, uint256 arrivesAt);
    event Claimed(address indexed owner, uint8 indexed vein, uint256 amount);
    event Deposited(uint8 indexed vein, address indexed from, uint256 amount);
    event VeinAdded(uint8 indexed vein, address token, string ticker);
    event VeinClosed(uint8 indexed vein);
    event TreasurySet(address treasury);
    event MintPausedSet(bool paused);
    event ImageBaseSet(string imageBase);
    event SunsetBegun(uint256 at);
    event SunsetCancelled();
    // ERC-4906
    event MetadataUpdate(uint256 _tokenId);
    event BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId);

    error BadAddress();
    error BadQuantity();
    error SoldOut();
    error WrongPayment();
    error MintClosed();
    error UpgradesClosed();
    error UnknownVein();
    error VeinIsClosed();
    error SameVein();
    error NotMinerOwner();
    error WrongVein();
    error StillTravelling();
    error TooCloseToSunset();
    error MaxTier();
    error NothingToClaim();
    error NothingDeposited();
    error SunsetState();
    error RoyaltyTooHigh();
    error TooManyVeins();
    error EthTransferFailed();
    error RenounceDisabled();

    constructor(address owner_, address treasury_, IVeinFunder funder_, string memory imageBase_)
        ERC721("Ormine Miners", "MINER")
        Ownable(owner_)
    {
        if (treasury_ == address(0) || address(funder_) == address(0)) revert BadAddress();
        treasury = treasury_;
        funder = funder_;
        imageBase = imageBase_;
        _setDefaultRoyalty(treasury_, ROYALTY_BPS);
    }

    // ---------------------------------------------------------------- players

    /// @notice Mints Tier I Diggers straight into `vein`. VEIN_SHARE_BPS of the payment is set aside to buy
    ///         that vein's stock, the rest goes to the treasury.
    function mint(uint8 vein, uint256 qty) external payable nonReentrant {
        if (mintPaused || _sunsetPassed()) revert MintClosed();
        if (qty == 0 || qty > MAX_PER_TX) revert BadQuantity();
        uint256 first = totalMinted + 1;
        if (first + qty - 1 > MAX_SUPPLY) revert SoldOut();
        if (msg.value != MINT_PRICE * qty) revert WrongPayment();

        Vein storage v = _openVein(vein);
        v.totalHash += (_hash(1) * qty).toUint64();
        v.miners += uint32(qty);
        uint256 acc = v.acc;
        totalMinted = first + qty - 1;
        for (uint256 id = first; id < first + qty; ++id) {
            _miners[id] = Miner({tier: 1, vein: vein, arrivalBucket: 0, accrued: 0, snap: acc});
            _safeMint(msg.sender, id);
            emit Minted(msg.sender, id, vein);
        }

        _split(vein);
    }

    /// @notice Moves a miner one tier up for UPGRADE_PRICE_PER_HASH per hash it gains, paid in ETH and split
    ///         like a mint: VEIN_SHARE_BPS buys the stock of the miner's vein (where it is heading, if travelling),
    ///         the rest goes to the treasury. Rewards earned at the old hashrate are settled first.
    function upgrade(uint256 tokenId) external payable nonReentrant {
        if (mintPaused || _sunsetPassed()) revert UpgradesClosed();
        _requireMinerOwner(tokenId);
        Miner storage m = _miners[tokenId];
        uint8 from = m.tier;
        if (from >= 4) revert MaxTier();

        Vein storage v = _sync(m.vein);
        uint256 gain = _hash(from + 1) - _hash(from);
        if (msg.value != UPGRADE_PRICE_PER_HASH * gain) revert WrongPayment();
        if (_settle(m, v)) {
            v.totalHash += gain.toUint64();
        } else {
            arrivalHash[m.vein][m.arrivalBucket] += gain;
            v.inTransitHash += gain.toUint64();
        }
        m.tier = from + 1;

        emit Upgraded(tokenId, from, from + 1, msg.value);
        emit MetadataUpdate(tokenId);
        _split(m.vein);
    }

    /// @notice Sends a miner to another vein. It earns nothing while it travels (TRAVEL, rounded up to a
    ///         BUCKET). What it earned in the old vein is kept for the owner in `owed`.
    function move(uint256 tokenId, uint8 toVein) external nonReentrant {
        _requireMinerOwner(tokenId);
        Miner storage m = _miners[tokenId];
        uint8 fromVein = m.vein;
        if (toVein == fromVein) revert SameVein();

        Vein storage dst = _openVein(toVein);
        Vein storage src = _sync(fromVein);
        if (!_settle(m, src)) revert StillTravelling();

        uint256 bucket = Math.ceilDiv(block.timestamp + TRAVEL, BUCKET);
        uint256 arrivesAt = bucket * BUCKET;
        // Owner decision 2Б: no trips that would still be under way when the sunset hits.
        uint256 s = sunsetAt;
        if (s != 0 && block.timestamp < s && arrivesAt > s) revert TooCloseToSunset();

        uint256 h = _hash(m.tier);
        src.totalHash -= h.toUint64();
        src.miners -= 1;
        owed[msg.sender][fromVein] += m.accrued;
        m.accrued = 0;

        arrivalHash[toVein][bucket] += h;
        _arrivalCount[toVein][bucket] += 1;
        dst.inTransitHash += h.toUint64();
        dst.inTransitMiners += 1;
        m.vein = toVein;
        m.arrivalBucket = uint64(bucket);
        m.snap = 0;
        emit Moved(tokenId, fromVein, toVein, arrivesAt);
        emit MetadataUpdate(tokenId);
    }

    /// @notice Claims what the given miners earned in `vein` plus anything left in `owed` for that vein.
    ///         Pass an empty list to claim only `owed`. Each vein is claimed on its own, so a frozen stock
    ///         token only blocks its own vein.
    function claim(uint8 vein, uint256[] calldata tokenIds) external nonReentrant {
        Vein storage v = _sync(_known(vein));
        uint256 amount = owed[msg.sender][vein];
        owed[msg.sender][vein] = 0;
        for (uint256 i; i < tokenIds.length; ++i) {
            uint256 id = tokenIds[i];
            _requireMinerOwner(id);
            Miner storage m = _miners[id];
            if (m.vein != vein) revert WrongVein();
            _settle(m, v);
            amount += m.accrued;
            m.accrued = 0;
        }
        if (amount == 0) revert NothingToClaim();
        v.reserved -= amount.toUint128();
        v.token.safeTransfer(msg.sender, amount);
        emit Claimed(msg.sender, vein, amount);
    }

    /// @notice Tops up a vein. Open to anyone; counted from the next epoch.
    function deposit(uint8 vein, uint256 amount) external nonReentrant {
        Vein storage v = _sync(_known(vein));
        IERC20 token = v.token;
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = token.balanceOf(address(this)) - before;
        if (received == 0) revert NothingDeposited();
        v.balance += received.toUint128();
        emit Deposited(vein, msg.sender, received);
    }

    /// @notice Brings a vein's accounting up to date. Anyone may call it; every action does it anyway.
    function poke(uint8 vein) external {
        _sync(_known(vein));
    }

    // ---------------------------------------------------------------- views

    function pending(uint256 tokenId) public view returns (uint256) {
        _requireOwned(tokenId);
        Miner memory m = _miners[tokenId];
        (Vein memory v, uint256[] memory buckets, uint256[] memory accs, uint256 n) = _synced(m.vein);
        uint256 snap = m.snap;
        if (m.arrivalBucket != 0) {
            if (m.arrivalBucket * BUCKET > block.timestamp) return m.accrued;
            snap = _arrivalAcc(m.vein, m.arrivalBucket, buckets, accs, n);
        }
        return m.accrued + _hash(m.tier) * (v.acc - snap) / ACC;
    }

    function minerInfo(uint256 tokenId) external view returns (MinerView memory info) {
        Miner memory m = _miners[tokenId];
        info.owner = ownerOf(tokenId);
        info.tier = m.tier;
        info.vein = m.vein;
        info.hashrate = _hash(m.tier);
        uint256 arrivesAt = uint256(m.arrivalBucket) * BUCKET;
        info.arrivesAt = arrivesAt > block.timestamp ? arrivesAt : 0;
        info.pending = pending(tokenId);
    }

    /// @notice Miners owned by `who` with ids in [fromId, toId], for the app to page through without an indexer.
    function minersOf(address who, uint256 fromId, uint256 toId)
        external
        view
        returns (uint256[] memory ids, MinerView[] memory infos)
    {
        if (toId > totalMinted) toId = totalMinted;
        uint256 n;
        for (uint256 id = fromId; id <= toId; ++id) {
            if (_ownerOf(id) == who) ++n;
        }
        ids = new uint256[](n);
        infos = new MinerView[](n);
        n = 0;
        for (uint256 id = fromId; id <= toId; ++id) {
            if (_ownerOf(id) == who) {
                ids[n] = id;
                infos[n++] = this.minerInfo(id);
            }
        }
    }

    function veinInfo(uint8 vein) external view returns (VeinView memory info) {
        (Vein memory v,,,) = _synced(_known(vein));
        info.token = address(v.token);
        info.ticker = veinTicker[vein];
        info.closed = v.closed;
        info.balance = v.balance;
        info.epochStart = v.epochStart;
        info.epochRelease = v.epochRelease;
        info.totalHash = v.totalHash;
        info.inTransitHash = v.inTransitHash;
        info.miners = v.miners;
        info.reserved = v.reserved;
    }

    function hashrateOf(uint8 tier) external pure returns (uint256) {
        return _hash(tier);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        Miner memory m = _miners[tokenId];
        (string memory name, string memory slug) = _tierName(m.tier);
        string memory json = string.concat(
            '{"name":"Ormine Miner #',
            tokenId.toString(),
            '","description":"An Ormine miner. It digs tokenized stocks on Robinhood Chain.","image":"',
            imageBase,
            slug,
            '.png","attributes":[{"trait_type":"Tier","value":',
            uint256(m.tier).toString(),
            '},{"trait_type":"Name","value":"',
            name,
            '"},{"trait_type":"Hashrate","value":',
            _hash(m.tier).toString(),
            '},{"trait_type":"Vein","value":"',
            veinTicker[m.vein],
            '"}]}'
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    function supportsInterface(bytes4 id) public view override(ERC721, ERC2981) returns (bool) {
        return id == bytes4(0x49064906) || super.supportsInterface(id);
    }

    // ---------------------------------------------------------------- owner

    function addVein(IERC20 token, string calldata ticker) external onlyOwner returns (uint8 vein) {
        if (address(token) == address(0) || _veinToken[address(token)]) revert BadAddress();
        if (veinCount == type(uint8).max) revert TooManyVeins();
        vein = veinCount++;
        _veinToken[address(token)] = true;
        Vein storage v = _veins[vein];
        v.token = token;
        v.lastUpdate = uint64(block.timestamp);
        v.epochStart = uint64(block.timestamp);
        veinTicker[vein] = ticker;
        emit VeinAdded(vein, address(token), ticker);
    }

    /// @notice Closes a vein to new miners for good (owner decision 4Б). Miners inside keep earning.
    function closeVein(uint8 vein) external onlyOwner {
        _sync(_known(vein)).closed = true;
        emit VeinClosed(vein);
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert BadAddress();
        treasury = treasury_;
        emit TreasurySet(treasury_);
    }

    /// @notice Pauses minting and upgrades. Moves and claims are never paused.
    function setMintPaused(bool paused) external onlyOwner {
        mintPaused = paused;
        emit MintPausedSet(paused);
    }

    function setRoyalty(address receiver, uint96 bps) external onlyOwner {
        if (bps > MAX_ROYALTY_BPS) revert RoyaltyTooHigh();
        _setDefaultRoyalty(receiver, bps);
    }

    function setImageBase(string calldata imageBase_) external onlyOwner {
        imageBase = imageBase_;
        emit ImageBaseSet(imageBase_);
        emit BatchMetadataUpdate(1, type(uint256).max);
    }

    /// @notice Announces the sunset. After SUNSET_DELAY minting and upgrades stop and every vein with miners
    ///         in it releases its whole balance at once. Veins with nobody in them keep the normal daily
    ///         release (owner decision 1А). Claims stay open forever.
    function beginSunset() external onlyOwner {
        if (sunsetAt != 0) revert SunsetState();
        sunsetAt = block.timestamp + SUNSET_DELAY;
        emit SunsetBegun(sunsetAt);
    }

    function cancelSunset() external onlyOwner {
        if (sunsetAt == 0 || block.timestamp >= sunsetAt) revert SunsetState();
        sunsetAt = 0;
        emit SunsetCancelled();
    }

    function renounceOwnership() public pure override {
        revert RenounceDisabled();
    }

    // ---------------------------------------------------------------- internals

    /// @dev Settles a miner's earnings before its owner changes, so the previous owner keeps them in `owed`.
    ///      No stock tokens move here: a blocklisted owner must not be able to block NFT transfers.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && from != to) {
            Miner storage m = _miners[tokenId];
            _settle(m, _sync(m.vein));
            uint256 a = m.accrued;
            if (a != 0) {
                owed[from][m.vein] += a;
                m.accrued = 0;
            }
        }
        return super._update(to, tokenId, auth);
    }

    function _requireMinerOwner(uint256 tokenId) private view {
        if (ownerOf(tokenId) != msg.sender) revert NotMinerOwner();
    }

    /// @dev Sends VEIN_SHARE_BPS of the payment to the funder for `vein`, the rest to the treasury.
    function _split(uint8 vein) private {
        uint256 toVein = msg.value * VEIN_SHARE_BPS / 10_000;
        funder.fund{value: toVein}(vein);
        (bool ok,) = treasury.call{value: msg.value - toVein}("");
        if (!ok) revert EthTransferFailed();
    }

    function _known(uint8 vein) private view returns (uint8) {
        if (vein >= veinCount) revert UnknownVein();
        return vein;
    }

    function _openVein(uint8 vein) private returns (Vein storage v) {
        v = _sync(_known(vein));
        if (v.closed) revert VeinIsClosed();
    }

    function _sunsetPassed() private view returns (bool) {
        return sunsetAt != 0 && block.timestamp >= sunsetAt;
    }

    /// @dev Credits a miner with what it earned since its last settle. Returns false while it is still travelling.
    ///      The miner's vein must be synced.
    function _settle(Miner storage m, Vein storage v) private returns (bool) {
        uint256 bucket = m.arrivalBucket;
        if (bucket != 0) {
            if (bucket * BUCKET > block.timestamp) return false;
            m.snap = _bucketAcc[m.vein][bucket];
            m.arrivalBucket = 0;
        }
        uint256 acc = v.acc;
        m.accrued += (_hash(m.tier) * (acc - m.snap) / ACC).toUint128();
        m.snap = acc;
        return true;
    }

    function _sync(uint8 id) private returns (Vein storage s) {
        s = _veins[id];
        if (s.lastUpdate == block.timestamp) return s;
        Vein memory v = s;
        (uint256[] memory buckets, uint256[] memory accs, uint256 n) = _advance(id, v, block.timestamp);
        for (uint256 i; i < n; ++i) {
            _bucketAcc[id][buckets[i]] = accs[i];
        }
        _veins[id] = v;
    }

    function _synced(uint8 id)
        private
        view
        returns (Vein memory v, uint256[] memory buckets, uint256[] memory accs, uint256 n)
    {
        v = _veins[id];
        (buckets, accs, n) = _advance(id, v, block.timestamp);
    }

    function _arrivalAcc(uint8 id, uint256 bucket, uint256[] memory buckets, uint256[] memory accs, uint256 n)
        private
        view
        returns (uint256)
    {
        if (bucket <= _veins[id].lastUpdate / BUCKET) return _bucketAcc[id][bucket];
        for (uint256 i; i < n; ++i) {
            if (buckets[i] == bucket) return accs[i];
        }
        return 0; // unreachable: a due bucket is either stored or processed above
    }

    /// @dev Brings a memory copy of a vein forward to `to`, letting miners arrive at their bucket times.
    ///      Every pending arrival lies within TRAVEL + BUCKET after lastUpdate (a move syncs the destination),
    ///      so the scan is bounded by MAX_SCAN buckets.
    function _advance(uint8 id, Vein memory v, uint256 to)
        private
        view
        returns (uint256[] memory buckets, uint256[] memory accs, uint256 n)
    {
        if (v.inTransitHash != 0) {
            buckets = new uint256[](MAX_SCAN);
            accs = new uint256[](MAX_SCAN);
            uint256 first = v.lastUpdate / BUCKET + 1;
            uint256 last = Math.min(to / BUCKET, first + MAX_SCAN - 1);
            for (uint256 b = first; b <= last && v.inTransitHash != 0; ++b) {
                uint256 h = arrivalHash[id][b];
                if (h == 0) continue;
                _accrue(v, b * BUCKET);
                uint256 c = _arrivalCount[id][b];
                v.totalHash += uint64(h);
                v.inTransitHash -= uint64(h);
                v.miners += uint32(c);
                v.inTransitMiners -= uint32(c);
                buckets[n] = b;
                accs[n] = v.acc;
                ++n;
            }
        }
        _accrue(v, to);
    }

    function _accrue(Vein memory v, uint256 to) private view {
        uint256 s = sunsetAt;
        if (s != 0 && v.lastUpdate <= s && s < to) {
            _flow(v, s);
            // The final epoch: a vein with miners in it releases everything it holds.
            if (v.totalHash != 0) {
                _release(v, v.balance);
                v.epochRelease = 0;
                v.releasedInEpoch = 0;
            }
        }
        _flow(v, to);
    }

    /// @dev Runs the epoch schedule from lastUpdate to `to`. Each epoch releases RELEASE_BPS of the balance it
    ///      started with, evenly over time. Hashrate is constant within one call (arrivals split the calls), so
    ///      epochs are walked one by one on the stack and paid out once; years without a transaction stay cheap.
    ///      Walking instead of a closed-form power keeps the rounding identical to per-epoch processing.
    function _flow(Vein memory v, uint256 to) private pure {
        uint256 t = v.lastUpdate;
        if (to <= t) return;
        bool digging = v.totalHash != 0;
        uint256 start = v.epochStart;
        uint256 rel = v.epochRelease;
        uint256 done = v.releasedInEpoch;
        uint256 bal = v.balance;
        uint256 out;
        while (true) {
            uint256 end = start + EPOCH;
            if (t >= end) {
                start = end;
                rel = bal * RELEASE_BPS / 10_000;
                done = 0;
                continue;
            }
            uint256 seg = to < end ? to : end;
            uint256 due = rel * (seg - start) / EPOCH;
            if (digging) {
                // never more than bal: an epoch releases at most RELEASE_BPS of the balance it started with
                uint256 amount = due - done;
                bal -= amount;
                out += amount;
            }
            done = due;
            t = seg;
            if (t == to) break;
        }
        v.epochStart = uint64(start);
        // casting is safe: rel <= bal <= v.balance, done <= rel
        v.epochRelease = uint128(rel);
        v.releasedInEpoch = uint128(done);
        v.lastUpdate = uint64(to);
        if (out != 0) _release(v, out);
    }

    /// @dev Hands `amount` to the miners digging now. The balance is charged rounded up, so the sum of all
    ///      miners' shares never exceeds `reserved`.
    function _release(Vein memory v, uint256 amount) private pure {
        // callers guarantee totalHash != 0 and amount <= balance
        uint256 hash = v.totalHash;
        uint256 inc = amount * ACC / hash;
        if (inc == 0) return;
        uint256 used = Math.ceilDiv(inc * hash, ACC);
        v.acc += inc;
        // casting is safe: used <= amount <= balance, a uint128; the checked add still guards reserved
        v.balance -= uint128(used);
        v.reserved += uint128(used);
    }

    function _hash(uint256 tier) private pure returns (uint256) {
        if (tier == 1) return 10;
        if (tier == 2) return 25;
        if (tier == 3) return 60;
        if (tier == 4) return 150;
        return 0;
    }

    function _tierName(uint8 tier) private pure returns (string memory name, string memory slug) {
        if (tier == 1) return ("Digger", "digger");
        if (tier == 2) return ("Miner", "miner");
        if (tier == 3) return ("Driller", "driller");
        return ("Rig", "rig");
    }
}
