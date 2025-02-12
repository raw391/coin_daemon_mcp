import { Server } from "@modelcontextprotocol/sdk/server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio";
import { RpcClient } from './rpcClient';
import { ServerConfig, DaemonConfig, RpcMethod } from './types';
import { validateConfig } from './config';
import { logger } from './logger';
import { CryptoDaemonError } from './errors';

interface ExecuteCommandParams {
  daemon: string;
  command: string;
  params?: any[];
}

interface SendCoinsParams {
  daemon: string;
  address: string;
  amount: number;
  comment?: string;
  subtractFee?: boolean;
}

interface ZSendCoinsParams {
  daemon: string;
  fromAddress: string;
  toAddress: string;
  amount: number;
  memo?: string;
}

interface DaemonParam {
  daemon: string;
}

class CryptoDaemonMCP {
  private clients: Map<string, RpcClient> = new Map();
  private readonly rpcTimeout: number;

  constructor(config: ServerConfig, rpcTimeout: number = 30000) {
    logger.info('MCP', 'Initializing CryptoDaemonMCP', { 
      daemonCount: config.daemons.length,
      rpcTimeout 
    });

    validateConfig(config);
    this.rpcTimeout = rpcTimeout;
    this.initializeClients(config);
  }

  private initializeClients(config: ServerConfig) {
    for (const daemon of config.daemons) {
      logger.info('MCP', `Initializing client for daemon: ${daemon.nickname}`, {
        coinName: daemon.coinName,
        endpoint: daemon.rpcEndpoint
      });
      this.clients.set(daemon.nickname, new RpcClient(daemon, this.rpcTimeout));
    }
  }

  getDaemons(): string[] {
    return Array.from(this.clients.keys());
  }

  getClient(daemon: string): RpcClient {
    const client = this.clients.get(daemon);
    if (!client) {
      logger.error('MCP', `Daemon not found: ${daemon}`);
      throw new Error(`Daemon ${daemon} not found`);
    }
    return client;
  }
}

export async function startMcpServer(config: ServerConfig) {
  logger.info('MCP', 'Starting MCP Server');
  const cryptoMcp = new CryptoDaemonMCP(config);

  const server = new Server({
    name: "crypto-daemon-mcp",
    version: "1.0.0",
  }, {
    capabilities: {
      tools: {}
    }
  });

  server.tool(
    "execute-command",
    "Execute a command on a specific cryptocurrency daemon",
    {
      daemon: "string",
      command: "string",
      params: "any[]"
    },
    async ({ daemon, command, params = [] }: ExecuteCommandParams) => {
      try {
        logger.info('MCP', 'Executing command', { daemon, command, params });
        const client = cryptoMcp.getClient(daemon);
        const result = await client.executeCommand(command as RpcMethod, params);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      } catch (error) {
        if (error instanceof Error) {
          logger.error('MCP', 'Command execution failed', { 
            daemon, 
            command, 
            params,
            error: error.message 
          });
          return {
            isError: true,
            content: [{
              type: "text",
              text: `Error: ${error.message}`
            }]
          };
        }
        throw error;
      }
    }
  );

  server.tool(
    "send-coins",
    "Send coins to a transparent address",
    {
      daemon: "string",
      address: "string",
      amount: "number",
      comment: "string?",
      subtractFee: "boolean?"
    },
    async ({ daemon, address, amount, comment, subtractFee }: SendCoinsParams) => {
      try {
        logger.info('MCP', 'Sending coins', { 
          daemon, 
          address, 
          amount,
          subtractFee 
        });
        const client = cryptoMcp.getClient(daemon);
        const txid = await client.sendCoins({ address, amount, comment, subtractFee });
        logger.info('MCP', 'Coins sent successfully', { daemon, txid });
        return {
          content: [{
            type: "text",
            text: `Transaction sent successfully. TXID: ${txid}`
          }]
        };
      } catch (error) {
        if (error instanceof Error) {
          logger.error('MCP', 'Failed to send coins', {
            daemon,
            address,
            amount,
            error: error.message
          });
          return {
            isError: true,
            content: [{
              type: "text",
              text: `Error sending coins: ${error.message}`
            }]
          };
        }
        throw error;
      }
    }
  );

  server.tool(
    "zsend-coins",
    "Send coins using shielded transaction",
    {
      daemon: "string",
      fromAddress: "string",
      toAddress: "string",
      amount: "number",
      memo: "string?"
    },
    async ({ daemon, fromAddress, toAddress, amount, memo }: ZSendCoinsParams) => {
      try {
        logger.info('MCP', 'Sending shielded transaction', {
          daemon,
          fromAddress,
          toAddress,
          amount
        });
        const client = cryptoMcp.getClient(daemon);
        const opid = await client.zSendCoins(fromAddress, toAddress, amount, memo);
        logger.info('MCP', 'Shielded transaction initiated', { daemon, opid });
        return {
          content: [{
            type: "text",
            text: `Operation initiated. Operation ID: ${opid}`
          }]
        };
      } catch (error) {
        if (error instanceof Error) {
          logger.error('MCP', 'Failed to send shielded transaction', {
            daemon,
            fromAddress,
            toAddress,
            error: error.message
          });
          return {
            isError: true,
            content: [{
              type: "text",
              text: `Error sending shielded transaction: ${error.message}`
            }]
          };
        }
        throw error;
      }
    }
  );

  server.tool(
    "get-balance",
    "Get wallet balance",
    {
      daemon: "string"
    },
    async ({ daemon }: DaemonParam) => {
      try {
        logger.info('MCP', 'Getting balance', { daemon });
        const client = cryptoMcp.getClient(daemon);
        const balance = await client.getBalance();
        logger.info('MCP', 'Balance retrieved', { daemon, balance });
        return {
          content: [{
            type: "text",
            text: JSON.stringify(balance, null, 2)
          }]
        };
      } catch (error) {
        if (error instanceof Error) {
          logger.error('MCP', 'Failed to get balance', {
            daemon,
            error: error.message
          });
          return {
            isError: true,
            content: [{
              type: "text",
              text: `Error getting balance: ${error.message}`
            }]
          };
        }
        throw error;
      }
    }
  );

  server.tool(
    "check-status",
    "Check daemon status",
    {
      daemon: "string"
    },
    async ({ daemon }: DaemonParam) => {
      try {
        logger.info('MCP', 'Checking daemon status', { daemon });
        const client = cryptoMcp.getClient(daemon);
        const status = await client.checkStatus();
        logger.info('MCP', 'Status check complete', { daemon, status });
        return {
          content: [{
            type: "text",
            text: JSON.stringify(status, null, 2)
          }]
        };
      } catch (error) {
        if (error instanceof Error) {
          logger.error('MCP', 'Failed to check status', {
            daemon,
            error: error.message
          });
          return {
            isError: true,
            content: [{
              type: "text",
              text: `Error checking status: ${error.message}`
            }]
          };
        }
        throw error;
      }
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  for (const daemon of cryptoMcp.getDaemons()) {
    try {
      const client = cryptoMcp.getClient(daemon);
      await client.validateConnection();
      logger.info('MCP', `Successfully connected to daemon: ${daemon}`);
    } catch (error) {
      if (error instanceof Error) {
        logger.error('MCP', `Failed to connect to daemon ${daemon}`, {
          error: error.message
        });
      }
    }
  }

  logger.info('MCP', 'Cryptocurrency Daemon MCP Server started');
  return server;
}