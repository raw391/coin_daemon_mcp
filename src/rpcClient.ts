import type { Response } from 'node-fetch';
import fetch from 'node-fetch';
import { DaemonConfig, RpcResponse, SendCoinsParams, ShieldCoinsParams, RpcMethod, RpcErrorCode } from './types';
import { logger } from './logger';

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

        if (!isRetryable || isLastAttempt) throw error;

        const delay = RETRY_DELAY * attempt;
        logger.debug('RPC', `Retrying in ${delay}ms`, {
          daemon: this.daemonNickname,
          attempt,
          delay
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('Retry operation failed');
  }

  private isRetryableError(error: any): boolean {
    if (error.name === 'AbortError') return true;
    if (error.name === 'FetchError') return true;
    if (error.message?.includes('ECONNREFUSED')) return true;
    if (error.message?.includes('socket hang up')) return true;
    return false;
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
          logger.debug('RPC', `Making request to ${method}`, {
            daemon: this.daemonNickname,
            params
          });

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
            const errorText = await response.text().catch(() => 'No error details available');
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }

          const data: RpcResponse<T> = await response.json();
          if (data.error) {
            const code = data.error.code;
            const knownError = Object.values(RpcErrorCode).includes(code);
            throw new Error(
              knownError 
                ? `RPC error ${RpcErrorCode[code]}: ${data.error.message}`
                : `RPC error ${code}: ${data.error.message}`
            );
          }

          return data.result;
        } catch (err) {
          if (err.name === 'AbortError') {
            throw new Error(`RPC request to ${method} timed out after ${this.timeout}ms`);
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
      logger.info('RPC', `Validating connection to ${this.daemonNickname}`);
      await this.makeRequest('getinfo');
      this.connected = true;
      logger.info('RPC', `Successfully connected to ${this.daemonNickname}`);
    } catch (error) {
      this.connected = false;
      logger.error('RPC', `Failed to connect to ${this.daemonNickname}`, { error });
      throw new Error(`Failed to connect to RPC endpoint: ${error.message}`);
    }
  }

  // Base RPC operations remain the same but now use enhanced error handling
  async getHelp(command?: string): Promise<string> {
    return this.makeRequest('help', command ? [command] : []);
  }

  async getInfo(): Promise<any> {
    return this.makeRequest('getinfo');
  }

  // Rest of the implementation remains the same...
}