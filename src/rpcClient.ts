import type { Response } from 'node-fetch';
import fetch from 'node-fetch';
import { DaemonConfig, RpcResponse, SendCoinsParams, ShieldCoinsParams, RpcMethod, RpcErrorCode } from './types';
import { logger } from './logger';
import { 
  CryptoDaemonError, 
  RpcConnectionError,
  mapRpcErrorToCustomError,
  InsufficientFundsError,
  TransactionError,
  DaemonSyncError
} from './errors';

const DEFAULT_TIMEOUT = 30000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

export class RpcClient {
  private endpoint: string;
  private auth: string;
  private timeout: number;
  private connected: boolean = false;
  private daemonNickname: string;

  constructor(config: DaemonConfig, timeout: number = DEFAULT_TIMEOUT) {
    this.endpoint = `http://${config.rpcEndpoint}`;
    this.auth = Buffer.from(`${config.rpcUser}:${config.rpcPassword}`).toString('base64');
    this.timeout = timeout;
    this.daemonNickname = config.nickname;
  }

  private async retryableRequest<T>(operation: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const isRetryable = this.isRetryableError(error);
        const isLastAttempt = attempt === retries;

        logger.warn('RPC', `Request failed (attempt ${attempt}/${retries})`, {
          daemon: this.daemonNickname,
          error: error.message,
          isRetryable,
          isLastAttempt
        });

        if (!isRetryable || isLastAttempt) {
          if (error instanceof CryptoDaemonError) {
            throw error;
          }
          throw new RpcConnectionError(this.endpoint, error.message);
        }

        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
      }
    }
    throw new RpcConnectionError(this.endpoint, 'Max retries exceeded');
  }

  private async makeRequest<T = any>(method: RpcMethod, params: any[] = []): Promise<T> {
    if (!this.connected && method !== 'getinfo') {
      await this.validateConnection();
    }

    const startTime = Date.now();
    let success = false;
    let error: any;

    try {
      const result = await this.retryableRequest(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
          const response = await fetch(this.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${this.auth}`
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
            throw new RpcConnectionError(this.endpoint, `HTTP ${response.status}`);
          }

          const data: RpcResponse<T> = await response.json();
          if (data.error) {
            throw mapRpcErrorToCustomError(data.error.code, data.error.message);
          }

          return data.result;
        } catch (err) {
          if (err.name === 'AbortError') {
            throw new RpcConnectionError(this.endpoint, `Timeout after ${this.timeout}ms`);
          }
          throw err;
        }
      });

      success = true;
      return result;
    } catch (err) {
      error = err;
      throw err;
    } finally {
      const duration = Date.now() - startTime;
      logger.logRpcCall(
        this.daemonNickname,
        method,
        params,
        duration,
        success,
        error
      );
    }
  }

  async validateConnection(): Promise<void> {
    try {
      const info = await this.makeRequest('getinfo');
      this.connected = true;
      if (!info.blocks || !info.connections) {
        throw new DaemonSyncError(info.blocks || 0, info.headers || 0);
      }
    } catch (error) {
      this.connected = false;
      throw error instanceof CryptoDaemonError ? error : 
        new RpcConnectionError(this.endpoint, error.message);
    }
  }

  async sendCoins({ address, amount, comment = "", subtractFee = false }: SendCoinsParams): Promise<string> {
    try {
      return await this.makeRequest('sendtoaddress', [address, amount, comment, "", subtractFee]);
    } catch (error) {
      if (error instanceof InsufficientFundsError) {
        throw error;
      }
      throw new TransactionError(`Failed to send coins: ${error.message}`);
    }
  }

  async zSendCoins(fromAddress: string, toAddress: string, amount: number, memo?: string): Promise<string> {
    const recipients = [{
      address: toAddress,
      amount: amount,
      ...(memo && { memo: Buffer.from(memo).toString('hex') })
    }];
    try {
      return await this.makeRequest('z_sendmany', [fromAddress, recipients]);
    } catch (error) {
      throw new TransactionError(`Failed to send shielded transaction: ${error.message}`);
    }
  }

  async getBalance(): Promise<any> {
    const transparentBalance = await this.makeRequest('getbalance');
    let shieldedBalance = 0;
    try {
      const zBalance = await this.makeRequest('z_gettotalbalance');
      shieldedBalance = zBalance.private;
    } catch (error) {
      logger.warn('RPC', 'Failed to get shielded balance', { error: error.message });
    }
    return { transparent: transparentBalance, shielded: shieldedBalance };
  }

  async checkStatus(): Promise<any> {
    const info = await this.makeRequest('getinfo');
    const networkInfo = await this.makeRequest('getnetworkinfo');
    const blockchainInfo = await this.makeRequest('getblockchaininfo');
    
    if (!blockchainInfo.blocks || blockchainInfo.blocks < blockchainInfo.headers) {
      throw new DaemonSyncError(blockchainInfo.blocks, blockchainInfo.headers);
    }

    return {
      version: info.version,
      connections: networkInfo.connections,
      blocks: blockchainInfo.blocks,
      synced: !blockchainInfo.initialblockdownload,
      difficulty: blockchainInfo.difficulty
    };
  }
}