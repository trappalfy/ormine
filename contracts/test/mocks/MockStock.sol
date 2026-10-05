// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// Stock-token stand-in with the issuer controls we must survive: global pause and a blocklist.
contract MockStock is ERC20 {
    uint8 private immutable _dec;
    bool public paused;
    bool public oraclePaused;
    mapping(address => bool) public blocked;

    constructor(string memory symbol_, uint8 dec_) ERC20(symbol_, symbol_) {
        _dec = dec_;
    }

    function decimals() public view override returns (uint8) {
        return _dec;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setPaused(bool p) external {
        paused = p;
    }

    function setOraclePaused(bool p) external {
        oraclePaused = p;
    }

    function setBlocked(address who, bool b) external {
        blocked[who] = b;
    }

    function _update(address from, address to, uint256 value) internal override {
        require(!paused, "paused");
        require(!blocked[from] && !blocked[to], "blocked");
        super._update(from, to, value);
    }
}

/// Takes a 1% fee on every transfer, to check deposits count what actually arrived.
contract FeeStock is ERC20 {
    constructor() ERC20("Fee", "FEE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 fee = value / 100;
            super._update(from, address(0xFEE), fee);
            value -= fee;
        }
        super._update(from, to, value);
    }
}

/// Records the ETH set aside for each vein.
contract MockFunder {
    mapping(uint8 => uint256) public ethPending;

    function fund(uint8 vein) external payable {
        ethPending[vein] += msg.value;
    }
}

/// Chainlink-style feed with a settable answer.
contract MockFeed {
    uint8 public immutable decimals;
    int256 public answer;
    uint256 public updatedAt;

    constructor(uint8 dec_, int256 answer_) {
        decimals = dec_;
        set(answer_);
    }

    function set(int256 answer_) public {
        answer = answer_;
        updatedAt = block.timestamp;
    }

    function setUpdatedAt(uint256 t) external {
        updatedAt = t;
    }

    /// Testnet deployments set updatedAt to max so the price never goes stale.
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        uint256 t = updatedAt == type(uint256).max ? block.timestamp : updatedAt;
        return (1, answer, t, t, 1);
    }
}

/// SwapRouter02 stand-in: pays `rate` stock units per 1e18 wei, minted out of thin air.
contract MockRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    address public immutable WETH9 = address(0xE7);
    mapping(address => uint256) public rate;

    function setRate(address token, uint256 r) external {
        rate[token] = r;
    }

    function exactInputSingle(ExactInputSingleParams calldata p) external payable returns (uint256 out) {
        require(msg.value == p.amountIn && p.tokenIn == WETH9, "bad in");
        out = p.amountIn * rate[p.tokenOut] / 1e18;
        require(out >= p.amountOutMinimum, "Too little received");
        MockStock(p.tokenOut).mint(p.recipient, out);
    }
}
