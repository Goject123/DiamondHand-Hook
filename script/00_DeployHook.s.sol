// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";

import {console2} from "forge-std/Script.sol";
import {BaseScript} from "./base/BaseScript.sol";

import {DiamondHandHook} from "../src/DiamondHandHook.sol";

/// @notice Mines the address and deploys the DiamondHandHook.sol Hook contract
contract DeployHookScript is BaseScript {
    function run() public {
        // hook contracts must have specific flags encoded in the address
        uint160 flags = uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG);

        // Mine a salt that will produce a hook address with the correct flags
        bytes memory constructorArgs = abi.encode(poolManager);
        (address hookAddress, bytes32 salt) =
            HookMiner.find(CREATE2_FACTORY, flags, type(DiamondHandHook).creationCode, constructorArgs);

        bytes memory creationCodeWithArgs = abi.encodePacked(type(DiamondHandHook).creationCode, constructorArgs);

        // Deploy the hook through the canonical CREATE2 factory used by HookMiner.
        vm.startBroadcast();
        (bool success, bytes memory returnData) = CREATE2_FACTORY.call(abi.encodePacked(salt, creationCodeWithArgs));
        vm.stopBroadcast();

        require(success, "DeployHookScript: CREATE2 deployment failed");
        address deployedHook = hookAddress;
        require(returnData.length == 20, "DeployHookScript: unexpected CREATE2 return data");
        require(deployedHook == hookAddress, "DeployHookScript: Hook Address Mismatch");

        console2.log("HOOK_CONTRACT=", deployedHook);
    }
}
