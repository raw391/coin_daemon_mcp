import { DaemonConfig, RpcResponse, SendCoinsParams, ShieldCoinsParams } from './types';

export class RpcClient {
  private endpoint: string;
  private auth: string;

  constructor(config: DaemonConfig) {
    this.endpoint = `http://${config.rpcEndpoint}`;
    this.auth = Buffer.from(`${config.rpcUser}:${config.rpcPassword}`).toString('base64');
  }

  private async makeRequest<T = any>(method: string, params: any[] = []): Promise<T> {
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
      throw new Error(`RPC request failed: ${response.statusText}`);
    }

    const data: RpcResponse<T> = await response.json();
    if (data.error) {
      throw new Error(`RPC error: ${data.error.message}`);
    }

    return data.result;
  }

  // Base RPC operations
  async getHelp(command?: string): Promise<string> {
    return this.makeRequest('help', command ? [command] : []);
  }

  async getInfo(): Promise<any> {
    return this.makeRequest('getinfo');
  }

  // Transaction operations
  async sendCoins({ address, amount, comment = "", subtractFee = false }: SendCoinsParams): Promise<string> {
    return this.makeRequest('sendtoaddress', [address, amount, comment, "", subtractFee]);
  }

  async zSendCoins(fromAddress: string, toAddress: string, amount: number, memo?: string): Promise<string> {
    const recipients = [{
      address: toAddress,
      amount: amount,
      ...(memo && { memo: Buffer.from(memo).toString('hex') })
    }];
    return this.makeRequest('z_sendmany', [fromAddress, recipients]);
  }

  // Wallet operations
  async backupWallet(filename: string): Promise<void> {
    return this.makeRequest('backupwallet', [filename]);
  }

  async importWallet(filename: string): Promise<void> {
    return this.makeRequest('z_importwallet', [filename]);
  }

  async listAddresses(): Promise<any> {
    const transparentAddresses = await this.makeRequest('listaddresses');
    let zAddresses: any[] = [];
    try {
      zAddresses = await this.makeRequest('z_listaddresses');
    } catch (error) {
      // Not all coins support z_listaddresses
    }
    return { transparent: transparentAddresses, shielded: zAddresses };
  }

  async getBalance(): Promise<any> {
    const transparentBalance = await this.makeRequest('getbalance');
    let shieldedBalance = 0;
    try {
      const zBalance = await this.makeRequest('z_gettotalbalance');
      shieldedBalance = zBalance.private;
    } catch (error) {
      // Not all coins support z_gettotalbalance
    }
    return { transparent: transparentBalance, shielded: shieldedBalance };
  }

  async checkStatus(): Promise<any> {
    const info = await this.getInfo();
    const networkInfo = await this.makeRequest('getnetworkinfo');
    const blockchainInfo = await this.makeRequest('getblockchaininfo');
    
    return {
      version: info.version,
      connections: networkInfo.connections,
      blocks: blockchainInfo.blocks,
      synced: !blockchainInfo.initialblockdownload,
      difficulty: blockchainInfo.difficulty
    };
  }

  async shieldCoins({ fromAddress, toAddress, fee }: ShieldCoinsParams): Promise<string> {
    if (fromAddress === "*") {
      return this.makeRequest('z_shieldcoinbase', ["*", toAddress, fee]);
    } else {
      const balance = await this.makeRequest('getaddressbalance', [fromAddress]);
      return this.zSendCoins(fromAddress, toAddress, balance.balance);
    }
  }

  async restartDaemon(): Promise<void> {
    try {
      await this.makeRequest('stop');
    } catch (error) {
      // Error is expected as daemon will shut down
    }
  }
}