// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";
import {IPermit2} from "permit2/src/interfaces/IPermit2.sol";

import {console2} from "forge-std/Script.sol";
import {BaseScript} from "../base/BaseScript.sol";
import {AddressConstants} from "hookmate/constants/AddressConstants.sol";
import {V4PoolManagerDeployer} from "hookmate/artifacts/V4PoolManager.sol";
import {V4PositionManagerDeployer} from "hookmate/artifacts/V4PositionManager.sol";
import {V4RouterDeployer} from "hookmate/artifacts/V4Router.sol";

contract DeployLocalV4 is BaseScript {
    function run() public {
        require(block.chainid == 31337, "Local deployment only");
        /**
         * Important:
         *
         * This script deploys the Uniswap V4 artifacts to local Anvil network.
         * That said, scripts in this repo will NOT automatically use these deployments,
         * unless you also change the addresses in the `Deployers.sol` file.
         *
         * You can override or modify the following functions with your own deployments:
         * - deployPoolManager()
         * - deployPositionManager()
         * - deployRouter()
         *
         * Permit2 is always on the same address.
         */

        vm.startBroadcast();
        deployArtifacts();
        vm.stopBroadcast();

        console2.log("Deployed Permit2 at:", address(permit2));
        console2.log("Deployed V4PoolManager at:", address(poolManager));
        console2.log("Deployed V4PositionManager at:", address(positionManager));
        console2.log("Deployed V4SwapRouter at:", address(swapRouter));
    }
}

contract DeployTestnetV4 is BaseScript {
    function run() public {
        require(block.chainid != 31337, "Use DeployLocalV4 for Anvil");

        address permit2Address = AddressConstants.getPermit2Address();
        require(permit2Address.code.length > 0, "Permit2 missing on this chain");

        vm.startBroadcast();
        address deployedPoolManager = V4PoolManagerDeployer.deploy(msg.sender);
        address deployedPositionManager =
            V4PositionManagerDeployer.deploy(deployedPoolManager, permit2Address, 300_000, address(0), address(0));
        address deployedRouter = V4RouterDeployer.deploy(deployedPoolManager, permit2Address);
        vm.stopBroadcast();

        console2.log("PERMIT2=", permit2Address);
        console2.log("POOL_MANAGER=", deployedPoolManager);
        console2.log("POSITION_MANAGER=", deployedPositionManager);
        console2.log("V4_SWAP_ROUTER=", deployedRouter);
    }

    function deployPoolManager() internal override {}

    function deployPositionManager() internal override {}

    function deployRouter() internal override {}
}
