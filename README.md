# DiamondHand Hook

English | [中文](./README.zh-CN.md)

DiamondHand Hook is a Uniswap v4 Hook that turns real holding time into better sell terms.

Instead of treating every sell the same way, DiamondHand Hook tracks each DHC buy as its own FIFO lot. When a user sells DHC, the Hook consumes the oldest active lot first and applies the fee based on how long that specific lot has actually been held.

In plain terms: sell quickly, pay more; hold longer, pay less.

## Why It Exists

New assets and early-stage markets usually want two things at the same time:

- open trading
- healthier holding behavior

DiamondHand Hook keeps trading open, but changes the sell cost according to real on-chain holding time. It does not rely on off-chain points, allowlists, or wallet-level averages.

That matters because wallet averages are easy to game. A user should not be able to buy `1 DHC`, wait 30 minutes, then buy `100 DHC` and make the full position look like a long hold. DiamondHand Hook avoids that by evaluating each buy lot separately.

## Core Mechanism

Every buy creates an independent lot.

Each lot records:

- remaining DHC amount
- buy timestamp

When a user sells DHC, the Hook applies FIFO accounting:

1. Find the oldest active lot.
2. Measure how long that lot has been held.
3. Select the fee tier for that lot.
4. Consume that lot first, then continue into later lots if needed.

This means fee logic follows the actual inventory being sold, not the wallet's overall history.

## Fee Tiers

The current testnet deployment uses these demo tiers:

| Holding time | Sell fee | Tier |
| ---: | ---: | --- |
| Less than 5 minutes | 3.0% | Paper Hand |
| 5 to 30 minutes | 1.5% | Holder |
| 30 minutes or more | 0.3% | Diamond Hand |

These tiers are configurable deployment parameters. A production pool could use different time windows and fee levels depending on the asset and market design.

## Example

```text
10:00  Buy 1 DHC      -> Create Lot #0
10:31  Buy 100 DHC    -> Create Lot #1
10:36  Sell 1 DHC     -> Consume Lot #0 first
```

That sell uses the `Diamond Hand` tier because `Lot #0` has been held for 36 minutes. `Lot #1` keeps its own timestamp and fee state.

## Live Demo

Web app: [diamond-hand-hook.vercel.app](https://diamond-hand-hook.vercel.app/)

The frontend is a real X Layer Testnet trading demo, not a static concept page.

Main demo flow:

1. Connect wallet.
2. Switch to X Layer Testnet.
3. Get test OKB if gas is missing.
4. Prepare XLUSD if buy-side funds are missing.
5. Buy DHC with XLUSD.
6. Enter any sell amount to preview the estimated blended sell fee across active FIFO lots.
7. Sell DHC and verify the transaction on the explorer.

Current frontend behavior:

- each buy creates a new FIFO lot
- consumed lots are ignored in active sell preview
- sell preview estimates the blended fee for the entered sell size
- if sell amount is empty, the UI can treat `Max` as all active DHC
- language toggle is available in the app

## Testnet Deployment

Network: X Layer Testnet  
Chain ID: `1952`  
Recommended RPC: `https://testrpc.xlayer.tech/terigon`  
Official alternative RPC: `https://xlayertestrpc.okx.com/terigon`  
Explorer: `https://www.okx.com/web3/explorer/xlayer-test`  
Faucet: `https://web3.okx.com/xlayer/faucet`

| Contract | Address |
| --- | --- |
| PoolManager | `0xf3bFA4955df463292387c2DA2892D2368B73fB86` |
| PositionManager | `0xEeb890918b257a6f74bA5B367500EaE4B4ebD35E` |
| V4 Swap Router | `0x376828714CbE0b9e3C014cf9b8469616Fd43E93c` |
| DiamondHand Hook | `0xc79470484a1D2e3f5C95A14DbfffC1F5Bb8900c0` |
| DHC | `0x83206655800fa69A5ECB5C80bd83895f8f4eB4B9` |
| XLUSD | `0xad95B03a2c86A8bdD5ADF18a03A35c197Feecd42` |

On-chain proof:

| Action | Transaction |
| --- | --- |
| Hook deployment | `0xdb519b545defb46dbcb6018572f17baf836aba3e5ceae1aae8ee82568f30d09d` |
| Pool creation and liquidity | `0x9bdfba01da3cdcaa5a7bb7623232608f63c8c84a1f51d6ff2b8669871bd332ad` |
| Buy triggers Hook | `0xa2b507ba2d26dd800d609aacb37555366ee93284911ee19489faba27b323550c` |
| Sell triggers Hook | `0x9d0c03ecd68d772caba4d52b6fcddc4627352d8199c82b1a390ba3d582e4f616` |

## Project Structure

```text
app/        Next.js frontend
src/        Solidity Hook contract
test/       Foundry tests
script/     Deployment and interaction scripts
scripts/    Local helper scripts
```

## Local Development

Install dependencies:

```powershell
npm install
```

Run the frontend:

```powershell
npm run dev
```

Build the frontend:

```powershell
npm run build
```

Run contract tests:

```powershell
& '.tools\foundry\forge.exe' test
```

If Foundry is installed globally, this also works:

```powershell
forge test
```

## Environment Variables

Create `.env.local` before running deployment or interaction scripts:

```env
X_LAYER_RPC_URL=https://testrpc.xlayer.tech/terigon
PRIVATE_KEY=0x...

POOL_MANAGER=0xf3bFA4955df463292387c2DA2892D2368B73fB86
POSITION_MANAGER=0xEeb890918b257a6f74bA5B367500EaE4B4ebD35E
V4_SWAP_ROUTER=0x376828714CbE0b9e3C014cf9b8469616Fd43E93c

TOKEN0=0x83206655800fa69A5ECB5C80bd83895f8f4eB4B9
TOKEN1=0xad95B03a2c86A8bdD5ADF18a03A35c197Feecd42
HOOK_CONTRACT=0xc79470484a1D2e3f5C95A14DbfffC1F5Bb8900c0
```

Do not commit `.env.local` or any private key.

## License

MIT
