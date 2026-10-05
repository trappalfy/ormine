// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// Robinhood Chain mainnet (4663) addresses, checked on-chain on 2026-10-05.
/// Stock tokens: docs.robinhood.com/chain/stock-tokens. Feeds: Chainlink, 8 decimals, price per token.
abstract contract MainnetConfig {
    struct VeinConfig {
        address token;
        string ticker;
        uint24 poolFee; // Uniswap V3 stock/WETH pool
        address feed; // stock token / USD
    }

    address internal constant ROUTER = 0xCaf681a66D020601342297493863E78C959E5cb2; // Uniswap SwapRouter02
    address internal constant UNI_V3_FACTORY = 0x1f7d7550B1b028f7571E69A784071F0205FD2EfA;
    address internal constant WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;
    address internal constant ETH_USD = 0x78F3556b67E17Df817D51Ef5a990cDaF09E8d3A9;

    function mainnetVeins() internal pure returns (VeinConfig[3] memory) {
        return [
            VeinConfig(0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC, "NVDA", 500, 0x379EC4f7C378F34a1B47E4F3cbeBCbAC3E8E9F15),
            VeinConfig(0x322F0929c4625eD5bAd873c95208D54E1c003b2d, "TSLA", 3000, 0x4A1166a659A55625345e9515b32adECea5547C38),
            VeinConfig(0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9, "AAPL", 500, 0x6B22A786bAa607d76728168703a39Ea9C99f2cD0)
        ];
    }
}
