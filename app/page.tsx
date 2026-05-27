"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import {
  Activity,
  BadgeCheck,
  CircleDollarSign,
  Clock3,
  Diamond,
  ExternalLink,
  FileCode2,
  Fuel,
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
  type WalletClient,
} from "viem";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  providers?: EthereumProvider[];
  isOkxWallet?: boolean;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
    okxwallet?: EthereumProvider;
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
const recommendedRpc = xLayerTestnet.rpcUrls.default.http[0];
const okxOfficialRpc = "https://xlayertestrpc.okx.com/terigon";

const contracts = {
  poolManager: "0xf3bFA4955df463292387c2DA2892D2368B73fB86" as Address,
  positionManager: "0xEeb890918b257a6f74bA5B367500EaE4B4ebD35E" as Address,
  router: "0x376828714CbE0b9e3C014cf9b8469616Fd43E93c" as Address,
  hook: "0xc79470484a1D2e3f5C95A14DbfffC1F5Bb8900c0" as Address,
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
    name: "nextLot",
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
      { name: "lotIndex", type: "uint256" },
      { name: "amountRemaining", type: "uint256" },
      { name: "boughtAt", type: "uint256" },
      { name: "holdingSeconds", type: "uint256" },
      { name: "tier", type: "uint8" },
      { name: "fee", type: "uint24" },
    ],
  },
  {
    type: "function",
    name: "lotCount",
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
  {
    type: "function",
    name: "lotAt",
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
      { name: "index", type: "uint256" },
    ],
    outputs: [
      { name: "amountRemaining", type: "uint256" },
      { name: "boughtAt", type: "uint256" },
      { name: "holdingSeconds", type: "uint256" },
      { name: "tier", type: "uint8" },
      { name: "fee", type: "uint24" },
    ],
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
  ["Hook deploy", "0xdb519b545defb46dbcb6018572f17baf836aba3e5ceae1aae8ee82568f30d09d"],
  ["Pool + liquidity", "0x9bdfba01da3cdcaa5a7bb7623232608f63c8c84a1f51d6ff2b8669871bd332ad"],
  ["Buy trigger", "0xa2b507ba2d26dd800d609aacb37555366ee93284911ee19489faba27b323550c"],
  ["Sell trigger", "0x9d0c03ecd68d772caba4d52b6fcddc4627352d8199c82b1a390ba3d582e4f616"],
] as const;

const tierLabels = ["Paper Hand", "Holder", "Diamond Hand"] as const;

type PositionLot = {
  index: bigint;
  amountRemaining: bigint;
  holdingSeconds: bigint;
  tier: number;
  fee: number;
};

type DemoReadyState = {
  account: Address;
  client: WalletClient;
  nextLotAmount: bigint;
  nextLotIndex: bigint;
  feePercent: string;
  lotCount: bigint;
};

type HookRecord = {
  action: "Buy" | "Sell";
  lotIndex: bigint;
  amount: string;
  unit: "DHC" | "XLUSD";
  fee?: string;
  hash: Hash;
  time: string;
};

function shortAddress(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatToken(value: bigint) {
  return Number(formatEther(value)).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function formatDuration(seconds: bigint) {
  const value = Number(seconds);
  if (value <= 0) return "0s";
  const minutes = Math.floor(value / 60);
  const restSeconds = value % 60;
  if (minutes < 1) return `${restSeconds}s`;
  if (minutes < 60) return `${minutes}m ${restSeconds}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function feeToPercent(value: number) {
  return `${(value / 10000).toFixed(1)}%`;
}

function feeStateForHolding(seconds: bigint) {
  const value = Number(seconds);
  if (value >= 30 * 60) return { tier: 2, fee: 3000 };
  if (value >= 5 * 60) return { tier: 1, fee: 15000 };
  return { tier: 0, fee: 30000 };
}

function readableTxError(error: unknown, label: string) {
  const message = error instanceof Error ? error.message : `${label} failed.`;
  if (message.includes("coinId")) {
    return `OKX Wallet RPC metadata error: switch X Layer Testnet to ${recommendedRpc}, then retry.`;
  }
  return message;
}

function getWalletProvider() {
  if (typeof window === "undefined") return null;
  if (window.okxwallet) return window.okxwallet;
  const injected = window.ethereum;
  if (!injected) return null;
  return injected.providers?.find((provider) => provider.isOkxWallet) ?? injected;
}

function holdingProgress(seconds: bigint) {
  const value = Number(seconds);
  if (value <= 0) {
    return { label: "Buy DHC to start a holding clock.", progress: 0 };
  }

  if (value < 5 * 60) {
    const remaining = BigInt(5 * 60 - value);
    return {
      label: `${formatDuration(remaining)} to Holder fee`,
      progress: Math.min(100, (value / (5 * 60)) * 100),
    };
  }

  if (value < 30 * 60) {
    const remaining = BigInt(30 * 60 - value);
    return {
      label: `${formatDuration(remaining)} to Diamond Hand fee`,
      progress: Math.min(100, ((value - 5 * 60) / (25 * 60)) * 100),
    };
  }

  return { label: "Diamond Hand fee is active.", progress: 100 };
}

export default function Home() {
  const [account, setAccount] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [okbBalance, setOkbBalance] = useState<bigint>(BigInt(0));
  const [token0Balance, setToken0Balance] = useState<bigint>(BigInt(0));
  const [token1Balance, setToken1Balance] = useState<bigint>(BigInt(0));
  const [tier, setTier] = useState<number>(0);
  const [fee, setFee] = useState<number>(30000);
  const [nextLotIndex, setNextLotIndex] = useState<bigint>(BigInt(0));
  const [nextLotAmount, setNextLotAmount] = useState<bigint>(BigInt(0));
  const [nextLotHolding, setNextLotHolding] = useState<bigint>(BigInt(0));
  const [lotCount, setLotCount] = useState<bigint>(BigInt(0));
  const [lots, setLots] = useState<PositionLot[]>([]);
  const [records, setRecords] = useState<HookRecord[]>([]);
  const [buyAmount, setBuyAmount] = useState("1");
  const [sellAmount, setSellAmount] = useState("0.1");
  const [lastTx, setLastTx] = useState<Hash | null>(null);
  const [status, setStatus] = useState("Connect a wallet to run the X Layer testnet demo.");
  const [busy, setBusy] = useState<string | null>(null);
  const [manualDisconnect, setManualDisconnect] = useState(false);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [stateLoadedAt, setStateLoadedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const walletReady = account && chainId === xLayerTestnet.id;
  const hasGas = okbBalance > BigInt(0);
  const hasBuyFunds = token1Balance > BigInt(0);
  const liveOffset = stateLoadedAt ? BigInt(Math.max(0, Math.floor((now - stateLoadedAt) / 1000))) : BigInt(0);
  const liveNextLotHolding = nextLotAmount > BigInt(0) ? nextLotHolding + liveOffset : nextLotHolding;
  const liveFeeState = nextLotAmount > BigInt(0) ? feeStateForHolding(liveNextLotHolding) : { tier, fee };
  const feePercent = `${(liveFeeState.fee / 10000).toFixed(1)}%`;
  const progress = holdingProgress(liveNextLotHolding);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  function createClientFor(nextAccount: Address) {
    const provider = getWalletProvider();
    if (!provider) return null;
    return createWalletClient({
      account: nextAccount,
      chain: xLayerTestnet,
      transport: custom(provider),
    });
  }

  const refresh = useCallback(
    async (target = account) => {
      if (!target) return;
      await loadWalletState(target);
    },
    [account],
  );

  async function loadWalletState(target: Address) {
    const [native, token0, token1, preview, next, count] = await Promise.all([
      publicClient.getBalance({ address: target }),
      publicClient.readContract({ address: contracts.token0, abi: erc20Abi, functionName: "balanceOf", args: [target] }),
      publicClient.readContract({ address: contracts.token1, abi: erc20Abi, functionName: "balanceOf", args: [target] }),
      publicClient.readContract({ address: contracts.hook, abi: hookAbi, functionName: "previewFee", args: [target, poolKey] }),
      publicClient.readContract({ address: contracts.hook, abi: hookAbi, functionName: "nextLot", args: [target, poolKey] }),
      publicClient.readContract({ address: contracts.hook, abi: hookAbi, functionName: "lotCount", args: [target, poolKey] }),
    ]);

    setOkbBalance(native);
    setToken0Balance(token0);
    setToken1Balance(token1);
    setTier(Number(preview[0]));
    setFee(Number(preview[1]));
    setNextLotIndex(next[0]);
    setNextLotAmount(next[1]);
    setNextLotHolding(next[3]);
    setLotCount(count);
    setStateLoadedAt(Date.now());
    await loadLots(target, count);

    return { native, token0, token1, preview, next, count };
  }

  async function loadLots(target: Address, count: bigint) {
    const total = Number(count);
    const start = Math.max(0, total - 6);
    const lotReads = Array.from({ length: total - start }, (_, offset) => {
      const index = BigInt(start + offset);
      return publicClient
        .readContract({ address: contracts.hook, abi: hookAbi, functionName: "lotAt", args: [target, poolKey, index] })
        .then((lot) => ({
          index,
          amountRemaining: lot[0],
          holdingSeconds: lot[2],
          tier: Number(lot[3]),
          fee: Number(lot[4]),
        }));
    });

    setLots(await Promise.all(lotReads));
  }

  async function connectWallet() {
    const provider = getWalletProvider();
    if (!provider) {
      setStatus("No wallet found. Install OKX Wallet or MetaMask first.");
      return null;
    }

    try {
      setBusy("Connect wallet");
      setStatus("Opening wallet connection...");
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as Address[];
      const nextAccount = accounts[0];
      if (!nextAccount) {
        setStatus("No wallet account selected.");
        return null;
      }

      const hexChain = (await provider.request({ method: "eth_chainId" })) as string;
      setManualDisconnect(false);
      setWalletMenuOpen(false);
      setAccount(nextAccount);
      setChainId(Number.parseInt(hexChain, 16));
      setStatus("Wallet connected. Loading balances...");
      void loadWalletState(nextAccount).catch((error) => {
        setStatus(readableTxError(error, "Load wallet state"));
      });
      return nextAccount;
    } catch (error) {
      setStatus(readableTxError(error, "Connect wallet"));
      return null;
    } finally {
      setBusy(null);
    }
  }

  function disconnectWallet() {
    setManualDisconnect(true);
    setWalletMenuOpen(false);
    setAccount(null);
    setChainId(null);
    setOkbBalance(BigInt(0));
    setToken0Balance(BigInt(0));
    setToken1Balance(BigInt(0));
    setTier(0);
    setFee(30000);
    setNextLotIndex(BigInt(0));
    setNextLotAmount(BigInt(0));
    setNextLotHolding(BigInt(0));
    setLotCount(BigInt(0));
    setLots([]);
    setRecords([]);
    setLastTx(null);
    setBusy(null);
    setStateLoadedAt(null);
    setStatus("Wallet disconnected.");
  }

  useEffect(() => {
    const provider = getWalletProvider();
    if (!provider || manualDisconnect) return;

    let cancelled = false;

    async function restoreWallet() {
      try {
        const accounts = (await provider!.request({ method: "eth_accounts" })) as Address[];
        const hexChain = (await provider!.request({ method: "eth_chainId" })) as string;
        if (cancelled) return;

        setChainId(Number.parseInt(hexChain, 16));
        if (accounts.length === 0) return;

        const nextAccount = accounts[0];
        setAccount(nextAccount);
        setStatus("Wallet restored from browser session.");
        await loadWalletState(nextAccount);
      } catch {
        if (!cancelled) setStatus("Connect a wallet to run the X Layer testnet demo.");
      }
    }

    function handleAccountsChanged(...args: unknown[]) {
      const nextAccounts = args[0] as Address[] | undefined;
      const nextAccount = nextAccounts?.[0];
      if (!nextAccount) {
        disconnectWallet();
        return;
      }
      setManualDisconnect(false);
      setAccount(nextAccount);
      setStatus("Wallet account changed.");
      void loadWalletState(nextAccount);
    }

    function handleChainChanged(...args: unknown[]) {
      const chainHex = args[0];
      if (typeof chainHex === "string") {
        setChainId(Number.parseInt(chainHex, 16));
      }
      if (account) {
        void loadWalletState(account);
      }
    }

    void restoreWallet();
    provider.on?.("accountsChanged", handleAccountsChanged);
    provider.on?.("chainChanged", handleChainChanged);

    return () => {
      cancelled = true;
      provider.removeListener?.("accountsChanged", handleAccountsChanged);
      provider.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [manualDisconnect, account]);

  async function switchNetwork() {
    const provider = getWalletProvider();
    if (!provider) {
      setStatus("No wallet found. Install OKX Wallet or MetaMask first.");
      return false;
    }
    const chainHex = `0x${xLayerTestnet.id.toString(16)}`;
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainHex }],
      });
    } catch {
      await provider.request({
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
    return true;
  }

  async function ensureWalletReady(label: string) {
    setStatus(`${label}: checking wallet...`);
    const nextAccount = account ?? (await connectWallet());
    if (!nextAccount) return null;

    const provider = getWalletProvider();
    const hexChain = provider ? ((await provider.request({ method: "eth_chainId" })) as string) : "0x0";
    const currentChain = Number.parseInt(hexChain, 16);
    if (currentChain !== xLayerTestnet.id) {
      setStatus(`${label}: switching to X Layer Testnet...`);
      const switched = await switchNetwork();
      if (!switched) return null;
    }

    const nextClient = createClientFor(nextAccount);
    if (!nextClient) {
      setStatus("Wallet client is unavailable.");
      return null;
    }

    setStatus(`${label}: checking balances...`);
    const balances = await loadWalletState(nextAccount);
    if (balances.native === BigInt(0)) {
      setStatus("Need test OKB for gas. Faucet opened in a new tab.");
      window.open(faucetUrl, "_blank", "noopener,noreferrer");
      return null;
    }

    return { account: nextAccount, client: nextClient, balances };
  }

  function readyFromLatest(accountAddress: Address, client: WalletClient, latest: Awaited<ReturnType<typeof loadWalletState>>): DemoReadyState {
    return {
      account: accountAddress,
      client,
      nextLotAmount: latest.next[1],
      nextLotIndex: latest.next[0],
      feePercent: `${(Number(latest.preview[1]) / 10000).toFixed(1)}%`,
      lotCount: latest.count,
    };
  }

  async function ensureBuyReady(label: string): Promise<DemoReadyState | null> {
    const ready = await ensureWalletReady(label);
    if (!ready) return null;

    if (ready.balances.token1 === BigInt(0)) {
      setBusy("Prepare demo XLUSD");
      setStatus(`${label}: preparing demo XLUSD...`);
      const hash = await ready.client.writeContract({
        account: ready.account,
        chain: xLayerTestnet,
        address: contracts.token1,
        abi: erc20Abi,
        functionName: "mint",
        args: [ready.account, parseEther("1000")],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setBusy(null);
    }

    const latest = await loadWalletState(ready.account);
    return readyFromLatest(ready.account, ready.client, latest);
  }

  async function ensureSellReady(label: string): Promise<DemoReadyState | null> {
    const ready = await ensureWalletReady(label);
    if (!ready) return null;

    const latest = await loadWalletState(ready.account);
    const prepared = readyFromLatest(ready.account, ready.client, latest);
    if (prepared.nextLotAmount === BigInt(0)) {
      setStatus("Buy DHC first. Sells must come from a real holding lot.");
      return null;
    }

    return prepared;
  }

  async function runPreparedTx(
    label: string,
    prepare: (label: string) => Promise<DemoReadyState | null>,
    action: (ready: DemoReadyState) => Promise<Hash>,
    createRecord?: (hash: Hash, ready: DemoReadyState) => HookRecord,
  ) {
    try {
      setBusy(label);
      const ready = await prepare(label);
      if (!ready) return;
      setStatus(`${label} transaction is waiting for wallet confirmation.`);
      const hash = await action(ready);
      setLastTx(hash);
      if (createRecord) {
        setRecords((current) => [createRecord(hash, ready), ...current].slice(0, 6));
      }
      setStatus(`${label} submitted. Waiting for confirmation...`);
      await publicClient.waitForTransactionReceipt({ hash });
      await loadWalletState(ready.account);
      setStatus(createRecord ? (label.startsWith("Buy") ? "New lot created. Your holding clock has started." : "Oldest lot consumed. Fee proof is ready.") : `${label} confirmed on X Layer Testnet.`);
    } catch (error) {
      setStatus(readableTxError(error, label));
    } finally {
      setBusy(null);
    }
  }

  async function approvePreparedToken(nextAccount: Address, nextClient: WalletClient, token: Address) {
    const hash = await nextClient.writeContract({
      account: nextAccount,
      chain: xLayerTestnet,
      address: token,
      abi: erc20Abi,
      functionName: "approve",
      args: [contracts.router, parseEther("1000000")],
    });
    await publicClient.waitForTransactionReceipt({ hash });
  }

  function parsedAmount(value: string, fallback: string) {
    try {
      return parseEther(value && Number(value) > 0 ? value : fallback);
    } catch {
      return parseEther(fallback);
    }
  }

  async function buyThroughHook() {
    const amount = buyAmount && Number(buyAmount) > 0 ? buyAmount : "1";
    await runPreparedTx(
      "Buy through Hook pool",
      ensureBuyReady,
      async (ready) => {
        await approvePreparedToken(ready.account, ready.client, contracts.token1);
        return ready.client.writeContract({
          account: ready.account,
          chain: xLayerTestnet,
          address: contracts.router,
          abi: routerAbi,
          functionName: "swapExactTokensForTokens",
          args: [
            parsedAmount(amount, "1"),
            BigInt(0),
            false,
            poolKey,
            encodeAbiParameters([{ type: "address" }], [ready.account]),
            ready.account,
            BigInt(Math.floor(Date.now() / 1000) + 3600),
          ],
        });
      },
      (hash, ready) => ({ action: "Buy", lotIndex: ready.lotCount, amount, unit: "XLUSD", hash, time: new Date().toLocaleTimeString() }),
    );
  }

  async function sellThroughHook() {
    const amount = sellAmount && Number(sellAmount) > 0 ? sellAmount : "0.1";
    await runPreparedTx(
      "Sell through Hook pool",
      ensureSellReady,
      async (ready) => {
        await approvePreparedToken(ready.account, ready.client, contracts.token0);
        return ready.client.writeContract({
          account: ready.account,
          chain: xLayerTestnet,
          address: contracts.router,
          abi: routerAbi,
          functionName: "swapExactTokensForTokens",
          args: [
            parsedAmount(amount, "0.1"),
            BigInt(0),
            true,
            poolKey,
            encodeAbiParameters([{ type: "address" }], [ready.account]),
            ready.account,
            BigInt(Math.floor(Date.now() / 1000) + 3600),
          ],
        });
      },
      (hash, ready) => ({ action: "Sell", lotIndex: ready.nextLotIndex, amount, unit: "DHC", fee: ready.feePercent, hash, time: new Date().toLocaleTimeString() }),
    );
  }

  return (
    <main className="page-shell">
      <nav className="nav" aria-label="Primary navigation">
        <div className="nav-inner">
          <a className="brand" href="#home">
            <span className="brand-mark">
              <Image src="/logo/logo-mark.svg" alt="" width={34} height={34} priority />
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
            <div className="wallet-menu">
              <button
                className="ghost-button connect-button"
                onClick={account ? () => setWalletMenuOpen((open) => !open) : connectWallet}
                aria-expanded={account ? walletMenuOpen : undefined}
                aria-haspopup={account ? "menu" : undefined}
              >
                <Wallet size={17} />
                {account ? shortAddress(account) : "Connect Wallet"}
              </button>
              {account && walletMenuOpen ? (
                <div className="wallet-dropdown" role="menu">
                  <button onClick={disconnectWallet} role="menuitem">
                    Disconnect
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </nav>

      <section id="home" className="hero hero-centered">
        <div>
          <div className="eyebrow">
            <ShieldCheck size={16} />
            Live testnet demo on X Layer
          </div>
          <h1>Turn holding into better trading terms</h1>
          <p className="hero-copy">
            DiamondHand Hook rewards real holders with lower sell fees. Each buy is tracked as its
            own FIFO lot, so only positions that were actually held longer get better pricing.
          </p>
          <div className="hero-actions">
            {account ? (
              <a className="pill-button" href="#demo">
                <Play size={17} />
                Open Demo
              </a>
            ) : (
              <button className="pill-button" onClick={connectWallet}>
                <Wallet size={17} />
                Connect Wallet
              </button>
            )}
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
            <span>FIFO lot accounting</span>
            <span>Sell fee: 0.3%-3%</span>
            <span>X Layer testnet</span>
          </div>
        </div>
      </section>

      <section id="demo" className="section tool-section" aria-labelledby="tool-title">
        <aside className="demo-console tool-workbench" aria-label="Interactive demo console">
          <div className="console-top">
            <div>
              <span>Demo Tool</span>
              <strong id="tool-title">DiamondHand trading demo</strong>
            </div>
            <div className="tool-badges">
              <span className={account ? "ready" : "warn"}>{account ? "Wallet ready" : "Need wallet"}</span>
              <span className={chainId === xLayerTestnet.id ? "ready" : "warn"}>
                {chainId === xLayerTestnet.id ? "X Layer ready" : "Need network"}
              </span>
              <span className={hasGas ? "ready" : "warn"}>{hasGas ? "Gas ready" : "Need gas"}</span>
              {walletReady && !hasBuyFunds ? <span className="warn">Need XLUSD</span> : null}
            </div>
          </div>

          <div className="simple-tool-grid">
            <div className="trade-panel" aria-label="Hook actions">
              <div className="trade-copy">
                <span>Trade</span>
                <h3>Buy. Hold. Sell.</h3>
                <p>The Hook rewards real holding: every buy becomes a lot, and every sell uses the oldest lot first.</p>
              </div>
              <div className="trade-actions-simple">
                <div className="trade-box buy-box">
                  <label htmlFor="buy-amount">Spend amount</label>
                  <div className="amount-row">
                    <input
                      id="buy-amount"
                      inputMode="decimal"
                      min="0"
                      value={buyAmount}
                      onChange={(event) => setBuyAmount(event.target.value)}
                    />
                    <span>XLUSD</span>
                  </div>
                  <button className="trade-button buy" disabled={!!busy} onClick={buyThroughHook}>
                    <Play size={20} />
                    <span>
                      <strong>Buy DHC</strong>
                      <em>New holding lot</em>
                    </span>
                  </button>
                </div>
                <div className="trade-box sell-box">
                  <label htmlFor="sell-amount">Sell amount</label>
                  <div className="amount-row">
                    <input
                      id="sell-amount"
                      inputMode="decimal"
                      min="0"
                      value={sellAmount}
                      onChange={(event) => setSellAmount(event.target.value)}
                    />
                    <span>DHC</span>
                  </div>
                  <button className="trade-button sell" disabled={!!busy} onClick={sellThroughHook}>
                    <Timer size={20} />
                    <span>
                      <strong>Sell DHC</strong>
                      <em>Oldest lot</em>
                    </span>
                  </button>
                </div>
              </div>
              <div className="trade-balances" aria-label="Wallet token balances">
                <span>DHC {formatToken(token0Balance)}</span>
                <span>XLUSD {formatToken(token1Balance)}</span>
              </div>
            </div>

            <div className="fee-panel">
              <div className="result-top">
                <span>Hook Result</span>
                <button className="mini-button" onClick={() => refresh()} disabled={!account || !!busy} title="Refresh">
                  <RefreshCcw size={15} />
                </button>
              </div>
              {account ? (
                <div className="simple-fee-result">
                  <strong>{feePercent}</strong>
                  <span>{tierLabels[liveFeeState.tier] ?? "Paper Hand"} sell fee</span>
                  <em>{progress.label}</em>
                  <div className="tier-progress" aria-label="Holding tier progress">
                    <span style={{ width: `${progress.progress}%` }} />
                  </div>
                </div>
              ) : (
                <div className="empty-output">
                  <Wallet size={22} />
                  <strong>Connect wallet to load state</strong>
                  <span>Connect to preview the next sell fee.</span>
                </div>
              )}
              <div className="lot-card">
                <span>Next lot to sell</span>
                {nextLotAmount > BigInt(0) ? (
                  <>
                    <strong>
                      Lot #{nextLotIndex.toString()} - {formatToken(nextLotAmount)} DHC
                    </strong>
                    <em>Held {formatDuration(liveNextLotHolding)} - fee updates as time passes</em>
                  </>
                ) : (
                  <>
                    <strong>No active lot</strong>
                    <em>Buy DHC to create one.</em>
                  </>
                )}
              </div>
              <div className="last-tx-card">
                <span>Last transaction</span>
                {lastTx ? (
                  <a href={`${explorerBase}/tx/${lastTx}`} target="_blank">
                    {shortAddress(lastTx)}
                    <ExternalLink size={14} />
                  </a>
                ) : (
                  <strong>None yet</strong>
                )}
              </div>
            </div>
          </div>

          <div className="evidence-grid" aria-label="Hook evidence">
            <div className="evidence-panel">
              <div className="evidence-heading">
                <span>Your holding lots</span>
                <em>{lotCount.toString()} total</em>
              </div>
              <div className="lot-list">
                {lots.length > 0 ? (
                  lots.map((lot) => (
                    <div className={`lot-row ${lot.index === nextLotIndex && lot.amountRemaining > BigInt(0) ? "next" : ""}`} key={lot.index.toString()}>
                      <strong>Lot #{lot.index.toString()}</strong>
                      <span>{formatToken(lot.amountRemaining)} DHC</span>
                      {(() => {
                        const liveHolding = lot.amountRemaining > BigInt(0) ? lot.holdingSeconds + liveOffset : lot.holdingSeconds;
                        const liveLotFee = lot.amountRemaining > BigInt(0) ? feeStateForHolding(liveHolding) : { tier: lot.tier, fee: lot.fee };
                        return (
                          <>
                            <span>Held {formatDuration(liveHolding)}</span>
                            <span>{tierLabels[liveLotFee.tier] ?? "Paper Hand"} - {feeToPercent(liveLotFee.fee)}</span>
                          </>
                        );
                      })()}
                      <em>{lot.amountRemaining === BigInt(0) ? "Consumed" : lot.index === nextLotIndex ? "Next to sell" : "Waiting"}</em>
                    </div>
                  ))
                ) : (
                  <div className="empty-list">No lots yet.</div>
                )}
              </div>
            </div>

            <div className="evidence-panel">
              <div className="evidence-heading">
                <span>Trade proof</span>
                <em>Explorer links</em>
              </div>
              <div className="record-list">
                {records.length > 0 ? (
                  records.map((record) => (
                    <a className="record-row" href={`${explorerBase}/tx/${record.hash}`} target="_blank" key={`${record.action}-${record.hash}`}>
                      <strong>{record.action} recorded</strong>
                      <span>
                        Lot #{record.lotIndex.toString()} - {record.amount} {record.unit}{record.fee ? ` - ${record.fee}` : ""}
                      </span>
                      <em>
                        {record.time} - {shortAddress(record.hash)}
                        <ExternalLink size={13} />
                      </em>
                    </a>
                  ))
                ) : (
                  <div className="empty-list">No records yet.</div>
                )}
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

          <details className="rpc-help">
            <summary>RPC / wallet fix</summary>
            <div>
              <span>Recommended RPC</span>
              <strong>{recommendedRpc}</strong>
              <p>
                If OKX Wallet shows a coinId error while preparing demo XLUSD, use this RPC for X
                Layer Testnet instead of the wallet preset. Official alternative: {okxOfficialRpc}
              </p>
            </div>
          </details>
        </aside>
      </section>

      <section className="section section-tight" aria-labelledby="problem-title">
        <div className="problem-band">
          <div className="section-heading">
            <h2 id="problem-title">Why this matters</h2>
            <p>
              Launch assets need market rules that reward real holding, not wallets that once
              bought early. DiamondHand Hook measures each buy lot separately.
            </p>
          </div>
          <div className="problem-answer">
            <span>Hook response</span>
            <strong>Every buy becomes a lot. Every sell pays the fee of the oldest active lot.</strong>
          </div>
        </div>
      </section>

      <section id="fees" className="section" aria-labelledby="tiers-title">
        <div className="section-heading">
          <h2 id="tiers-title">Fee tiers</h2>
          <p>
            The tiers are intentionally simple: the older the lot being sold, the lower the sell fee.
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
          <h2 id="mechanism-title">How the Hook works</h2>
          <p>
            Each action sends a real X Layer Testnet transaction. Buy records a new lot; sell calls
            `beforeSwap`, classifies the next FIFO lot, and returns a dynamic fee override.
          </p>
        </div>
        <div className="protocol-flow" aria-label="Hook workflow">
          {["Mint demo tokens", "Buy creates a lot", "Track lot holding time", "Sell consumes oldest lot", "Override fee"].map(
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
          <p>The current sell fee is read from the next active FIFO lot on the Hook.</p>
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
            <p>Enter a buy or sell amount in the demo tool.</p>
            <strong>Custom</strong>
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
          </div>
        </div>
      </section>

      <footer className="footer">
        DiamondHand Loyalty Hook. Testnet demo only; no real-value token trading.
      </footer>
    </main>
  );
}
