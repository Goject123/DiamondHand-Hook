# DiamondHand Hook

[English](./README.md) | 中文

DiamondHand Hook 是一个基于 Uniswap v4 的 Hook，用来把真实持有时间变成更好的卖出条件。

它不是按“整个钱包平均持有多久”来收费，而是把每一次买入 DHC 都记成一笔独立的 FIFO lot。用户卖出 DHC 时，Hook 会优先消耗最早那笔还没卖完的 lot，并按照那一笔实际持有了多久来决定手续费。

用大白话说就是：卖得越快，手续费越高；拿得越久，手续费越低。

## 这个产品在解决什么

很多新资产、社区代币、启动期市场都会遇到同一个问题：

- 想让交易保持开放
- 又不想市场全是短线砸盘

DiamondHand Hook 的做法不是禁止卖出，而是把规则直接写进池子里：你当然可以卖，但你卖掉的那部分仓位，手续费要按照它真实持有的时间来算。

这样做有一个很重要的好处：不能靠“平均持仓时间”钻空子。

比如一个用户先买 `1 DHC`，等了 30 分钟后，再买 `100 DHC`。如果按钱包平均来看，就很容易把后面那 `100 DHC` 也伪装成长期持有。DiamondHand Hook 不这么算，它只认每一笔 lot 自己的时间。

## 核心机制

每次买入，都会创建一笔独立 lot。

每笔 lot 记录两件事：

- 剩余 DHC 数量
- 买入时间戳

当用户卖出 DHC 时，Hook 按 FIFO 规则处理：

1. 找到最早的 active lot。
2. 计算这笔 lot 已经持有了多久。
3. 选出这笔 lot 对应的费率档位。
4. 先消耗这笔 lot，不够再继续消耗后面的 lot。

所以真正决定手续费的，不是“你钱包曾经买过”，而是“你现在卖掉的这部分，到底拿了多久”。

## 当前测试网费率档位

当前部署在测试网上的演示参数如下：

| 持有时间 | 卖出手续费 | 档位 |
| ---: | ---: | --- |
| 少于 5 分钟 | 3.0% | Paper Hand |
| 5 到 30 分钟 | 1.5% | Holder |
| 30 分钟及以上 | 0.3% | Diamond Hand |

这些档位不是写死的产品上限，而是当前这版 Hook 的部署参数。正式场景里，时间窗口和费率都可以按资产类型、社区目标、流动性阶段去调整。

## 一个例子

```text
10:00  买入 1 DHC      -> 创建 Lot #0
10:31  买入 100 DHC    -> 创建 Lot #1
10:36  卖出 1 DHC      -> 优先消耗 Lot #0
```

这次卖出会按 `Diamond Hand` 档位收费，因为被卖掉的是 `Lot #0`，它已经持有了 36 分钟。`Lot #1` 还是一笔独立仓位，它有自己的时间和费率状态。

## 在线演示

Web App： [diamond-hand-hook.vercel.app](https://diamond-hand-hook.vercel.app/)

这个前端不是静态展示页，而是一个真实可交互的 X Layer Testnet 演示工具。

体验流程：

1. 连接钱包。
2. 切到 X Layer Testnet。
3. 如果没有 gas，先领取测试 OKB。
4. 如果买入侧没有资金，先准备 XLUSD。
5. 用 XLUSD 买入 DHC。
6. 输入想卖出的数量，前端会按 active FIFO lots 预估这次卖出的综合手续费。
7. 发起卖出，并到浏览器里验证交易记录。

当前前端行为：

- 每次买入都会生成一笔新的 FIFO lot
- 已经卖完的 lot 不会再参与卖出预估
- 卖出预览展示的是“这次卖这么多，大概综合费率是多少”
- 点击 `Max` 时，会按当前全部 active DHC 来预估和卖出
- 页面支持中英文切换

## 测试网部署信息

网络：X Layer Testnet  
Chain ID：`1952`  
推荐 RPC：`https://testrpc.xlayer.tech/terigon`  
官方备选 RPC：`https://xlayertestrpc.okx.com/terigon`  
浏览器：`https://www.okx.com/web3/explorer/xlayer-test`  
水龙头：`https://web3.okx.com/xlayer/faucet`

| 合约 | 地址 |
| --- | --- |
| PoolManager | `0xf3bFA4955df463292387c2DA2892D2368B73fB86` |
| PositionManager | `0xEeb890918b257a6f74bA5B367500EaE4B4ebD35E` |
| V4 Swap Router | `0x376828714CbE0b9e3C014cf9b8469616Fd43E93c` |
| DiamondHand Hook | `0xc79470484a1D2e3f5C95A14DbfffC1F5Bb8900c0` |
| DHC | `0x83206655800fa69A5ECB5C80bd83895f8f4eB4B9` |
| XLUSD | `0xad95B03a2c86A8bdD5ADF18a03A35c197Feecd42` |

链上证明：

| 操作 | 交易 |
| --- | --- |
| Hook 部署 | `0xdb519b545defb46dbcb6018572f17baf836aba3e5ceae1aae8ee82568f30d09d` |
| 创建池子并添加流动性 | `0x9bdfba01da3cdcaa5a7bb7623232608f63c8c84a1f51d6ff2b8669871bd332ad` |
| 买入触发 Hook | `0xa2b507ba2d26dd800d609aacb37555366ee93284911ee19489faba27b323550c` |
| 卖出触发 Hook | `0x9d0c03ecd68d772caba4d52b6fcddc4627352d8199c82b1a390ba3d582e4f616` |

## 项目结构

```text
app/        Next.js 前端
src/        Solidity Hook 合约
test/       Foundry 测试
script/     部署与交互脚本
scripts/    本地辅助脚本
```

## 本地开发

安装依赖：

```powershell
npm install
```

启动前端：

```powershell
npm run dev
```

构建前端：

```powershell
npm run build
```

运行合约测试：

```powershell
& '.tools\foundry\forge.exe' test
```

如果本机已全局安装 Foundry，也可以直接运行：

```powershell
forge test
```

## 环境变量

在运行部署或交互脚本前，先创建 `.env.local`：

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

不要提交 `.env.local` 或任何私钥。

## License

MIT
