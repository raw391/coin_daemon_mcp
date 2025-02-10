import { validateConfig } from '../config';
import { ServerConfig } from '../types';

describe('Configuration Validation', () => {
  const validConfig: ServerConfig = {
    daemons: [
      {
        coinName: "zcash",
        nickname: "zec-main",
        rpcEndpoint: "127.0.0.1:8232",
        rpcUser: "user",
        rpcPassword: "password"
      }
    ]
  };

  it('should accept valid configuration', () => {
    expect(() => validateConfig(validConfig)).not.toThrow();
  });

  it('should reject empty daemons array', () => {
    const config = {
      daemons: []
    };
    expect(() => validateConfig(config)).toThrow('At least one daemon configuration is required');
  });

  it('should reject missing daemons array', () => {
    const config = {} as ServerConfig;
    expect(() => validateConfig(config)).toThrow('Configuration must include a "daemons" array');
  });

  it('should reject duplicate nicknames', () => {
    const config = {
      daemons: [
        {
          coinName: "zcash",
          nickname: "main",
          rpcEndpoint: "127.0.0.1:8232",
          rpcUser: "user",
          rpcPassword: "password"
        },
        {
          coinName: "bitcoin",
          nickname: "main",
          rpcEndpoint: "127.0.0.1:8332",
          rpcUser: "user",
          rpcPassword: "password"
        }
      ]
    };
    expect(() => validateConfig(config)).toThrow('Duplicate daemon nickname found: main');
  });

  it('should reject invalid RPC endpoint format', () => {
    const config = {
      daemons: [
        {
          coinName: "zcash",
          nickname: "zec-main",
          rpcEndpoint: "localhost",
          rpcUser: "user",
          rpcPassword: "password"
        }
      ]
    };
    expect(() => validateConfig(config)).toThrow('RPC endpoint must be in format "host:port"');
  });

  it('should reject invalid port numbers', () => {
    const config = {
      daemons: [
        {
          coinName: "zcash",
          nickname: "zec-main",
          rpcEndpoint: "127.0.0.1:99999",
          rpcUser: "user",
          rpcPassword: "password"
        }
      ]
    };
    expect(() => validateConfig(config)).toThrow('Invalid RPC port number');
  });

  it('should reject missing required fields', () => {
    const requiredFields = ['coinName', 'nickname', 'rpcEndpoint', 'rpcUser', 'rpcPassword'];
    
    for (const field of requiredFields) {
      const config = {
        daemons: [
          {
            ...validConfig.daemons[0],
            [field]: undefined
          }
        ]
      };
      expect(() => validateConfig(config)).toThrow(`Daemon configuration must include "${field}"`);
    }
  });
});