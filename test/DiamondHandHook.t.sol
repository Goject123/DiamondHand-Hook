// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {CurrencyLibrary, Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {LiquidityAmounts} from "@uniswap/v4-core/test/utils/LiquidityAmounts.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {Constants} from "@uniswap/v4-core/test/utils/Constants.sol";

import {EasyPosm} from "./utils/libraries/EasyPosm.sol";

import {DiamondHandHook} from "../src/DiamondHandHook.sol";
import {BaseTest} from "./utils/BaseTest.sol";

contract DiamondHandHookTest is BaseTest {
    using EasyPosm for IPositionManager;
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    using StateLibrary for IPoolManager;

    Currency currency0;
    Currency currency1;

    PoolKey poolKey;
    PoolId poolId;
    DiamondHandHook hook;

    function setUp() public {
        deployArtifactsAndLabel();

        (currency0, currency1) = deployCurrencyPair();

        address flags = address(uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG) ^ (0x4444 << 144));
        bytes memory constructorArgs = abi.encode(poolManager);
        deployCodeTo("DiamondHandHook.sol:DiamondHandHook", constructorArgs, flags);
        hook = DiamondHandHook(flags);

        poolKey = PoolKey(currency0, currency1, LPFeeLibrary.DYNAMIC_FEE_FLAG, 60, IHooks(hook));
        poolId = poolKey.toId();
        poolManager.initialize(poolKey, Constants.SQRT_PRICE_1_1);

        _addLiquidity();
    }

    function testPaperHandFeeBeforeFiveMinutes() public {
        _buy();

        (DiamondHandHook.LoyaltyTier tier, uint24 fee) = hook.previewFee(address(this), poolKey);

        assertEq(uint8(tier), uint8(DiamondHandHook.LoyaltyTier.PaperHand));
        assertEq(fee, hook.PAPER_HAND_FEE());
    }

    function testHolderFeeAfterFiveMinutes() public {
        _buy();
        vm.warp(block.timestamp + 6 minutes);

        (DiamondHandHook.LoyaltyTier tier, uint24 fee) = hook.previewFee(address(this), poolKey);

        assertEq(uint8(tier), uint8(DiamondHandHook.LoyaltyTier.Holder));
        assertEq(fee, hook.HOLDER_FEE());
    }

    function testDiamondHandFeeAfterThirtyMinutes() public {
        _buy();
        vm.warp(block.timestamp + 31 minutes);

        (DiamondHandHook.LoyaltyTier tier, uint24 fee) = hook.previewFee(address(this), poolKey);

        assertEq(uint8(tier), uint8(DiamondHandHook.LoyaltyTier.DiamondHand));
        assertEq(fee, hook.DIAMOND_HAND_FEE());
    }

    function testSellUpdatesStateAndConsumesLot() public {
        _buy();
        vm.warp(block.timestamp + 31 minutes);
        _sell();

        (uint64 lastSellAt, uint32 buyCount, uint32 sellCount, uint24 lastFee, uint256 nextLotIndex,) =
            hook.positions(poolId, address(this));
        (uint256 lotIndex, uint256 amountRemaining,,,,) = hook.nextLot(address(this), poolKey);

        assertGt(lastSellAt, 0);
        assertEq(buyCount, 1);
        assertEq(sellCount, 1);
        assertEq(lastFee, hook.DIAMOND_HAND_FEE());
        assertEq(nextLotIndex, 0);
        assertEq(lotIndex, 0);
        assertGt(amountRemaining, 0);
        assertLt(amountRemaining, 1e18);
    }

    function testFifoLotsKeepTheirOwnHoldingTime() public {
        _buyAmount(1e18);
        (uint256 firstLotIndex, uint256 firstLotAmount,,,,) = hook.nextLot(address(this), poolKey);
        assertEq(firstLotIndex, 0);

        vm.warp(block.timestamp + 31 minutes);
        _buyAmount(100e18);
        (uint256 secondLotAmount,,,,) = hook.lotAt(address(this), poolKey, 1);

        (,,,, DiamondHandHook.LoyaltyTier firstTier, uint24 firstFee) = hook.nextLot(address(this), poolKey);

        assertEq(uint8(firstTier), uint8(DiamondHandHook.LoyaltyTier.DiamondHand));
        assertEq(firstFee, hook.DIAMOND_HAND_FEE());

        _sellAmount(firstLotAmount);

        (uint64 lastSellAt, uint32 buyCount, uint32 sellCount, uint24 lastFee, uint256 nextLotIndex,) =
            hook.positions(poolId, address(this));
        (uint256 lotIndex, uint256 amountRemaining,, uint256 holdingSeconds, DiamondHandHook.LoyaltyTier nextTier, uint24 nextFee) =
            hook.nextLot(address(this), poolKey);

        assertGt(lastSellAt, 0);
        assertEq(buyCount, 2);
        assertEq(sellCount, 1);
        assertEq(lastFee, hook.DIAMOND_HAND_FEE());
        assertEq(nextLotIndex, 1);
        assertEq(lotIndex, 1);
        assertEq(amountRemaining, secondLotAmount);
        assertLt(holdingSeconds, 5 minutes);
        assertEq(uint8(nextTier), uint8(DiamondHandHook.LoyaltyTier.PaperHand));
        assertEq(nextFee, hook.PAPER_HAND_FEE());
    }

    function _addLiquidity() internal {
        int24 tickLower = TickMath.minUsableTick(poolKey.tickSpacing);
        int24 tickUpper = TickMath.maxUsableTick(poolKey.tickSpacing);
        uint128 liquidityAmount = 100e18;

        (uint256 amount0Expected, uint256 amount1Expected) = LiquidityAmounts.getAmountsForLiquidity(
            Constants.SQRT_PRICE_1_1,
            TickMath.getSqrtPriceAtTick(tickLower),
            TickMath.getSqrtPriceAtTick(tickUpper),
            liquidityAmount
        );

        positionManager.mint(
            poolKey,
            tickLower,
            tickUpper,
            liquidityAmount,
            amount0Expected + 1,
            amount1Expected + 1,
            address(this),
            block.timestamp,
            abi.encode(address(this))
        );
    }

    function _buy() internal {
        _buyAmount(1e18);
    }

    function _sell() internal {
        _sellAmount(1e17);
    }

    function _buyAmount(uint256 amount) internal {
        swapRouter.swapExactTokensForTokens({
            amountIn: amount,
            amountOutMin: 0,
            zeroForOne: false,
            poolKey: poolKey,
            hookData: abi.encode(address(this)),
            receiver: address(this),
            deadline: block.timestamp + 1
        });
    }

    function _sellAmount(uint256 amount) internal {
        swapRouter.swapExactTokensForTokens({
            amountIn: amount,
            amountOutMin: 0,
            zeroForOne: true,
            poolKey: poolKey,
            hookData: abi.encode(address(this)),
            receiver: address(this),
            deadline: block.timestamp + 1
        });
    }
}
