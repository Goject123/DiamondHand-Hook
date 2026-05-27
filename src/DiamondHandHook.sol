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
        uint64 lastSellAt;
        uint32 buyCount;
        uint32 sellCount;
        uint24 lastFee;
        uint256 nextLotIndex;
        LoyaltyTier tier;
    }

    struct HoldingLot {
        uint128 amountRemaining;
        uint64 boughtAt;
    }

    error OversoldPosition(uint256 requested, uint256 available);

    mapping(PoolId poolId => mapping(address trader => PositionState state)) public positions;
    mapping(PoolId poolId => mapping(address trader => HoldingLot[] lots)) internal holdingLots;

    event BuyRecorded(PoolId indexed poolId, address indexed trader, uint256 indexed lotIndex, uint256 amount, uint256 timestamp);
    event SellClassified(
        PoolId indexed poolId,
        address indexed trader,
        uint256 indexed lotIndex,
        LoyaltyTier tier,
        uint24 fee,
        uint256 amount,
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
        (HoldingLot memory lot,) = _nextActiveLot(key.toId(), trader);
        return _tierAndFee(lot.boughtAt);
    }

    function nextLot(address trader, PoolKey calldata key)
        external
        view
        returns (uint256 lotIndex, uint256 amountRemaining, uint256 boughtAt, uint256 holdingSeconds, LoyaltyTier tier, uint24 fee)
    {
        (HoldingLot memory lot, uint256 index) = _nextActiveLot(key.toId(), trader);
        (tier, fee) = _tierAndFee(lot.boughtAt);
        lotIndex = index;
        amountRemaining = lot.amountRemaining;
        boughtAt = lot.boughtAt;
        holdingSeconds = lot.boughtAt == 0 ? 0 : block.timestamp - lot.boughtAt;
    }

    function lotCount(address trader, PoolKey calldata key) external view returns (uint256) {
        return holdingLots[key.toId()][trader].length;
    }

    function lotAt(address trader, PoolKey calldata key, uint256 index)
        external
        view
        returns (uint256 amountRemaining, uint256 boughtAt, uint256 holdingSeconds, LoyaltyTier tier, uint24 fee)
    {
        HoldingLot memory lot = holdingLots[key.toId()][trader][index];
        (tier, fee) = _tierAndFee(lot.boughtAt);
        amountRemaining = lot.amountRemaining;
        boughtAt = lot.boughtAt;
        holdingSeconds = lot.boughtAt == 0 ? 0 : block.timestamp - lot.boughtAt;
    }

    function _beforeSwap(address sender, PoolKey calldata key, SwapParams calldata params, bytes calldata hookData)
        internal
        override
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        address trader = _resolveTrader(sender, hookData);
        PositionState storage state = positions[key.toId()][trader];

        if (_isBuy(params)) {
            holdingLots[key.toId()][trader].push(HoldingLot({amountRemaining: 0, boughtAt: uint64(block.timestamp)}));
            state.buyCount += 1;
            return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
        }

        uint24 fee = _classifySell(key.toId(), trader, _exactInputAmount(params), state);

        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, fee | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    function _afterSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata hookData
    ) internal override returns (bytes4, int128) {
        address trader = _resolveTrader(sender, hookData);
        PositionState storage state = positions[key.toId()][trader];

        if (_isBuy(params)) {
            _finalizeBuy(key.toId(), trader, delta);
        } else {
            _consumeLots(key.toId(), trader, _exactInputAmount(params));
            state.lastSellAt = uint64(block.timestamp);
            state.sellCount += 1;
        }

        return (BaseHook.afterSwap.selector, 0);
    }

    function _classifySell(PoolId poolId, address trader, uint256 amount, PositionState storage state)
        internal
        returns (uint24 fee)
    {
        (HoldingLot memory lot, uint256 lotIndex) = _nextActiveLot(poolId, trader);
        (LoyaltyTier tier, uint24 nextFee) = _tierAndFee(lot.boughtAt);
        uint256 holdingSeconds = lot.boughtAt == 0 ? 0 : block.timestamp - lot.boughtAt;

        state.tier = tier;
        state.lastFee = nextFee;

        emit SellClassified(poolId, trader, lotIndex, tier, nextFee, amount, holdingSeconds);
        return nextFee;
    }

    function _consumeLots(PoolId poolId, address trader, uint256 amount) internal {
        PositionState storage state = positions[poolId][trader];
        HoldingLot[] storage lots = holdingLots[poolId][trader];
        uint256 index = state.nextLotIndex;
        uint256 remaining = amount;

        while (remaining > 0 && index < lots.length) {
            HoldingLot storage lot = lots[index];
            if (lot.amountRemaining == 0) {
                index++;
                continue;
            }

            if (lot.amountRemaining > remaining) {
                lot.amountRemaining -= uint128(remaining);
                remaining = 0;
            } else {
                remaining -= lot.amountRemaining;
                lot.amountRemaining = 0;
                index++;
            }
        }

        if (remaining > 0) revert OversoldPosition(amount, amount - remaining);

        state.nextLotIndex = index;
    }

    function _finalizeBuy(PoolId poolId, address trader, BalanceDelta delta) internal {
        HoldingLot[] storage lots = holdingLots[poolId][trader];
        if (lots.length == 0) return;

        uint256 lotIndex = lots.length - 1;
        HoldingLot storage lot = lots[lotIndex];
        uint256 amountOut = _dhcAmountOut(delta);
        lot.amountRemaining = uint128(amountOut);

        emit BuyRecorded(poolId, trader, lotIndex, amountOut, lot.boughtAt);
    }

    function _nextActiveLot(PoolId poolId, address trader) internal view returns (HoldingLot memory lot, uint256 index) {
        PositionState storage state = positions[poolId][trader];
        HoldingLot[] storage lots = holdingLots[poolId][trader];
        index = state.nextLotIndex;

        while (index < lots.length) {
            lot = lots[index];
            if (lot.amountRemaining > 0) return (lot, index);
            index++;
        }
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
        return !params.zeroForOne;
    }

    function _exactInputAmount(SwapParams calldata params) internal pure returns (uint256) {
        return params.amountSpecified < 0 ? uint256(-params.amountSpecified) : uint256(params.amountSpecified);
    }

    function _dhcAmountOut(BalanceDelta delta) internal pure returns (uint256) {
        return delta.amount0() > 0 ? uint256(uint128(delta.amount0())) : 0;
    }
}
