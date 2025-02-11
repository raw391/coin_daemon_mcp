import { startMcpServer } from '../mcpServer';
import { ServerConfig } from '../types';

jest.mock('@modelcontextprotocol/sdk/server');
jest.mock('@modelcontextprotocol/sdk/server/stdio');
jest.mock('../rpcClient');

describe('MCP Server', () => {
  const mockConfig: ServerConfig = {
    daemons: [{
      coinName: 'zcash',
      nickname: 'zec-test',
      rpcEndpoint: '127.0.0.1:8232',
      rpcUser: 'test',
      rpcPassword: 'test'
    }]
  };

  it('should start server with valid config', async () => {
    const server = await startMcpServer(mockConfig);
    expect(server).toBeDefined();
  });

  it('should throw error with invalid config', async () => {
    const invalidConfig = {
      daemons: [{
        nickname: 'test'
      }]
    };

    await expect(startMcpServer(invalidConfig as ServerConfig))
      .rejects
      .toThrow(/Missing required field/);
  });
});