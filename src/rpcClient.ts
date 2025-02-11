import type { Response } from 'node-fetch';
import fetch from 'node-fetch';
import { DaemonConfig, RpcResponse, SendCoinsParams, ShieldCoinsParams, RpcMethod, RpcErrorCode } from './types';

const DEFAULT_TIMEOUT = 30000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

export class RpcClient {
  private endpoint: string;
  private auth: string;
  private timeout: number;
  private connected: boolean = false;

  constructor(config: DaemonConfig, timeout: number = DEFAULT_TIMEOUT) {
    this.endpoint = `http://${config.rpcEndpoint}`;
    this.auth = Buffer.from(`${config.rpcUser}:${config.rpcPassword}`).toString('base64');
    this.timeout = timeout;
  }

  private async retryableRequest<T>(operation: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const isRetryable = this.isRetryableError(error);
        const isLastAttempt = attempt === retries;

        if (!isRetryable || isLastAttempt) throw error;

        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
        console.error(`Retry attempt ${attempt} for RPC request`);
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

    return this.retryableRequest(async () => {
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
      } catch (error) {
        if (error.name === 'AbortError') {
          throw new Error(`RPC request to ${method} timed out after ${this.timeout}ms`);
        }
        throw error;
      }
    });
  }

  // Rest of the class implementation remains the same...
}