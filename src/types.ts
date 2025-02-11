export interface DaemonConfig {
  coinName: string;
  nickname: string;
  rpcEndpoint: string;
  rpcUser: string;
  rpcPassword: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export interface ServerConfig {
  daemons: DaemonConfig[];
  defaultTimeout?: number;
  defaultMaxRetries?: number;
  defaultRetryDelay?: number;
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

export enum RpcErrorCode {
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
  PARSE_ERROR = -32700,
  MISC_ERROR = -1,
  FORBIDDEN_BY_SAFE_MODE = -2,
  TYPE_ERROR = -3,
  INVALID_ADDRESS_OR_KEY = -5,
  OUT_OF_MEMORY = -7,
  INVALID_PARAMETER = -8,
  DATABASE_ERROR = -20,
  DESERIALIZATION_ERROR = -22,
  VERIFY_ERROR = -25,
  VERIFY_REJECTED = -26,
  VERIFY_ALREADY_IN_CHAIN = -27,
  IN_WARMUP = -28
}

export interface RpcError {
  code: RpcErrorCode;
  message: string;
}

export interface RpcResponse<T = any> {
  result: T;
  error: null | RpcError;
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

export type RpcMethod =
  | 'getinfo'
  | 'help'
  | 'stop'
  | 'getbalance'
  | 'listaddresses'
  | 'sendtoaddress'
  | 'z_sendmany'
  | 'z_shieldcoinbase'
  | 'getaddressbalance'
  | 'backupwallet'
  | 'z_importwallet'
  | 'z_listaddresses'
  | 'z_gettotalbalance'
  | 'getnetworkinfo'
  | 'getblockchaininfo';