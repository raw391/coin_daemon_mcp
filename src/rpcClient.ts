import fetch from 'node-fetch';
import { 
    DaemonConfig, 
    RpcResponse, 
    RpcMethod,
    SendCoinsParams,
    WalletBalance,
    DaemonStatus
} from './types';
import { logger } from './logger';
import { 
    CryptoDaemonError, 
    RpcConnectionError,
    mapRpcErrorToCustomError,
    DaemonSyncError,
    InsufficientFundsError
} from './errors';

const DEFAULT_TIMEOUT = 30000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

export class RpcClient {
    private _endpoint: string;
    private _auth: string;
    private _timeout: number;
    private _connectionState: 'connected' | 'disconnected';
    private _daemonNickname: string;
    private _coinName: string;

    constructor(config: DaemonConfig, timeout = DEFAULT_TIMEOUT) {
        this._endpoint = `http://${config.rpcEndpoint}`;
        this._auth = Buffer.from(`${config.rpcUser}:${config.rpcPassword}`).toString('base64');
        this._timeout = timeout;
        this._daemonNickname = config.nickname;
        this._coinName = config.coinName;
        this._connectionState = 'disconnected';
    }

    get isConnected(): boolean {
        return this._connectionState === 'connected';
    }

    get coinName(): string {
        return this._coinName;
    }

    public async validateConnection(): Promise<void> {
        try {
            const response = await this.makeRequest<any>('getinfo');
            const info = response.result || {};
            this._connectionState = 'connected';

            if (!info.blocks || !info.connections) {
                throw new DaemonSyncError(info.blocks || 0, info.headers || 0);
            }
        } catch (error: unknown) {
            this._connectionState = 'disconnected';
            throw error instanceof CryptoDaemonError 
                ? error 
                : new RpcConnectionError(
                    this._endpoint, 
                    error instanceof Error ? error.message : 'Unknown connection error'
                );
        }
    }

    public async makeRequest<T = any>(
        method: RpcMethod, 
        params: any[] = []
    ): Promise<RpcResponse<T>> {
        const startTime = Date.now();
        let success = false;
        let error: unknown = null;

        try {
            const result = await this.retryableRequest(async () => {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this._timeout);

                try {
                    const response = await fetch(this._endpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Basic ${this._auth}`
                        },
                        body: JSON.stringify({
                            jsonrpc: '2.0',
                            id: Date.now(),
                            method,
                            params
                        }),
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        throw new RpcConnectionError(this._endpoint, `HTTP Error: ${response.status}`);
                    }

                    const responseData = await response.json();
                    
                    if (responseData.error) {
                        throw mapRpcErrorToCustomError(
                            responseData.error.code, 
                            responseData.error.message
                        );
                    }

                    return responseData as RpcResponse<T>;
                } catch (err: unknown) {
                    if (err instanceof Error && err.name === 'AbortError') {
                        throw new RpcConnectionError(
                            this._endpoint, 
                            `Timeout after ${this._timeout}ms`
                        );
                    }
                    throw err;
                }
            });

            success = true;
            return result;
        } catch (processError: unknown) {
            error = processError;
            throw processError;
        } finally {
            const duration = Date.now() - startTime;
            logger.logRpcCall(
                this._daemonNickname,
                method,
                params,
                duration,
                success,
                error
            );
        }
    }

    private async retryableRequest<T>(
        operation: () => Promise<RpcResponse<T>>, 
        retries = MAX_RETRIES
    ): Promise<RpcResponse<T>> {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                return await operation();
            } catch (error: unknown) {
                const isRetryable = error instanceof RpcConnectionError || 
                               error instanceof DaemonSyncError;
                const isLastAttempt = attempt === retries;

                if (error instanceof Error) {
                    logger.warn(
                        'RPC', 
                        `Request failed (attempt ${attempt}/${retries})`,
                        {
                            daemon: this._daemonNickname,
                            error: error.message,
                            isRetryable,
                            isLastAttempt
                        }
                    );
                }

                if (!isRetryable || isLastAttempt) {
                    if (error instanceof CryptoDaemonError) {
                        throw error;
                    }
                    throw new RpcConnectionError(
                        this._endpoint, 
                        error instanceof Error ? error.message : 'Unknown error'
                    );
                }

                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
            }
        }
        throw new RpcConnectionError(this._endpoint, 'Max retries exceeded');
    }

    /**
     * Execute any RPC command with the given parameters
     */
    public async executeCommand<T = any>(method: RpcMethod, params: any[] = []): Promise<T> {
        const response = await this.makeRequest<T>(method, params);
        return response.result;
    }

    /**
     * Send coins to a transparent address
     */
    public async sendCoins(params: SendCoinsParams): Promise<string> {
        logger.info('RPC', `Sending ${params.amount} coins to ${params.address}`, {
            daemon: this._daemonNickname,
            subtractFee: params.subtractFee || false
        });

        try {
            // Check balance first to fail fast if insufficient funds
            const balance = await this.getBalance();
            if (balance.transparent < params.amount) {
                throw new InsufficientFundsError(params.amount, balance.transparent);
            }

            const cmdParams = [
                params.address,
                params.amount,
                params.comment || '',
                '', // comment_to (not used)
                params.subtractFee || false
            ];

            const response = await this.makeRequest<string>('sendtoaddress', cmdParams);
            return response.result; // txid
        } catch (error) {
            logger.error('RPC', `Failed to send coins to ${params.address}`, {
                daemon: this._daemonNickname,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }

    /**
     * Send coins using a shielded transaction
     */
    public async zSendCoins(fromAddress: string, toAddress: string, amount: number, memo?: string): Promise<string> {
        logger.info('RPC', `Sending ${amount} shielded coins from ${fromAddress} to ${toAddress}`, {
            daemon: this._daemonNickname,
            hasMemo: !!memo
        });

        try {
            const params = [
                fromAddress,
                [
                    {
                        address: toAddress,
                        amount: amount,
                        ...(memo && { memo })
                    }
                ]
            ];

            // For Zcash-based coins
            const response = await this.makeRequest<string>('z_sendmany', params);
            return response.result; // operation id
        } catch (error) {
            logger.error('RPC', `Failed to send shielded coins to ${toAddress}`, {
                daemon: this._daemonNickname,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }

    /**
     * Get wallet balances (transparent and shielded)
     */
    public async getBalance(): Promise<WalletBalance> {
        try {
            let transparentBalance = 0;
            let shieldedBalance = 0;

            // Different coins have different RPC methods
            if (this._coinName.toLowerCase() === 'zcash' || this._coinName.toLowerCase().includes('zec')) {
                // Zcash and forks
                const response = await this.makeRequest<{ transparent: string, private: string, total: string }>('z_gettotalbalance');
                transparentBalance = parseFloat(response.result.transparent);
                shieldedBalance = parseFloat(response.result.private);
            } else {
                // Bitcoin and most other coins
                const response = await this.makeRequest<number>('getbalance');
                transparentBalance = response.result;
            }

            return {
                transparent: transparentBalance,
                shielded: shieldedBalance
            };
        } catch (error) {
            logger.error('RPC', 'Failed to get balance', {
                daemon: this._daemonNickname,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }

    /**
     * Get daemon status information
     */
    public async checkStatus(): Promise<DaemonStatus> {
        try {
            // Get blockchain info
            const blockchain = await this.makeRequest<{
                blocks: number;
                headers: number;
                difficulty: number;
            }>('getblockchaininfo');

            // Get network info
            const network = await this.makeRequest<{
                version: number;
                subversion: string;
                connections: number;
            }>('getnetworkinfo');

            const status: DaemonStatus = {
                version: network.result.subversion || `v${network.result.version}`,
                connections: network.result.connections,
                blocks: blockchain.result.blocks,
                synced: blockchain.result.blocks >= blockchain.result.headers,
                difficulty: blockchain.result.difficulty
            };

            return status;
        } catch (error) {
            logger.error('RPC', 'Failed to check daemon status', {
                daemon: this._daemonNickname,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
}
