import { config } from 'dotenv';
import { CHAIN_ID, EIP7702Authorization, MEV_PROTECTION_TYPE, UniversalAccount } from '@particle-network/universal-account-sdk';
import { getBytes, Wallet } from 'ethers';
import WebSocket from 'ws';

config();

interface CommandLineArgs {
    uaMode: 'classic' | '7702';
    runTimes: number;
    sourceChain: string;
    targetChain: string;
    feeRate: number;
    mevProtection?: number;
    bribeAmount: number;
    wssMode: boolean;
    warmup: boolean;
    help?: boolean;
}

function parseCommandLineArgs(): CommandLineArgs {
    const args = process.argv.slice(2);
    const parsed: CommandLineArgs = {
        uaMode: 'classic',
        runTimes: 1,
        sourceChain: 'SOLANA',
        targetChain: 'SOLANA',
        feeRate: 1,
        mevProtection: 2,
        bribeAmount: 0,
        wssMode: false,
        warmup: true,
    };

    for (const arg of args) {
        if (arg === '--help' || arg === '-h') {
            parsed.help = true;
            continue;
        }

        const match = arg.match(/^--([^=]+)=(.*)$/);
        if (match && match[1] && match[2]) {
            const key = match[1];
            const value = match[2];
            switch (key) {
                case 'uaMode':
                    parsed.uaMode = value.toLowerCase() as 'classic' | '7702';
                    break;
                case 'runTimes':
                    const parsedRunTimes = parseInt(value, 10);
                    parsed.runTimes = isNaN(parsedRunTimes) ? 1 : parsedRunTimes;
                    break;
                case 'sourceChain':
                    parsed.sourceChain = value.toUpperCase();
                    break;
                case 'targetChain':
                    parsed.targetChain = value ? value.toUpperCase() : parsed.sourceChain;
                    break;
                case 'feeRate':
                    parsed.feeRate = parseInt(value, 10) || 1;
                    break;
                case 'mevProtection':
                    parsed.mevProtection = parseInt(value, 10) ?? 2;
                    break;
                case 'bribeAmount':
                    parsed.bribeAmount = parseFloat(value) || 0;
                    break;
                case 'wssMode':
                    parsed.wssMode = value.toLowerCase() === 'true';
                    break;
                case 'warmup':
                    parsed.warmup = value.toLowerCase() !== 'false';
                    break;
                default:
                    console.warn(`Unknown argument: --${key}`);
            }
        } else {
            console.warn(`Invalid argument format: ${arg}. Use --key=value format.`);
        }
    }

    return parsed;
}

function printHelp(): void {
    console.log(`
Universal Account Benchmark Tool

Usage: npm start -- [OPTIONS]

Options:
  --uaMode=<classic|7702>     Universal Account mode to use (default: classic)
  --runTimes=<number>         Number of times to run the benchmark (default: 1)
  --sourceChain=<chain>       Source chain to use (default: solana; supports: solana, bsc, base)
  --targetChain=<chain>       Target chain to use (default: sourceChain; supports: solana, bsc, base, ethereum, xlayer, monad, op, arbitrum, polygon, berachain, mantle, sonic)
  --feeRate=<number>          Priority fee rate (default: 1)
  --bribeAmount=<number>      Solana MEV tip amount (default: 0)
  --mevProtection=<number>    MEV protection level (default: 2)
  --wssMode=<true|false>      Use WebSocket for transaction status updates (default: false)
  --warmup=<true|false>       Enable token warmup before transactions (default: true)
  --help, -h                  Show this help message

Examples:

  npm start -- --runTimes=10
  npm start -- --uaMode=7702 --runTimes=10
  npm start -- --runTimes=5 --sourceChain=solana
  npm start -- --runTimes=3 --sourceChain=solana --feeRate=2 --bribeAmount=0.001
  npm start -- --runTimes=3 --sourceChain=solana --feeRate=2 --bribeAmount=0.001 --mevProtection=1
  npm start -- --runTimes=3 --sourceChain=solana --targetChain=bsc --mevProtection=1
  npm start -- --runTimes=3 --sourceChain=solana --wssMode=true
  npm start -- --runTimes=3 --sourceChain=solana --warmup=false
`);
}

interface TimingStats {
    mean: number;
    min: number;
    max: number;
    median: number;
    stdDev: number;
    values: number[];
}

function calculateStats(values: number[]): TimingStats {
    if (values.length === 0) {
        return { mean: 0, min: 0, max: 0, median: 0, stdDev: 0, values: [] };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const median = sorted.length % 2 === 0
        ? ((sorted[sorted.length / 2 - 1] ?? 0) + (sorted[sorted.length / 2] ?? 0)) / 2
        : (sorted[Math.floor(sorted.length / 2)] ?? 0);
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return {
        mean,
        min: sorted[0] ?? 0,
        max: sorted[sorted.length - 1] ?? 0,
        median,
        stdDev,
        values: sorted,
    };
}

function printStats(name: string, stats: TimingStats): void {
    console.log(`\n${name} Statistics:`);
    console.log(`  Runs: ${stats.values.length}`);
    console.log(`  Mean: ${stats.mean.toFixed(2)}ms`);
    console.log(`  Median: ${stats.median.toFixed(2)}ms`);
    console.log(`  Min: ${stats.min.toFixed(2)}ms`);
    console.log(`  Max: ${stats.max.toFixed(2)}ms`);
    console.log(`  Std Dev: ${stats.stdDev.toFixed(2)}ms`);
    console.log(`  All values: [${stats.values.map(v => v.toFixed(2)).join(', ')}]`);
}

function getRpcUrl(): string {
    return process.env.UNIVERSALX_RPC_URL || 'https://universal-rpc-proxy.particle.network';
}

function getWssUrl(): string {
    return process.env.UNIVERSALX_WSS_URL || 'wss://universal-app-ws-proxy.particle.network';
}

function getExplorerUrl(transactionId: string): string {
    return `https://universalx.app/activity/details?id=${transactionId}`;
}

interface WssTransactionUpdate {
    type: string;
    channel: string;
    userAddress: string;
    data: {
        transactionId: string;
        status: number;
        sender: string;
    };
}

function createWssConnection(wssUrl: string, addresses: string[]): {
    ws: WebSocket;
    waitForTransaction: (transactionId: string) => Promise<WssTransactionUpdate>;
    close: () => void;
} {
    const ws = new WebSocket(wssUrl);
    const pendingTransactions = new Map<string, {
        resolve: (value: WssTransactionUpdate) => void;
        reject: (reason: Error) => void;
    }>();

    const openPromise = new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
            const subscribeMessage = {
                type: 'subscribe',
                channel: 'address-update',
                params: {
                    addresses,
                },
            };
            ws.send(JSON.stringify(subscribeMessage));
            resolve();
        });

        ws.on('error', (err) => {
            reject(err);
        });
    });

    ws.on('message', (data: WebSocket.Data) => {
        try {
            const message = JSON.parse(data.toString()) as WssTransactionUpdate;
            if (
                message.type === 'transaction_update' &&
                message.channel === 'address-update' &&
                message.data?.transactionId
            ) {
                const pending = pendingTransactions.get(message.data.transactionId);
                if (pending && (message.data.status === 7 || message.data.status === 11)) {
                    pendingTransactions.delete(message.data.transactionId);
                    pending.resolve(message);
                }
            }
        } catch (e) {
            // Ignore parse errors
        }
    });

    ws.on('close', () => {
        for (const [, pending] of pendingTransactions) {
            pending.reject(new Error('WebSocket closed'));
        }
        pendingTransactions.clear();
    });

    return {
        ws,
        waitForTransaction: async (transactionId: string) => {
            await openPromise;
            return new Promise<WssTransactionUpdate>((resolve, reject) => {
                pendingTransactions.set(transactionId, { resolve, reject });
            });
        },
        close: () => {
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                ws.close();
            }
        },
    };
}

function getTradeToken(chain: string): { chainId: number, address: string } {
    if (chain === 'SOLANA') {
        return { chainId: CHAIN_ID.SOLANA_MAINNET as number, address: '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN' };
    }

    if (chain === 'BSC') {
        return { chainId: CHAIN_ID.BSC_MAINNET as number, address: '0xe1e93e92c0c2aff2dc4d7d4a8b250d973cad4444' };
    }

    if (chain === 'BASE') {
        return { chainId: CHAIN_ID.BASE_MAINNET as number, address: '0x6cd905df2ed214b22e0d48ff17cd4200c1c6d8a3' };
    }

    if (chain === 'ETHEREUM') {
        return { chainId: CHAIN_ID.ETHEREUM_MAINNET as number, address: '0x6982508145454Ce325dDbE47a25d4ec3d2311933' };
    }

    if (chain === 'XLAYER') {
        return { chainId: CHAIN_ID.XLAYER_MAINNET as number, address: '0x0cc24c51bf89c00c5affbfcf5e856c25ecbdb48e' };
    }

    if (chain === 'MONAD') {
        return { chainId: CHAIN_ID.MONAD_MAINNET as number, address: '0x00000000efe302beaa2b3e6e1b18d08d69a9012a' };
    }

    if (chain === 'OP') {
        return { chainId: CHAIN_ID.OPTIMISM_MAINNET as number, address: '0x4200000000000000000000000000000000000042' };
    }

    if (chain === 'ARBITRUM') {
        return { chainId: CHAIN_ID.ARBITRUM_MAINNET_ONE as number, address: '0x912CE59144191C1204E64559FE8253a0e49E6548' };
    }

    if (chain === 'POLYGON') {
        return { chainId: CHAIN_ID.POLYGON_MAINNET as number, address: '0xb33EaAd8d922B1083446DC23f610c2567fB5180f' };
    }

    if (chain === 'BERACHAIN') {
        return { chainId: CHAIN_ID.BERACHAIN_MAINNET as number, address: '0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34' };
    }

    if (chain === 'MANTLE') {
        return { chainId: CHAIN_ID.MANTLE_MAINNET as number, address: '0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34' };
    }

    if (chain === 'SONIC') {
        return { chainId: CHAIN_ID.SONIC_MAINNET as number, address: '0x3333b97138D4b086720b5aE8A7844b1345a33333' };
    }

    if (chain === 'AVALANCHE') {
        return { chainId: CHAIN_ID.AVALANCHE_MAINNET as number, address: '0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd' };
    }

    throw new Error(`Unsupported chain: ${chain}`);
}

(async () => {
    const args = parseCommandLineArgs();

    if (args.help) {
        printHelp();
        process.exit(0);
    }

    const uaMode = args.uaMode;
    const runTimes = args.runTimes;
    const sourceChain = args.sourceChain;
    const targetChain = args.targetChain;
    const feeRate = args.feeRate;
    const bribeAmount = args.bribeAmount;

    const rpcUrl = getRpcUrl();
    const wssUrl = getWssUrl();
    console.log('---- Using RPC - ', rpcUrl, '----');
    console.log('---- Using WSS - ', wssUrl, '----');

    console.log(`Running benchmark ${runTimes} time(s)...\n`);

    const privateKey = process.env[`PRIVATE_KEY_${sourceChain}`] || '';
    const wallet = new Wallet(privateKey);
    const commonParams = {
        projectId: process.env.PROJECT_ID || '',
        projectClientKey: process.env.PROJECT_CLIENT_KEY || '',
        projectAppUuid: process.env.PROJECT_APP_UUID || '',
        smartAccountOptions: {
            useEIP7702: uaMode === '7702',
            name: 'UNIVERSAL',
            version: '1.0.3',
            ownerAddress: wallet.address,
        },
        tradeConfig: {
            slippageBps: 1000, // 100 means 1%, max is 10000
            universalGas: false,
            solanaMEVTipAmount: bribeAmount,
            priorityFeeRatio: feeRate,
            mevProtection: args.mevProtection as MEV_PROTECTION_TYPE,
        },
    };

    const universalAccount = new UniversalAccount({
        ...commonParams,
        rpcUrl,
    });

    const universalAccountForSendTransaction = new UniversalAccount({
        ...commonParams,
        // for datadog tracing
        rpcUrl: rpcUrl + '?method=sendTransaction',
    });

    const getSmartAccountOptionsStartTime = performance.now();
    const smartAccountOptions = await universalAccount.getSmartAccountOptions();
    const getSmartAccountOptionsDuration = performance.now() - getSmartAccountOptionsStartTime;
    console.log('Your UA EVM Address:', smartAccountOptions.smartAccountAddress);
    console.log('Your UA Solana Address:', smartAccountOptions.solanaSmartAccountAddress);
    console.log(`getSmartAccountOptions: ${getSmartAccountOptionsDuration.toFixed(2)}ms`);
    console.log('');

    const getPrimaryAssetsStartTime = performance.now();
    const primaryAssets = await universalAccount.getPrimaryAssets();
    const getPrimaryAssetsDuration = performance.now() - getPrimaryAssetsStartTime;
    console.log(`getPrimaryAssets: ${getPrimaryAssetsDuration.toFixed(2)}ms, totalAmountInUSD: $${primaryAssets.totalAmountInUSD.toFixed(4)}`);
    console.log('');

    if (runTimes === 0) {
        console.log('runTimes=0, skipping transaction tests.');
        console.log(`\ngetSmartAccountOptions: ${getSmartAccountOptionsDuration.toFixed(2)}ms`);
        console.log(`getPrimaryAssets: ${getPrimaryAssetsDuration.toFixed(2)}ms`);
        return;
    }

    const warmupDurations: number[] = [];
    const createBuyDurations: number[] = [];
    const sendDurations: number[] = [];
    const getTransactionDurations: number[] = [];
    const sendTotalDurations: number[] = [];

    // Create WSS connection before transactions (always enabled for racing)
    console.log('---- Creating WSS connection for racing with polling ----');
    const addresses: string[] = [
        smartAccountOptions.smartAccountAddress,
        smartAccountOptions.solanaSmartAccountAddress,
    ].filter((addr): addr is string => typeof addr === 'string');
    const wssConnection = createWssConnection(wssUrl, addresses);

    for (let i = 0; i < runTimes; i++) {
        console.log(`Run ${i + 1}/${runTimes}:`);

        let sendResult = null;
        let sendStartTime = null;

        const { chainId, address } = getTradeToken(targetChain);

        if (args.warmup) {
            const warmupStartTime = performance.now();
            // warm up token to avoid cold start, for production, you can warm up the token in the background every 1s
            await universalAccount.warmUpToken({
                chainId,
                address,
            });
            const warmupEndTime = performance.now();
            const warmupDuration = warmupEndTime - warmupStartTime;
            warmupDurations.push(warmupDuration);
        } else {
            console.log('  warmup: skipped');
        }

        const createBuyStartTime = performance.now();
        const transaction = await universalAccount.createBuyTransaction(
            {
                token: { chainId, address },
                amountInUSD: '0.001',
            },
        );
        const createBuyEndTime = performance.now();
        const createBuyDuration = createBuyEndTime - createBuyStartTime;
        createBuyDurations.push(createBuyDuration);

        console.log(`  createBuyTransaction: ${createBuyDuration.toFixed(2)}ms`);

        sendStartTime = performance.now();

        // Handle 7702 Authorization
        const authorizations: EIP7702Authorization[] = [];
        for (const userOp of transaction.userOps) {
            if (!!userOp.eip7702Auth && !userOp.eip7702Delegated) {
                const authorization = wallet.authorizeSync(userOp.eip7702Auth);
                authorizations.push({
                    userOpHash: userOp.userOpHash,
                    signature: authorization.signature.serialized,
                });
            }
        }

        sendResult = await universalAccountForSendTransaction.sendTransaction(transaction, wallet.signMessageSync(getBytes(transaction.rootHash)), authorizations);
        const sendEndTime = performance.now();
        const sendDuration = sendEndTime - sendStartTime;
        sendDurations.push(sendDuration);
        console.log(`  sendTransaction: ${sendDuration.toFixed(2)}ms, status: ${sendResult.status}`);
        console.log(`  Explorer URL: ${getExplorerUrl(sendResult.transactionId)}`);
        console.log('');

        const noNeedToPoll = sendResult.status === 7 || sendResult.status === 11;

        // Wait for transaction completion via WSS and polling race
        const getTransactionStartTime = performance.now();
        let usedMethod = 'already completed';
        if (!noNeedToPoll) {
            // Race between WSS and polling - whichever completes first wins
            const pollingPromise = (async () => {
                while (true) {
                    const transactionDetail = await universalAccount.getTransaction(sendResult.transactionId);
                    if (transactionDetail && (transactionDetail.status === 7 || transactionDetail.status === 11)) {
                        return 'polling';
                    }
                    // 250ms is the minimum time between requests
                    await new Promise(resolve => setTimeout(resolve, 250));
                }
            })();

            const wssPromise = wssConnection.waitForTransaction(sendResult.transactionId).then(() => 'wss' as const);
            usedMethod = await Promise.race([wssPromise, pollingPromise]);
        }
        const getTransactionEndTime = performance.now();
        const getTransactionDuration = getTransactionEndTime - getTransactionStartTime;
        getTransactionDurations.push(getTransactionDuration);
        console.log(`  getTransaction: ${getTransactionDuration.toFixed(2)}ms (used: ${usedMethod})`);

        const sendTotalDuration = getTransactionEndTime - sendStartTime;
        sendTotalDurations.push(sendTotalDuration);
        console.log(`  sendTransactionTotal: ${sendTotalDuration.toFixed(2)}ms`);

        // avoid blocksyncing error, not required for production
        console.log('  Waiting 5 seconds to avoid blocksyncing error...');
        await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Cleanup WSS connection
    wssConnection.close();

    const createBuyStats = calculateStats(createBuyDurations);
    const sendStats = calculateStats(sendDurations);
    const getTransactionStats = calculateStats(getTransactionDurations);
    const sendTotalStats = calculateStats(sendTotalDurations);

    console.log(`\ngetSmartAccountOptions: ${getSmartAccountOptionsDuration.toFixed(2)}ms`);
    console.log(`getPrimaryAssets: ${getPrimaryAssetsDuration.toFixed(2)}ms`);

    if (args.warmup) {
        const warmupStats = calculateStats(warmupDurations);
        printStats('warmup', warmupStats);
    } else {
        console.log('\nwarmup: disabled');
    }
    printStats('createBuyTransaction', createBuyStats);
    printStats('sendTransaction', sendStats);
    printStats('getTransaction', getTransactionStats);
    printStats('sendTransactionTotal', sendTotalStats);

    console.log('');
    console.log('Source Chain:', sourceChain, ', Target Chain:', targetChain);
    console.log('Using RPC:', rpcUrl, ', Fee Rate:', feeRate, ', Bribe Amount:', bribeAmount, ', Mode: WSS+Polling Race');
})();
