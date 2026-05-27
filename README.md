# DiamondHand Hook

DiamondHand Hook is a Uniswap v4 Hook deployed on X Layer Testnet. It rewards longer holding behavior by lowering the sell fee for users who hold the demo token longer before selling.

This project was built for the Hook the Future / Build X Hackathon track.

## Why It Exists

Many new on-chain assets suffer from immediate sell pressure after launch. A normal pool treats every seller the same, whether they held for seconds or helped the market stay stable.

DiamondHand Hook makes holding time part of the pool behavior:

- Fast sellers pay a higher sell fee.
- Medium-term holders pay a lower sell fee.
- Long-term holders get the lowest sell fee.

The goal is not to block selling. The goal is to make the market structure reward patient liquidity and make the rule visible, verifiable, and triggered by real swaps.

## Hook Mechanism

When a wallet buys through the Uniswap v4 pool, `DiamondHandHook` records the buy timestamp. When the same wallet sells, the Hook classifies the holding duration inside `beforeSwap` and returns a dynamic LP fee override.

Fee tiers:

| Holder Type | Holding Time | Sell Fee |
| --- | ---: | ---: |
| Paper Hand | Less than 5 minutes | 3.0% |
| Holder | 5 to 30 minutes | 1.5% |
| Diamond Hand | 30 minutes or more | 0.3% |

This turns the Hook into a programmable loyalty layer for community tokens, launch assets, and other markets where holding behavior matters.

## Interactive Testnet Demo

The frontend is designed as a judge-facing workbench, not a static landing page. The main actions are the actions a tester needs to experience the Hook:

1. Connect wallet.
2. Add X Layer Testnet.
3. Get test OKB from the X Layer faucet.
4. Mint demo tokens.
5. Buy through the Hook pool.
6. Sell through the Hook pool and see the fee tier update.

Network details:

- Network: X Layer Testnet
- Chain ID: `1952`
- RPC: `https://testrpc.xlayer.tech/terigon`
- Currency: `OKB`
- Explorer: `https://www.okx.com/web3/explorer/xlayer-test`
- Faucet: `https://web3.okx.com/xlayer/faucet`

This is a testnet demo only. The demo tokens have no real value.

## Deployment Proof

X Layer Testnet addresses:

| Contract | Address |
| --- | --- |
| PoolManager | `0xf3bFA4955df463292387c2DA2892D2368B73fB86` |
| PositionManager | `0xEeb890918b257a6f74bA5B367500EaE4B4ebD35E` |
| V4 Swap Router | `0x376828714CbE0b9e3C014cf9b8469616Fd43E93c` |
| DiamondHand Hook | `0x6180981dca55E69e62baAfEC995646d9F8c540C0` |
| Token0 | `0x83206655800fa69A5ECB5C80bd83895f8f4eB4B9` |
| Token1 | `0xad95B03a2c86A8bdD5ADF18a03A35c197Feecd42` |

Transactions:

| Action | Transaction |
| --- | --- |
| Hook deploy | `0xe439c515c63ae4ec8f7ca5ffed4064b4a982e7a7fe53b9a7cad3bce401556fc9` |
| Pool creation and liquidity | `0x1cbffff88ebc5f12e73ca9900e84b742ddf59d7779a618e836b9241f26fc5914` |
| Buy trigger | `0x59ffca7a4f4ac077feaed57b3f49c3efc86169cec0b9ae166abe803b9e1f3487` |
| Sell trigger | `0x56a24cc5bb0183a29b28dd69670482b87f7bf67dfa2176673740e3f7316e393e` |

## Project Structure

```text
app/                 Next.js frontend workbench
src/                 DiamondHandHook Solidity contract
test/                Foundry tests
script/              Deployment and testnet interaction scripts
scripts/             Local PowerShell helpers
SUBMISSION.md        Hackathon submission notes and proof fields
```

## Local Development

Install frontend dependencies:

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

Run Foundry tests:

```powershell
& '.tools\foundry\forge.exe' test
```

If Foundry is installed globally, this also works:

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
HOOK_CONTRACT=0x6180981dca55E69e62baAfEC995646d9F8c540C0
```

Do not commit `.env.local` or private keys.

## License

MIT. This project started from the Uniswap v4 Hook template and was adapted into the DiamondHand Hook hackathon submission.
