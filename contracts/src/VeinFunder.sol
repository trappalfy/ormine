// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// Uniswap V3 SwapRouter02 (no deadline in the params; this contract checks it).
interface ISwapRouter02 {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
    function WETH9() external view returns (address);
}

interface IPriceFeed {
    function decimals() external view returns (uint8);
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80);
}

/// Robinhood stock tokens raise this flag during corporate actions, when prices are not reliable.
interface IStockToken {
    function oraclePaused() external view returns (bool);
}

interface IOrmineVeins {
    function veinInfo(uint8 vein) external view returns (OrmineVeinView memory);
    function deposit(uint8 vein, uint256 amount) external;
}

struct OrmineVeinView {
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

/// @title Vein funder
/// @notice Holds the vein share of every mint in ETH, per vein, until the keeper swaps it for that vein's stock
///         and deposits it. The ETH can only ever become stock in the same vein: there is no withdrawal.
///         Every swap is checked against Chainlink prices, so a swap can't go through at a bad rate.
contract VeinFunder is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_CONVERT = 2 ether; // per call; keeps price impact small in the thinner pools
    uint256 public constant MAX_DEVIATION_BPS = 150; // worst accepted rate vs. the oracle rate
    uint256 public constant MAX_PRICE_AGE = 26 hours; // stock feeds have a 24 h heartbeat

    struct Route {
        uint24 poolFee; // Uniswap V3 fee tier of the stock/WETH pool
        IPriceFeed stockFeed; // stock token / USD
    }

    IOrmineVeins public immutable miners;
    ISwapRouter02 public immutable router;
    address public immutable weth;
    IPriceFeed public immutable ethFeed; // ETH / USD

    address public keeper;
    mapping(uint8 => uint256) public ethPending;
    mapping(uint8 => Route) public routes;

    event Funded(uint8 indexed vein, uint256 amount);
    event Converted(uint8 indexed vein, uint256 ethIn, uint256 tokensOut);
    event KeeperSet(address keeper);
    event RouteSet(uint8 indexed vein, uint24 poolFee, address stockFeed);

    error OnlyMiners();
    error OnlyKeeper();
    error BadAmount();
    error Expired();
    error NoRoute();
    error StalePrice();
    error PricePaused();
    error BadAddress();

    constructor(address owner_, IOrmineVeins miners_, ISwapRouter02 router_, IPriceFeed ethFeed_, address keeper_)
        Ownable(owner_)
    {
        if (address(miners_) == address(0) || address(router_) == address(0) || address(ethFeed_) == address(0)) {
            revert BadAddress();
        }
        miners = miners_;
        router = router_;
        weth = router_.WETH9();
        ethFeed = ethFeed_;
        keeper = keeper_;
        emit KeeperSet(keeper_);
    }

    /// @notice Called by OrmineMiners on every mint with the vein's share.
    function fund(uint8 vein) external payable {
        if (msg.sender != address(miners)) revert OnlyMiners();
        ethPending[vein] += msg.value;
        emit Funded(vein, msg.value);
    }

    /// @notice Swaps `ethIn` of a vein's pending ETH for its stock and deposits the stock into the vein.
    ///         `minOut` can only tighten the oracle floor, never loosen it.
    function convert(uint8 vein, uint256 ethIn, uint256 minOut, uint256 deadline)
        external
        nonReentrant
        returns (uint256 out)
    {
        if (msg.sender != keeper) revert OnlyKeeper();
        if (block.timestamp > deadline) revert Expired();
        if (ethIn == 0 || ethIn > MAX_CONVERT || ethIn > ethPending[vein]) revert BadAmount();
        Route memory r = routes[vein];
        if (address(r.stockFeed) == address(0)) revert NoRoute();

        address token = miners.veinInfo(vein).token;
        uint256 floor = fairOut(vein, ethIn) * (10_000 - MAX_DEVIATION_BPS) / 10_000;
        if (minOut < floor) minOut = floor;

        ethPending[vein] -= ethIn;
        out = router.exactInputSingle{value: ethIn}(
            ISwapRouter02.ExactInputSingleParams({
                tokenIn: weth,
                tokenOut: token,
                fee: r.poolFee,
                recipient: address(this),
                amountIn: ethIn,
                amountOutMinimum: minOut,
                sqrtPriceLimitX96: 0
            })
        );
        IERC20(token).forceApprove(address(miners), out);
        miners.deposit(vein, out);
        emit Converted(vein, ethIn, out);
    }

    /// @notice What `ethIn` buys at oracle prices, in the vein token's smallest units.
    function fairOut(uint8 vein, uint256 ethIn) public view returns (uint256) {
        Route memory r = routes[vein];
        if (address(r.stockFeed) == address(0)) revert NoRoute();
        address token = miners.veinInfo(vein).token;
        try IStockToken(token).oraclePaused() returns (bool paused) {
            if (paused) revert PricePaused();
        } catch {}
        (uint256 ethUsd, uint8 ethDec) = _price(ethFeed);
        (uint256 stockUsd, uint8 stockDec) = _price(r.stockFeed);
        uint8 tokenDec = IERC20Metadata(token).decimals();
        // tokens = ethIn / 1e18 * (ethUsd / 10^ethDec) / (stockUsd / 10^stockDec) * 10^tokenDec
        return Math.mulDiv(
            ethIn * ethUsd, 10 ** (uint256(stockDec) + tokenDec), stockUsd * 10 ** (uint256(ethDec) + 18)
        );
    }

    function setKeeper(address keeper_) external onlyOwner {
        keeper = keeper_;
        emit KeeperSet(keeper_);
    }

    /// @notice Sets the pool and price feed used to buy a vein's stock. The oracle check bounds every swap, and
    ///         the ETH can't leave for anything but that vein's stock whatever the route.
    function setRoute(uint8 vein, uint24 poolFee, IPriceFeed stockFeed) external onlyOwner {
        if (address(stockFeed) == address(0)) revert BadAddress();
        routes[vein] = Route(poolFee, stockFeed);
        emit RouteSet(vein, poolFee, address(stockFeed));
    }

    function renounceOwnership() public pure override {
        revert BadAddress();
    }

    function _price(IPriceFeed feed) private view returns (uint256 price, uint8 dec) {
        (, int256 answer,, uint256 updatedAt,) = feed.latestRoundData();
        if (answer <= 0 || block.timestamp - updatedAt > MAX_PRICE_AGE) revert StalePrice();
        return (uint256(answer), feed.decimals());
    }
}
