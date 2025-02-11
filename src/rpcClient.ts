import type { Response } from 'node-fetch';
import fetch from 'node-fetch';
import { DaemonConfig, RpcResponse, SendCoinsParams, ShieldCoinsParams } from './types';

export class RpcClient {
  private endpoint: string;
  private auth: string;

  constructor(config: DaemonConfig) {
    this.endpoint = `http://${config.rpcEndpoint}`;
    this.auth = Buffer.from(`${config.rpcUser}:${config.rpcPassword}`).toString('base64');
  }

  private async makeRequest<T = any>(method: string, params: any[] = []): Promise<T> {
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
        })
      });

      if (!response.ok) {
        throw new Error(`RPC request failed: ${response.status} ${response.statusText}`);
      }

      const data: RpcResponse<T> = await response.json();
      if (data.error) {
        throw new Error(`RPC error ${data.error.code}: ${data.error.message}`);
      }

      return data.result;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`RPC request to ${method} failed: ${error.message}`);
      }
      throw error;
    }
  }

  // Rest of the class implementation remains the same...
}