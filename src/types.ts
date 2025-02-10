export interface DaemonConfig {
  coinName: string;       // Name of the coin (e.g. "bitcoin", "zcash")
  nickname: string;       // User-friendly name
  rpcEndpoint: string;    // RPC endpoint (ip:port)
  rpcUser: string;       // RPC username
  rpcPassword: string;    // RPC password
}

export interface ServerConfig {
  daemons: DaemonConfig[];
}

export interface SendCoinsParams {
  address: string;
  amount: number;
  comment?: string;
  subtractFee?: boolean;
}

export interface ShieldCoinsParams {
  fromAddress: string;
  toAddress: string;
  fee?: number;
}

export interface RpcResponse<T = any> {
  result: T;
  error: null | {
    code: number;
    message: string;
  };
  id: string | number;
}

export interface DaemonStatus {
  version: string;
  connections: number;
  blocks: number;
  synced: boolean;
  difficulty: number;
}

export interface WalletBalance {
  transparent: number;
  shielded: number;
}

export interface AddressList {
  transparent: string[];
  shielded: string[];
}