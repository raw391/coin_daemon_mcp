import { ServerConfig, DaemonConfig } from './types';

export function validateConfig(config: ServerConfig): void {
  if (!config.daemons || !Array.isArray(config.daemons)) {
    throw new Error('Configuration must include a "daemons" array');
  }

  if (config.daemons.length === 0) {
    throw new Error('At least one daemon configuration is required');
  }

  const nicknames = new Set<string>();
  
  config.daemons.forEach((daemon, index) => {
    try {
      validateDaemonConfig(daemon);
    } catch (error) {
      throw new Error(`Daemon ${index + 1} (${daemon.nickname || 'unnamed'}): ${error.message}`);
    }
    
    if (nicknames.has(daemon.nickname)) {
      throw new Error(`Duplicate daemon nickname found: ${daemon.nickname}`);
    }
    nicknames.add(daemon.nickname);
  });
}

function validateDaemonConfig(config: DaemonConfig): void {
  const required: (keyof DaemonConfig)[] = ['coinName', 'nickname', 'rpcEndpoint', 'rpcUser', 'rpcPassword'];
  
  required.forEach(field => {
    if (!config[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  });

  // Validate RPC endpoint format
  const endpointMatch = config.rpcEndpoint.match(/^([^:]+):(\d+)$/);
  if (!endpointMatch) {
    throw new Error('RPC endpoint must be in format "host:port"');
  }

  const [, host, portStr] = endpointMatch;
  const port = parseInt(portStr, 10);
  
  if (host.length === 0) {
    throw new Error('Invalid RPC host');
  }

  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error('Invalid RPC port number (must be between 1-65535)');
  }
}