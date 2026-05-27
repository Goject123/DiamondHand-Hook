# DiamondHand Loyalty Hook Submission Notes

## Hackathon Fit

Target event: Build X Hackathon, Hook edition.

The official requirements say projects must be built around the Uniswap v4 Hook mechanism, deployed on X Layer, and include at least one verifiable V4 Pool and Hook contract address. They also require a dedicated X/Twitter account that tags `@XLayerOfficial`, `@Uniswap`, and `@flapdotsh` in the submission post.

## Project Summary

DiamondHand Loyalty Hook discourages instant dumping and rewards longer holding behavior.

Flow:

1. User buys the project token through a Uniswap v4 pool.
2. `DiamondHandHook` creates a holding lot for each buy, with amount and timestamp.
3. When the user sells, `beforeSwap` classifies the oldest active FIFO lot.
4. The Hook returns a dynamic LP fee override:
   - Paper Hand: sell within 5 minutes, 3.0% fee.
   - Holder: hold 5-30 minutes, 1.5% fee.
   - Diamond Hand: hold 30+ minutes, 0.3% fee.
5. The frontend displays the live tier, fee preview, next FIFO lot, balances, and deployment proof.

## Submission Checklist

- [x] Hook contract compiles with Foundry.
- [x] Hook tests pass.
- [x] V4 Pool deployed on X Layer testnet.
- [x] Hook deployed on X Layer testnet.
- [x] At least one buy transaction triggers `BuyRecorded`.
- [x] At least one sell transaction triggers `SellClassified`.
- [x] Frontend proof section updated with contract and transaction links.
- [ ] GitHub repository public.
- [ ] Demo video recorded, recommended 1-3 minutes.
- [ ] Dedicated X/Twitter account created.
- [ ] Submission post tags `@XLayerOfficial`, `@Uniswap`, and `@flapdotsh`.

## Demo Video Script

1. Introduce the problem: short-term dumping hurts community-token liquidity.
2. Show the Hook mechanism: holding time controls the swap fee.
3. Connect wallet in Judge Demo Mode.
4. Buy DHC and show buy-time recording.
5. Try selling and show fee classification from the Hook.
6. Simulate or wait for the Diamond tier and show fee reduction.
7. Show holding lots, trade proof, contract addresses, and AI report.

## Required Proof Fields

Use these in the final submission:

- Network: X Layer Testnet, chain ID 1952
- PoolManager: `0xf3bFA4955df463292387c2DA2892D2368B73fB86`
- PositionManager: `0xEeb890918b257a6f74bA5B367500EaE4B4ebD35E`
- V4 Swap Router: `0x376828714CbE0b9e3C014cf9b8469616Fd43E93c`
- Hook Contract: `0xc79470484a1D2e3f5C95A14DbfffC1F5Bb8900c0`
- Token0: `0x83206655800fa69A5ECB5C80bd83895f8f4eB4B9`
- Token1: `0xad95B03a2c86A8bdD5ADF18a03A35c197Feecd42`
- Hook deploy tx: `0xdb519b545defb46dbcb6018572f17baf836aba3e5ceae1aae8ee82568f30d09d`
- Pool + liquidity tx: `0x9bdfba01da3cdcaa5a7bb7623232608f63c8c84a1f51d6ff2b8669871bd332ad`
- Buy trigger tx: `0xa2b507ba2d26dd800d609aacb37555366ee93284911ee19489faba27b323550c`
- Sell trigger tx: `0x9d0c03ecd68d772caba4d52b6fcddc4627352d8199c82b1a390ba3d582e4f616`
- Explorer: `https://www.okx.com/web3/explorer/xlayer-test`
- GitHub: pending public repository URL
- Demo Video: pending
- X/Twitter: pending

## Local Commands

Foundry is installed locally under `.tools/foundry` for this workspace.

```powershell
& '.tools\foundry\forge.exe' build
& '.tools\foundry\forge.exe' test -vvv
```

Frontend:

```powershell
npm run build
npm run dev
```

## X Layer Deployment Inputs

Create `.env.local` before deployment:

```env
X_LAYER_RPC_URL=https://testrpc.xlayer.tech/terigon
PRIVATE_KEY=0x...

POOL_MANAGER=
POSITION_MANAGER=
V4_SWAP_ROUTER=

TOKEN0=
TOKEN1=
HOOK_CONTRACT=
```

Deployment flow:

1. Confirm or deploy X Layer PoolManager, PositionManager, Permit2, and swap router addresses.
2. Put those addresses into `.env.local`.
3. Deploy demo ERC20 tokens and put them into `TOKEN0` / `TOKEN1`.
4. Deploy `DiamondHandHook` with `script/00_DeployHook.s.sol`.
5. Put the deployed hook address into `HOOK_CONTRACT`.
6. Create a dynamic-fee V4 pool with `script/01_CreatePoolAndAddLiquidity.s.sol`.
7. Run at least one buy with `script/03_Swap.s.sol` and one sell with `script/04_Sell.s.sol`.
8. Copy the verified addresses and transaction hash into the homepage proof section.
