# Universal Account Benchmark

Transaction speed benchmark tool for [Particle Network Universal Account](https://developers.particle.network/).

## Result

```
sendTransactionTotal Statistics:
  Runs: 10
  Mean: 371.41ms
  Median: 351.11ms
  Min: 131.30ms
  Max: 770.58ms
  Std Dev: 185.00ms
  All values: [131.30, 167.83, 187.09, 308.68, 345.29, 356.92, 439.08, 451.32, 555.95, 770.58]

Source Chain: SOLANA , Target Chain: SOLANA
```

```
sendTransactionTotal Statistics:
  Runs: 5
  Mean: 628.31ms
  Median: 548.05ms
  Min: 512.46ms
  Max: 911.04ms
  Std Dev: 148.50ms
  All values: [512.46, 527.08, 548.05, 642.91, 911.04]

Source Chain: BASE , Target Chain: SOLANA
```

```
sendTransactionTotal Statistics:
  Runs: 5
  Mean: 1194.21ms
  Median: 1107.94ms
  Min: 948.53ms
  Max: 1759.93ms
  Std Dev: 290.49ms
  All values: [948.53, 1019.25, 1107.94, 1135.38, 1759.93]

Source Chain: SOLANA , Target Chain: BASE
```

## Features

- Transaction speed testing for Universal Account
- Support for multiple chains (Solana, BSC, Base, Ethereum, etc.)
- Optional WebSocket for transaction status updates (race with polling)
- Optional user-assets WSS subscription for real-time balance updates
- Statistical analysis of transaction times
- Classic and EIP-7702 mode support
- Per-method Datadog tracing via separate RPC endpoints

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required environment variables:
- `PROJECT_ID`: Your Particle project ID
- `PROJECT_CLIENT_KEY`: Your Particle client key
- `PROJECT_APP_UUID`: Your Particle app UUID
- `PRIVATE_KEY_SOLANA`: Private key for Solana transactions
- `PRIVATE_KEY_BSC`: Private key for BSC transactions
- `PRIVATE_KEY_BASE`: Private key for Base transactions
- `PRIVATE_KEY_ETHEREUM`: Private key for Ethereum transactions

Optional environment variables:
- `UNIVERSALX_RPC_URL`: Custom RPC endpoint (default: `https://universal-rpc-proxy.particle.network`)
- `UNIVERSALX_WSS_URL`: Custom WSS endpoint (default: `wss://universal-app-ws-proxy.particle.network`)

> **Note:** Only use EVM private keys, even for Solana — Universal Account uses ECDSA on Solana as well.

## Usage

```bash
# Run with default settings (1 run on Solana)
npm start

# Run multiple times
npm start -- --runTimes=10

# Use EIP-7702 mode
npm start -- --uaMode=7702 --runTimes=10

# Test on different chains
npm start -- --sourceChain=solana --targetChain=bsc --runTimes=5

# Adjust fee rate and MEV settings
npm start -- --feeRate=2 --bribeAmount=0.001 --mevProtection=1

# Enable WSS for transaction tracking (race with polling)
npm start -- --runTimes=3 --sourceChain=solana --wssMode=true

# Skip token warmup
npm start -- --runTimes=3 --sourceChain=solana --warmup=false

# Only test account setup + user-assets WSS (no transactions)
npm start -- --runTimes=0 --userAssetsWss=true

# Show help
npm start -- --help
```

## Address

1. Use `--runTimes=0` to get the Universal Account addresses without running transactions
2. If you are using `--uaMode=7702`, the EVM chain's Universal Account address is also the EOA address

## Command Line Options

| Option | Default | Description |
|--------|---------|-------------|
| `--uaMode=<classic\|7702>` | `classic` | Universal Account mode |
| `--runTimes=<number>` | `1` | Number of benchmark runs (0 = skip transactions) |
| `--sourceChain=<chain>` | `solana` | Source chain |
| `--targetChain=<chain>` | same as source | Target chain |
| `--feeRate=<number>` | `1` | Priority fee rate |
| `--bribeAmount=<number>` | `0` | Solana MEV tip amount |
| `--mevProtection=<number>` | `2` | MEV protection level |
| `--wssMode=<true\|false>` | `false` | Use WebSocket for transaction status updates |
| `--userAssetsWss=<true\|false>` | `false` | Subscribe to user-assets WSS for real-time balance updates |
| `--warmup=<true\|false>` | `true` | Enable token warmup before transactions |
| `--help, -h` | | Show help message |

## Supported Chains

### Source Chains
- Solana
- BSC (BNB Smart Chain)
- Base

### Target Chains
- Solana
- BSC
- Base
- Ethereum
- X Layer
- Monad
- Optimism
- Arbitrum
- Polygon
- Berachain
- Mantle
- Sonic
- Avalanche

## Metrics

The benchmark measures the following timing metrics:

1. **getSmartAccountOptions**: Time to fetch smart account configuration
2. **getPrimaryAssets**: Time to fetch portfolio balances
3. **warmup**: Token warmup time (cold start avoidance)
4. **createBuyTransaction**: Time to create a buy transaction
5. **sendTransaction**: Time to submit the transaction
6. **getTransaction**: Time to confirm transaction completion (polling, or WSS+polling race when `--wssMode=true`)
7. **sendTransactionTotal**: Total time from send to confirmation
8. **createBuy+sendTotal**: End-to-end from transaction creation to confirmation

When `--userAssetsWss=true`:
9. **userAssetsWssInitialLoad**: Initial asset delivery time via WSS
10. **userAssetsWssPostTxUpdate**: Balance update time after transaction completion

Statistics provided for each metric: mean, median, min, max, standard deviation, and all individual values.

## Development

```bash
# Build TypeScript
npm run build

# Run from source
npm run dev
```

## Example

For a complete integration example, see [universal-account-example](https://github.com/Particle-Network/universal-account-example).

## License

MIT
