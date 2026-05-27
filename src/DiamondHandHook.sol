// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "@openzeppelin/uniswap-hooks/src/base/BaseHook.sol";

import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";

contract DiamondHandHook is BaseHook {
    using PoolIdLibrary for PoolKey;

    uint24 public constant PAPER_HAND_FEE = 30_000; // 3.0%
    uint24 public constant HOLDER_FEE = 15_000; // 1.5%
    uint24 public constant DIAMOND_HAND_FEE = 3_000; // 0.3%

    uint256 public constant HOLDER_SECONDS = 5 minutes;
    uint256 public constant DIAMOND_SECONDS = 30 minutes;

    enum LoyaltyTier {
        PaperHand,
        Holder,
        DiamondHand
    }

    struct PositionState {
        uint64 firstBuyAt;
        uint64 lastSellAt;
        uint32 buyCount;
        uint32 sellCount;
        uint24 lastFee;
        LoyaltyTier tier;
    }

    mapping(PoolId poolId => mapping(address trader => PositionState state)) public positions;

    event BuyRecorded(PoolId indexed poolId, address indexed trader, uint256 timestamp);
    event SellClassified(
        PoolId indexed poolId,
        address indexed trader,
        LoyaltyTier tier,
        uint24 fee,
        uint256 holdingSeconds
    );

    constructor(IPoolManager _poolManager) BaseHook(_poolManager) {}

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    function previewFee(address trader, PoolKey calldata key) external view returns (LoyaltyTier tier, uint24 fee) {
        PositionState storage state = positions[key.toId()][trader];
        return _tierAndFee(state.firstBuyAt);
    }

    function diamondScore(address trader, PoolKey calldata key) external view returns (uint256) {
        PositionState storage state = positions[key.toId()][trader];
        if (state.firstBuyAt == 0) return 0;

        uint256 holdingSeconds = block.timestamp - state.firstBuyAt;
        uint256 timeScore = holdingSeconds >= DIAMOND_SECONDS ? 70 : (holdingSeconds * 70) / DIAMOND_SECONDS;
        uint256 behaviorScore = state.sellCount == 0 ? 30 : 15;

        return timeScore + behaviorScore;
    }

    function _beforeSwap(address sender, PoolKey calldata key, SwapParams calldata params, bytes calldata hookData)
        internal
        override
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        address trader = _resolveTrader(sender, hookData);
        PositionState storage state = positions[key.toId()][trader];

        if (_isBuy(params)) {
            if (state.firstBuyAt == 0) {
                state.firstBuyAt = uint64(block.timestamp);
                emit BuyRecorded(key.toId(), trader, block.timestamp);
            }
            state.buyCount += 1;
            return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
        }

        (LoyaltyTier tier, uint24 fee) = _tierAndFee(state.firstBuyAt);
        uint256 holdingSeconds = state.firstBuyAt == 0 ? 0 : block.timestamp - state.firstBuyAt;

        state.tier = tier;
        state.lastFee = fee;

        emit SellClassified(key.toId(), trader, tier, fee, holdingSeconds);

        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, fee | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    function _afterSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta,
        bytes calldata hookData
    ) internal override returns (bytes4, int128) {
        address trader = _resolveTrader(sender, hookData);
        PositionState storage state = positions[key.toId()][trader];

        if (!_isBuy(params)) {
            state.lastSellAt = uint64(block.timestamp);
            state.sellCount += 1;
        }

        return (BaseHook.afterSwap.selector, 0);
    }

    function _tierAndFee(uint64 firstBuyAt) internal view returns (LoyaltyTier tier, uint24 fee) {
        if (firstBuyAt == 0) return (LoyaltyTier.PaperHand, PAPER_HAND_FEE);

        uint256 holdingSeconds = block.timestamp - firstBuyAt;

        if (holdingSeconds >= DIAMOND_SECONDS) return (LoyaltyTier.DiamondHand, DIAMOND_HAND_FEE);
        if (holdingSeconds >= HOLDER_SECONDS) return (LoyaltyTier.Holder, HOLDER_FEE);
        return (LoyaltyTier.PaperHand, PAPER_HAND_FEE);
    }

    function _resolveTrader(address sender, bytes calldata hookData) internal pure returns (address) {
        if (hookData.length == 32) {
            return abi.decode(hookData, (address));
        }

        return sender;
    }

    function _isBuy(SwapParams calldata params) internal pure returns (bool) {
        return params.zeroForOne;
    }
}
