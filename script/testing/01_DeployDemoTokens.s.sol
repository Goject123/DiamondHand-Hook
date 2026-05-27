// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {console2, Script} from "forge-std/Script.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";

contract DeployDemoTokens is Script {
    function run() external {
        vm.startBroadcast();

        MockERC20 community = new MockERC20("Diamond Hand Community", "DHC", 18);
        MockERC20 quote = new MockERC20("X Layer Demo Dollar", "XLUSD", 18);

        community.mint(msg.sender, 1_000_000 ether);
        quote.mint(msg.sender, 1_000_000 ether);

        vm.stopBroadcast();

        address token0 = address(community) < address(quote) ? address(community) : address(quote);
        address token1 = address(community) < address(quote) ? address(quote) : address(community);

        console2.log("COMMUNITY_TOKEN=", address(community));
        console2.log("QUOTE_TOKEN=", address(quote));
        console2.log("TOKEN0=", token0);
        console2.log("TOKEN1=", token1);
    }
}
