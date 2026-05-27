"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Activity,
  BadgeCheck,
  CircleDollarSign,
  Clock3,
  Diamond,
  ExternalLink,
  FileCode2,
  Fuel,
  Github,
  Languages,
  LineChart,
  Network,
  Play,
  RefreshCcw,
  ShieldCheck,
  Timer,
  Wallet,
} from "lucide-react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  encodeAbiParameters,
  formatEther,
  http,
  parseEther,
  type Address,
  type Hash,
} from "viem";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

const xLayerTestnet = {
  id: 1952,
  name: "X Layer Testnet",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testrpc.xlayer.tech/terigon"] },
    public: { http: ["https://testrpc.xlayer.tech/terigon"] },
  },
  blockExplorers: {
    default: { name: "OKX Explorer", url: "https://www.okx.com/web3/explorer/xlayer-test" },
  },
} as const;

const explorerBase = xLayerTestnet.blockExplorers.default.url;
const faucetUrl = "https://web3.okx.com/xlayer/faucet";

const contracts = {
  poolManager: "0xf3bFA4955df463292387c2DA2892D2368B73fB86" as Address,
  positionManager: "0xEeb890918b257a6f74bA5B367500EaE4B4ebD35E" as Address,
  router: "0x376828714CbE0b9e3C014cf9b8469616Fd43E93c" as Address,
  hook: "0x6180981dca55E69e62baAfEC995646d9F8c540C0" as Address,
  token0: "0x83206655800fa69A5ECB5C80bd83895f8f4eB4B9" as Address,
  token1: "0xad95B03a2c86A8bdD5ADF18a03A35c197Feecd42" as Address,
} as const;

const poolKey = {
  currency0: contracts.token0,
  currency1: contracts.token1,
  fee: 8388608,
  tickSpacing: 60,
  hooks: contracts.hook,
} as const;

const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

const hookAbi = [
  {
    type: "function",
    name: "previewFee",
    stateMutability: "view",
    inputs: [
      { name: "trader", type: "address" },
      {
        name: "key",
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
      },
    ],
    outputs: [
      { name: "tier", type: "uint8" },
      { name: "fee", type: "uint24" },
    ],
  },
  {
    type: "function",
    name: "diamondScore",
    stateMutability: "view",
    inputs: [
      { name: "trader", type: "address" },
      {
        name: "key",
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
      },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

const routerAbi = [
  {
    type: "function",
    name: "swapExactTokensForTokens",
    stateMutability: "payable",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "zeroForOne", type: "bool" },
      {
        name: "poolKey",
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
      },
      { name: "hookData", type: "bytes" },
      { name: "receiver", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ type: "int256" }],
  },
] as const;

const publicClient = createPublicClient({
  chain: xLayerTestnet,
  transport: http(xLayerTestnet.rpcUrls.default.http[0]),
});

const tiers = [
  { title: "Paper Hand", rule: "Sell within 5 minutes", fee: "3.0%", tone: "red" },
  { title: "Holder", rule: "Hold 5-30 minutes", fee: "1.5%", tone: "gold" },
  { title: "Diamond Hand", rule: "Hold 30+ minutes", fee: "0.3%", tone: "green" },
] as const;

const proofRows = [
  ["Network", "X Layer Testnet"],
  ["PoolManager", contracts.poolManager],
  ["PositionManager", contracts.positionManager],
  ["V4 Router", contracts.router],
  ["Hook Contract", contracts.hook],
  ["Token0", contracts.token0],
  ["Token1", contracts.token1],
] as const;

const txRows = [
  ["Hook deploy", "0xe439c515c63ae4ec8f7ca5ffed4064b4a982e7a7fe53b9a7cad3bce401556fc9"],
  ["Pool + liquidity", "0x1cbffff88ebc5f12e73ca9900e84b742ddf59d7779a618e836b9241f26fc5914"],
  ["Buy trigger", "0x59ffca7a4f4ac077feaed57b3f49c3efc86169cec0b9ae166abe803b9e1f3487"],
  ["Sell trigger", "0x56a24cc5bb0183a29b28dd69670482b87f7bf67dfa2176673740e3f7316e393e"],
] as const;

const tierLabels = ["Paper Hand", "Holder", "Diamond Hand"] as const;

function shortAddress(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatToken(value: bigint) {
  return Number(formatEther(value)).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export default function Home() {
  const [account, setAccount] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [okbBalance, setOkbBalance] = useState<bigint>(BigInt(0));
  const [token0Balance, setToken0Balance] = useState<bigint>(BigInt(0));
  const [token1Balance, setToken1Balance] = useState<bigint>(BigInt(0));
  const [tier, setTier] = useState<number>(0);
  const [fee, setFee] = useState<number>(30000);
  const [score, setScore] = useState<bigint>(BigInt(0));
  const [lastTx, setLastTx] = useState<Hash | null>(null);
  const [status, setStatus] = useState("Connect a wallet to run the X Layer testnet demo.");
  const [busy, setBusy] = useState<string | null>(null);

  const walletReady = account && chainId === xLayerTestnet.id;
  const feePercent = `${(fee / 10000).toFixed(1)}%`;
  const hookData = useMemo(
    () => (account ? encodeAbiParameters([{ type: "address" }], [account]) : "0x"),
    [account],
  );

  const walletClient = useMemo(() => {
    if (typeof window === "undefined" || !window.ethereum) return null;
    return createWalletClient({
      account: account ?? undefined,
      chain: xLayerTestnet,
      transport: custom(window.ethereum),
    });
  }, [account]);

  const refresh = useCallback(
    async (target = account) => {
      if (!target) return;
      const [native, token0, token1, preview, diamondScore] = await Promise.all([
        publicClient.getBalance({ address: target }),
        publicClient.readContract({ address: contracts.token0, abi: erc20Abi, functionName: "balanceOf", args: [target] }),
        publicClient.readContract({ address: contracts.token1, abi: erc20Abi, functionName: "balanceOf", args: [target] }),
        publicClient.readContract({ address: contracts.hook, abi: hookAbi, functionName: "previewFee", args: [target, poolKey] }),
        publicClient.readContract({ address: contracts.hook, abi: hookAbi, functionName: "diamondScore", args: [target, poolKey] }),
      ]);

      setOkbBalance(native);
      setToken0Balance(token0);
      setToken1Balance(token1);
      setTier(Number(preview[0]));
      setFee(Number(preview[1]));
      setScore(diamondScore);
    },
    [account],
  );

  async function connectWallet() {
    if (!window.ethereum) {
      setStatus("No wallet found. Install OKX Wallet or MetaMask first.");
      return;
    }

    const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as Address[];
    const hexChain = (await window.ethereum.request({ method: "eth_chainId" })) as string;
    const nextAccount = accounts[0];

    setAccount(nextAccount);
    setChainId(Number.parseInt(hexChain, 16));
    setStatus("Wallet connected. Switch to X Layer Testnet if needed.");
    await refresh(nextAccount);
  }

  async function switchNetwork() {
    if (!window.ethereum) return;
    const chainHex = `0x${xLayerTestnet.id.toString(16)}`;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainHex }],
      });
    } catch {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: chainHex,
            chainName: xLayerTestnet.name,
            nativeCurrency: xLayerTestnet.nativeCurrency,
            rpcUrls: xLayerTestnet.rpcUrls.default.http,
            blockExplorerUrls: [explorerBase],
          },
        ],
      });
    }
    setChainId(xLayerTestnet.id);
    setStatus("X Layer Testnet is active.");
    await refresh();
  }

  async function runTx(label: string, action: () => Promise<Hash>) {
    if (!walletReady || !account || !walletClient) {
      setStatus("Connect wallet and switch to X Layer Testnet first.");
      return;
    }

    try {
      setBusy(label);
      setStatus(`${label} transaction is waiting for wallet confirmation.`);
      const hash = await action();
      setLastTx(hash);
      setStatus(`${label} submitted. Waiting for confirmation...`);
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus(`${label} confirmed on X Layer Testnet.`);
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `${label} failed.`);
    } finally {
      setBusy(null);
    }
  }

  async function mintDemoTokens() {
    await runTx("Mint test tokens", async () => {
      const hash0 = await walletClient!.writeContract({
        account: account!,
        address: contracts.token0,
        abi: erc20Abi,
        functionName: "mint",
        args: [account!, parseEther("1000")],
      });
      await publicClient.waitForTransactionReceipt({ hash: hash0 });
      return walletClient!.writeContract({
        account: account!,
        address: contracts.token1,
        abi: erc20Abi,
        functionName: "mint",
        args: [account!, parseEther("1000")],
      });
    });
  }

  async function approveToken(token: Address) {
    const hash = await walletClient!.writeContract({
      account: account!,
      address: token,
      abi: erc20Abi,
      functionName: "approve",
      args: [contracts.router, parseEther("1000000")],
    });
    await publicClient.waitForTransactionReceipt({ hash });
  }

  async function buyThroughHook() {
    await runTx("Buy through Hook pool", async () => {
      await approveToken(contracts.token0);
      return walletClient!.writeContract({
        account: account!,
        address: contracts.router,
        abi: routerAbi,
        functionName: "swapExactTokensForTokens",
        args: [parseEther("1"), BigInt(0), true, poolKey, hookData, account!, BigInt(Math.floor(Date.now() / 1000) + 3600)],
      });
    });
  }

  async function sellThroughHook() {
    await runTx("Sell through Hook pool", async () => {
      await approveToken(contracts.token1);
      return walletClient!.writeContract({
        account: account!,
        address: contracts.router,
        abi: routerAbi,
        functionName: "swapExactTokensForTokens",
        args: [parseEther("0.1"), BigInt(0), false, poolKey, hookData, account!, BigInt(Math.floor(Date.now() / 1000) + 3600)],
      });
    });
  }

  return (
    <main className="page-shell">
      <nav className="nav" aria-label="Primary navigation">
        <div className="nav-inner">
          <a className="brand" href="#home">
            <span className="brand-mark">
              <Diamond size={18} />
            </span>
            DiamondHand Hook
          </a>
          <div className="nav-links">
            <a href="#demo">Demo</a>
            <a href="#fees">Fees</a>
            <a href="#proof">Proof</a>
          </div>
          <div className="nav-actions">
            <button className="icon-button" aria-label="Switch language" title="Switch language">
              <Languages size={18} />
            </button>
            <button className="ghost-button connect-button" onClick={connectWallet}>
              <Wallet size={17} />
              {account ? shortAddress(account) : "Connect Wallet"}
            </button>
          </div>
        </div>
      </nav>

      <section id="home" className="hero hero-centered">
        <div>
          <div className="eyebrow">
            <ShieldCheck size={16} />
            Live testnet demo on X Layer
          </div>
          <h1>Try the Hook with your wallet</h1>
          <p className="hero-copy">
            Connect a wallet, mint demo tokens, buy through the v4 pool, then sell to trigger
            DiamondHandHook on X Layer Testnet.
          </p>
          <div className="hero-actions">
            <button className="pill-button" onClick={connectWallet}>
              <Wallet size={17} />
              {account ? "Wallet Connected" : "Connect Wallet"}
            </button>
            <button className="ghost-button" onClick={switchNetwork}>
              <Network size={17} />
              Add X Layer Testnet
            </button>
            <a className="ghost-button" href={faucetUrl} target="_blank">
              <Fuel size={17} />
              Get Test OKB
            </a>
            <a className="ghost-button" href="#proof">
              <FileCode2 size={17} />
              View Proof
            </a>
          </div>
          <div className="proof-line" aria-label="Project proof summary">
            <span>Testnet interactive</span>
            <span>Dynamic fee: 0.3%-3%</span>
            <span>Hook deployed</span>
          </div>
        </div>
      </section>

      <section id="demo" className="section tool-section" aria-labelledby="tool-title">
        <aside className="demo-console tool-workbench" aria-label="Interactive demo console">
          <div className="console-top">
            <div>
              <span>Testnet Demo Runner</span>
              <strong id="tool-title">DiamondHand Hook Workbench</strong>
            </div>
            <div className="tool-badges">
              <span className={walletReady ? "ready" : ""}>{walletReady ? "Network ready" : "Network required"}</span>
              <span>{account ? shortAddress(account) : "No wallet"}</span>
            </div>
          </div>

          <div className="utility-bar" aria-label="Testnet setup utilities">
            <button className="ghost-button" onClick={connectWallet}>
              <Wallet size={16} />
              {account ? shortAddress(account) : "Connect Wallet"}
            </button>
            <button className="ghost-button" onClick={switchNetwork}>
              <Network size={16} />
              X Layer Testnet
            </button>
            <a className="ghost-button" href={faucetUrl} target="_blank">
              <Fuel size={16} />
              Get Test OKB
            </a>
          </div>

          <div className="runner-grid">
            <div className="runner-steps core-actions" aria-label="Hook actions">
              <div className="tool-column-title">
                <span>Core Actions</span>
                <em>Real testnet transactions</em>
              </div>
              <button
                className={`runner-step core-action ${token0Balance > BigInt(0) && token1Balance > BigInt(0) ? "done" : ""}`}
                disabled={!!busy}
                onClick={mintDemoTokens}
              >
                <span className="runner-index">
                  <CircleDollarSign size={18} />
                </span>
                <span>
                  <strong>Mint demo tokens</strong>
                  <em>Claim DHC and XLUSD for this demo wallet.</em>
                </span>
              </button>
              <button className="runner-step core-action action" disabled={!!busy} onClick={buyThroughHook}>
                <span className="runner-index">
                  <Play size={18} />
                </span>
                <span>
                  <strong>Buy through Hook</strong>
                  <em>Swap through the v4 pool and record first buy time.</em>
                </span>
              </button>
              <button className="runner-step core-action action sell" disabled={!!busy} onClick={sellThroughHook}>
                <span className="runner-index">
                  <Timer size={18} />
                </span>
                <span>
                  <strong>Sell through Hook</strong>
                  <em>Trigger beforeSwap classification and fee override.</em>
                </span>
              </button>

              <div className="prep-note">
                <span>Before running:</span>
                <strong>{walletReady ? "Wallet and network ready" : "Connect wallet, switch network, and get test OKB from the utility bar."}</strong>
              </div>
            </div>

            <div className="runner-result">
              <div className="result-top">
                <span>Output</span>
                <button className="mini-button" onClick={() => refresh()} disabled={!account || !!busy} title="Refresh">
                  <RefreshCcw size={15} />
                </button>
              </div>
              {account ? (
                <div className="fee-preview-block">
                  <span>Current sell classification</span>
                  <strong>{feePercent}</strong>
                  <em>{tierLabels[tier] ?? "Paper Hand"} fee override</em>
                </div>
              ) : (
                <div className="empty-output">
                  <Wallet size={22} />
                  <strong>Connect wallet to load state</strong>
                  <span>Fee preview, balances, score, and transaction output will appear here.</span>
                </div>
              )}
              <div className="result-metrics">
                <div>
                  <span>Network</span>
                  <strong className={walletReady ? "green" : "red"}>{chainId === 1952 ? "Ready" : "Not ready"}</strong>
                </div>
                <div>
                  <span>OKB gas</span>
                  <strong>{formatToken(okbBalance)}</strong>
                </div>
                <div>
                  <span>DHC</span>
                  <strong>{formatToken(token0Balance)}</strong>
                </div>
                <div>
                  <span>XLUSD</span>
                  <strong>{formatToken(token1Balance)}</strong>
                </div>
                <div>
                  <span>Diamond Score</span>
                  <strong>{score.toString()}</strong>
                </div>
                <div>
                  <span>Last Tx</span>
                  <strong>{lastTx ? shortAddress(lastTx) : "None"}</strong>
                </div>
              </div>
              <div className="network-note compact-note">
                <span>RPC https://testrpc.xlayer.tech/terigon</span>
              </div>
            </div>
          </div>

          <div className="tool-log">
            <span>Status</span>
            <p>{busy ? `${busy}...` : status}</p>
            {lastTx ? (
              <a className="tx-link" href={`${explorerBase}/tx/${lastTx}`} target="_blank">
                Open transaction
                <ExternalLink size={14} />
              </a>
            ) : null}
          </div>
        </aside>
      </section>

      <section className="section section-tight" aria-labelledby="problem-title">
        <div className="problem-band">
          <div className="section-heading">
            <h2 id="problem-title">The product idea</h2>
            <p>
              Community tokens need a market rule that recognizes behavior. This Hook makes fast
              selling more expensive and rewards wallets that actually hold.
            </p>
          </div>
          <div className="problem-answer">
            <span>Hook response</span>
            <strong>Let the pool fee react to holding time at swap execution.</strong>
          </div>
        </div>
      </section>

      <section id="fees" className="section" aria-labelledby="tiers-title">
        <div className="section-heading">
          <h2 id="tiers-title">Fee tiers</h2>
          <p>
            The tiers are intentionally simple so judges can verify the Hook behavior from
            transactions and emitted events.
          </p>
        </div>
        <div className="fee-table">
          {tiers.map((tierItem) => (
            <article className="fee-row" key={tierItem.title}>
              <h3 className={tierItem.tone}>
                <BadgeCheck size={19} />
                {tierItem.title}
              </h3>
              <p>{tierItem.rule}</p>
              <strong>{tierItem.fee}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="mechanism-title">
        <div className="section-heading">
          <h2 id="mechanism-title">What the buttons do</h2>
          <p>
            Each action sends a real X Layer Testnet transaction. The buy records timestamp; the
            sell calls `beforeSwap`, classifies your wallet, and returns a dynamic fee override.
          </p>
        </div>
        <div className="protocol-flow" aria-label="Hook workflow">
          {["Mint demo tokens", "Buy token0 to token1", "Record timestamp", "Sell token1 to token0", "Override fee"].map(
            (item, index) => (
              <div className="protocol-step" key={item}>
                <strong>0{index + 1}</strong>
                <span>{item}</span>
              </div>
            ),
          )}
        </div>
      </section>

      <section className="section" aria-labelledby="fee-preview-title">
        <div className="section-heading">
          <h2 id="fee-preview-title">Sell fee preview</h2>
          <p>The current wallet state is read from `previewFee` and `diamondScore` on the Hook.</p>
        </div>
        <div className="fee-table compact">
          <article className="fee-row">
            <h3>
              <LineChart size={19} />
              Current tier
            </h3>
            <p>{tierLabels[tier] ?? "Paper Hand"}</p>
            <strong>{feePercent}</strong>
          </article>
          <article className="fee-row">
            <h3>
              <Clock3 size={19} />
              Long hold target
            </h3>
            <p>Hold 30+ minutes after buy to unlock Diamond Hand pricing.</p>
            <strong>0.3%</strong>
          </article>
          <article className="fee-row">
            <h3>
              <CircleDollarSign size={19} />
              Demo amount
            </h3>
            <p>Buy uses 1 token0. Sell uses 0.1 token1.</p>
            <strong>Test only</strong>
          </article>
        </div>
      </section>

      <section id="proof" className="section" aria-labelledby="proof-title">
        <div className="section-heading">
          <h2 id="proof-title">Contract proof</h2>
          <p>These are the deployed X Layer Testnet contracts and transactions behind the demo.</p>
        </div>
        <div className="proof">
          <div className="proof-feed">
            <div className="proof-feed-top">
              <span>Hook Activity Feed</span>
              <Activity size={16} />
            </div>
            <div>
              {txRows.slice(1).map(([label, hash]) => (
                <a className="feed-row proof-link" href={`${explorerBase}/tx/${hash}`} target="_blank" key={hash}>
                  <span className="code">{shortAddress(hash)}</span>
                  <span className="value">{label}</span>
                  <span className="label">View tx</span>
                </a>
              ))}
            </div>
          </div>
          <div className="panel">
            {proofRows.map(([label, value]) => (
              <div className="proof-row" key={label}>
                <span className="label">{label}</span>
                <span className="code">{value}</span>
              </div>
            ))}
            <div className="tx-list" aria-label="Deployment transactions">
              {txRows.map(([label, hash]) => (
                <a className="proof-row proof-link" href={`${explorerBase}/tx/${hash}`} target="_blank" key={hash}>
                  <span className="label">{label}</span>
                  <span className="code">{hash}</span>
                </a>
              ))}
            </div>
            <a className="ghost-button" href="https://github.com/uniswapfoundation/v4-template" target="_blank">
              <Github size={17} />
              Base Template
            </a>
          </div>
        </div>
      </section>

      <footer className="footer">
        DiamondHand Loyalty Hook. Testnet demo only; no real-value token trading.
      </footer>
    </main>
  );
}
