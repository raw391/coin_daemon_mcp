import fetch from 'node-fetch';
import { 
    DaemonConfig, 
    RpcResponse, 
    RpcMethod 
} from './types';
import { logger } from './logger';
import { 
    CryptoDaemonError, 
    RpcConnectionError,
    mapRpcErrorToCustomError,
    DaemonSyncError
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

    constructor(config: DaemonConfig, timeout = DEFAULT_TIMEOUT) {
        this._endpoint = `http://${config.rpcEndpoint}`;
        this._auth = Buffer.from(`${config.rpcUser}:${config.rpcPassword}`).toString('base64');
        this._timeout = timeout;
        this._daemonNickname = config.nickname;
        this._connectionState = 'disconnected';
    }

    get isConnected(): boolean {
        return this._connectionState === 'connected';
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
}
