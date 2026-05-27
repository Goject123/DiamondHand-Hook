# DiamondHand Hook

DiamondHand Hook is a Uniswap v4 Hook that turns holding time into better trading terms.

Instead of treating every sell the same, the Hook tracks each buy as its own holding lot. When a user sells, the oldest active lot is consumed first, and the sell fee is based on how long that lot was actually held.

The result is a simple market rule: fast exits pay more, real holders pay less.

## Why This Exists

Many launch assets and community tokens struggle with the same pattern: early attention brings liquidity, but fast exits can damage the market before real users have time to form.

DiamondHand Hook does not block selling and does not rely on off-chain reputation. It adds a transparent rule directly into the pool:

- Short holding time: higher sell fee.
- Medium holding time: reduced sell fee.
- Long holding time: lowest sell fee.

This makes holding behavior visible, enforceable, and verifiable at swap execution time.

## Core Mechanism

Each buy creates a separate holding lot.

Each lot stores:

- remaining DHC amount
- buy timestamp

When the user sells DHC, the Hook uses FIFO accounting:

1. Find the oldest active lot.
2. Calculate how long that lot has been held.
3. Apply the matching dynamic LP fee override.
4. Consume that lot before moving to the next one.

This avoids the common averaging problem. A user cannot buy 1 DHC, wait 30 minutes, then buy 100 DHC and receive the lower fee on the whole position. Only the older lot receives the better fee.

## Fee Tiers

| Holding Time | Sell Fee | Tier |
| ---: | ---: | --- |
| Less than 5 minutes | 3.0% | Paper Hand |
| 5 to 30 minutes | 1.5% | Holder |
| 30 minutes or more | 0.3% | Diamond Hand |

## Example

```text
10:00  Buy 1 DHC      -> Lot #0 starts
10:31  Buy 100 DHC    -> Lot #1 starts
10:36  Sell 1 DHC     -> Lot #0 is consumed first
```

The sell pays the Diamond Hand fee because Lot #0 was held for 36 minutes. Lot #1 remains separate and still has its own holding clock.

## Live Testnet Deployment

Network: X Layer Testnet  
Chain ID: `1952`  
RPC: `https://testrpc.xlayer.tech/terigon`  
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

Proof transactions:

| Action | Transaction |
| --- | --- |
| Hook deploy | `0xdb519b545defb46dbcb6018572f17baf836aba3e5ceae1aae8ee82568f30d09d` |
| Pool creation and liquidity | `0x9bdfba01da3cdcaa5a7bb7623232608f63c8c84a1f51d6ff2b8669871bd332ad` |
| Buy trigger | `0xa2b507ba2d26dd800d609aacb37555366ee93284911ee19489faba27b323550c` |
| Sell trigger | `0x9d0c03ecd68d772caba4d52b6fcddc4627352d8199c82b1a390ba3d582e4f616` |

## Web App

The frontend provides a testnet trading interface for the Hook:

1. Connect wallet.
2. Switch to X Layer Testnet.
3. Get test OKB if needed.
4. Spend XLUSD to buy DHC.
5. View the next FIFO lot and current sell fee.
6. Sell DHC and inspect the resulting transaction proof.

The app is intentionally built around the core workflow instead of a static landing page.

## Repository Layout

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

Run Hook tests:

```powershell
& '.tools\foundry\forge.exe' test
```

If Foundry is installed globally:

```powershell
forge test
```

## Environment

Create `.env.local` for deployment or scripted testnet interactions:

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

Never commit `.env.local` or private keys.

## License

MIT.
