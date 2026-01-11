# Universal Account Benchmark

Transaction speed benchmark tool for Universal Account SDK.

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
- **Dual confirmation mode**: WebSocket and polling race simultaneously, whichever completes first wins
- Statistical analysis of transaction times
- Classic and EIP-7702 mode support

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

# Show help
npm start -- --help
```

## Address

1. Use `--runTime=0` to get the Universal Account addresses
2. If your are using `--uaMode=7702`, evm chain' Universal Account address is also the EOA address

## Command Line Options

- `--uaMode=<classic|7702>`: Universal Account mode (default: classic)
- `--runTimes=<number>`: Number of benchmark runs (default: 1)
- `--sourceChain=<chain>`: Source chain (default: solana)
- `--targetChain=<chain>`: Target chain (default: sourceChain)
- `--feeRate=<number>`: Priority fee rate (default: 1)
- `--bribeAmount=<number>`: Solana MEV tip amount (default: 0)
- `--mevProtection=<number>`: MEV protection level (default: 2)
- `--help, -h`: Show help message

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

1. **getTokenPair**: Time to fetch token pair information
2. **createBuyTransaction**: Time to create buy transaction
3. **sendTransaction**: Time to send transaction
4. **getTransaction**: Time to confirm transaction (WSS and polling race simultaneously, prints which method won)
5. **sendTransactionTotal**: Total time from send to confirmation

Statistics provided for each metric:
- Mean
- Median
- Min/Max
- Standard Deviation
- All individual values

## Example Output

```
---- Using RPC -  https://universal-rpc-proxy.particle.network ----
---- Using WSS -  wss://universal-app-ws-proxy.particle.network ----
---- Creating WSS connection for racing with polling ----
Running benchmark 5 time(s)...

Your UA EVM Address: 0x...
Your UA Solana Address: ...

Run 1/5:
  createBuyTransaction: 1234.56ms
  sendTransaction: 234.56ms
  Explorer URL: https://universalx.app/activity/details?id=...
  
  getTransaction: 2345.67ms (used: wss)
  sendTransactionTotal: 2580.23ms
  ...

Run 2/5:
  createBuyTransaction: 1100.00ms
  sendTransaction: 200.00ms
  getTransaction: 1800.00ms (used: polling)
  sendTransactionTotal: 2000.00ms
  ...

getTokenPair Statistics:
  Runs: 5
  Mean: 1234.56ms
  Median: 1230.00ms
  Min: 1200.00ms
  Max: 1280.00ms
  Std Dev: 25.34ms
  ...

Source Chain: SOLANA , Target Chain: SOLANA
Using RPC: https://universal-rpc-proxy.particle.network , Fee Rate: 1 , Bribe Amount: 0 , Mode: WSS+Polling Race
```

## Development

```bash
# Build TypeScript
npm run build

# Run from source
npm run dev
```

## License

MIT
