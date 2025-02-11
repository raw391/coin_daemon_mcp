export class CryptoDaemonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CryptoDaemonError';
  }
}

export class RpcConnectionError extends CryptoDaemonError {
  constructor(endpoint: string, details: string) {
    super(`Failed to connect to ${endpoint}: ${details}`);
    this.name = 'RpcConnectionError';
  }
}

export class InsufficientFundsError extends CryptoDaemonError {
  constructor(required: number, available: number) {
    super(`Insufficient funds: required ${required}, available ${available}`);
    this.name = 'InsufficientFundsError';
  }
}

export class InvalidAddressError extends CryptoDaemonError {
  constructor(address: string) {
    super(`Invalid address: ${address}`);
    this.name = 'InvalidAddressError';
  }
}

export class TransactionError extends CryptoDaemonError {
  public readonly txid?: string;
  
  constructor(message: string, txid?: string) {
    super(message);
    this.name = 'TransactionError';
    this.txid = txid;
  }
}

export class DaemonSyncError extends CryptoDaemonError {
  constructor(blocks: number, networkBlocks: number) {
    super(`Daemon not synced: local ${blocks}, network ${networkBlocks}`);
    this.name = 'DaemonSyncError';
  }
}

export class WalletLockError extends CryptoDaemonError {
  constructor() {
    super('Wallet is locked');
    this.name = 'WalletLockError';
  }
}

export class FeeEstimationError extends CryptoDaemonError {
  constructor(details: string) {
    super(`Failed to estimate fee: ${details}`);
    this.name = 'FeeEstimationError';
  }
}

export function mapRpcErrorToCustomError(code: number, message: string, data?: any): CryptoDaemonError {
  switch (code) {
    case -6:
      return new InsufficientFundsError(data?.required || 0, data?.available || 0);
    case -5:
      return new InvalidAddressError(data?.address || 'unknown');
    case -4:
      return new WalletLockError();
    case -3:
      return new FeeEstimationError(message);
    case -1:
      if (message.includes('sync')) {
        return new DaemonSyncError(data?.blocks || 0, data?.networkBlocks || 0);
      }
      break;
  }
  return new CryptoDaemonError(message);
}