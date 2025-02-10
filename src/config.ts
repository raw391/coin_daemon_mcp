import { ServerConfig, DaemonConfig } from './types';

export function validateConfig(config: ServerConfig): void {
  if (!config.daemons || !Array.isArray(config.daemons)) {
    throw new Error('Configuration must include a "daemons" array');
  }

  if (config.daemons.length === 0) {
    throw new Error('At least one daemon configuration is required');
  }

  // Check for duplicate nicknames
  const nicknames = new Set<string>();
  
  for (const daemon of config.daemons) {
    validateDaemonConfig(daemon);
    
    if (nicknames.has(daemon.nickname)) {
      throw new Error(`Duplicate daemon nickname found: ${daemon.nickname}`);
    }
    nicknames.add(daemon.nickname);
  }
}

function validateDaemonConfig(config: DaemonConfig): void {
  if (!config.coinName) {
    throw new Error('Daemon configuration must include "coinName"');
  }

  if (!config.nickname) {
    throw new Error('Daemon configuration must include "nickname"');
  }

  if (!config.rpcEndpoint) {
    throw new Error('Daemon configuration must include "rpcEndpoint"');
  }

  if (!config.rpcUser) {
    throw new Error('Daemon configuration must include "rpcUser"');
  }

  if (!config.rpcPassword) {
    throw new Error('Daemon configuration must include "rpcPassword"');
  }

  // Validate RPC endpoint format
  const endpointParts = config.rpcEndpoint.split(':');
  if (endpointParts.length !== 2) {
    throw new Error('RPC endpoint must be in format "host:port"');
  }

  const port = parseInt(endpointParts[1], 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error('Invalid RPC port number');
  }
}