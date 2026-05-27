# DiamondHand Hook

DiamondHand Hook 是一个基于 Uniswap v4 的 Hook，用来把「真实持有时间」变成更好的交易条件。

普通流动性池会把每一次卖出都当成一样的行为。DiamondHand Hook 不一样：用户每次买入 DHC，都会生成一笔独立的持仓批次；用户卖出 DHC 时，系统会优先消耗最早买入的批次，并根据那一批实际持有了多久来决定卖出手续费。

一句话：卖得越快，手续费越高；真正持有越久，卖出条件越好。

## 为什么需要它

很多新资产、社区代币、启动型资产都会遇到同一个问题：早期关注带来交易和流动性，但短时间内的快速卖出会破坏市场稳定。

DiamondHand Hook 不阻止用户卖出，也不依赖中心化积分或链下信誉。它把规则直接写进交易池：

- 短时间卖出：更高卖出费。
- 中等时间持有：较低卖出费。
- 长时间持有：最低卖出费。

这样，持有行为可以在链上被记录、被验证，并且在真实 swap 发生时直接影响费率。

## 核心机制

每次买入都会创建一笔独立的持仓批次，也就是 lot。

每个 lot 记录两件事：

- 剩余 DHC 数量
- 买入时间

当用户卖出 DHC 时，Hook 使用 FIFO 规则：

1. 找到最早的未卖完 lot。
2. 计算这个 lot 已经持有了多久。
3. 根据持有时间选择对应的动态卖出费率。
4. 先消耗这个 lot，再轮到后面的 lot。

这样可以避免平均持仓时间带来的漏洞。比如用户不能先买 1 DHC 等 30 分钟，再买 100 DHC，然后让全部 101 DHC 都享受最低费率。只有真正持有满时间的那一批，才能拿到更低费率。

## 费率档位

当前测试网部署使用的是下面这组演示参数：

| 持有时间 | 卖出手续费 | 档位 |
| ---: | ---: | --- |
| 少于 5 分钟 | 3.0% | Paper Hand |
| 5 到 30 分钟 | 1.5% | Holder |
| 30 分钟或以上 | 0.3% | Diamond Hand |

这些档位不是固定产品上限，而是当前合约部署的参数。实际项目可以根据资产类型、启动阶段、社区目标或风险偏好调整，例如把时间改成 1 小时 / 24 小时 / 7 天，或者把费率改成更温和或更激进的版本。调整后需要重新部署 Hook，并用新的 Hook 创建对应的 v4 pool。

## 示例

```text
10:00  买入 1 DHC      -> 创建 Lot #0
10:31  买入 100 DHC    -> 创建 Lot #1
10:36  卖出 1 DHC      -> 优先消耗 Lot #0
```

这次卖出会按 Diamond Hand 档位计算，因为 Lot #0 已经持有 36 分钟。Lot #1 不会被混在一起计算，它有自己的买入时间和费率状态。

## 测试网部署

网络：X Layer Testnet  
Chain ID：`1952`  
RPC：`https://testrpc.xlayer.tech/terigon`  
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
| 部署 Hook | `0xdb519b545defb46dbcb6018572f17baf836aba3e5ceae1aae8ee82568f30d09d` |
| 创建池子并添加流动性 | `0x9bdfba01da3cdcaa5a7bb7623232608f63c8c84a1f51d6ff2b8669871bd332ad` |
| 买入触发 Hook | `0xa2b507ba2d26dd800d609aacb37555366ee93284911ee19489faba27b323550c` |
| 卖出触发 Hook | `0x9d0c03ecd68d772caba4d52b6fcddc4627352d8199c82b1a390ba3d582e4f616` |

## Web App

前端提供一个测试网交互界面，核心流程是：

1. 连接钱包。
2. 切换到 X Layer Testnet。
3. 如果没有测试 OKB，先从水龙头领取。
4. 使用 XLUSD 买入 DHC。
5. 查看下一笔会被卖出的 FIFO lot 和当前卖出费率。
6. 卖出 DHC，并查看交易证明。

这个界面不是静态展示页，而是围绕买入、持有、卖出、验证这条核心链路设计的。

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

部署或运行脚本前创建 `.env.local`：

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

MIT.
