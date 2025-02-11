import { Server } from "@modelcontextprotocol/sdk/server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio";
import { RpcClient } from './rpcClient';
import { ServerConfig, DaemonConfig, RpcMethod } from './types';
import { validateConfig } from './config';

class CryptoDaemonMCP {
  private clients: Map<string, RpcClient> = new Map();
  private readonly rpcTimeout: number;

  constructor(config: ServerConfig, rpcTimeout: number = 30000) {
    validateConfig(config);
    this.rpcTimeout = rpcTimeout;
    this.initializeClients(config);
  }

  private initializeClients(config: ServerConfig) {
    for (const daemon of config.daemons) {
      this.clients.set(daemon.nickname, new RpcClient(daemon, this.rpcTimeout));
    }
  }

  getDaemons(): string[] {
    return Array.from(this.clients.keys());
  }

  async executeCommand(daemon: string, command: RpcMethod, params: any[] = []): Promise<any> {
    const client = this.clients.get(daemon);
    if (!client) {
      throw new Error(`Daemon ${daemon} not found`);
    }
    return client.makeRequest(command, params);
  }

  getClient(daemon: string): RpcClient {
    const client = this.clients.get(daemon);
    if (!client) {
      throw new Error(`Daemon ${daemon} not found`);
    }
    return client;
  }
}

export async function startMcpServer(config: ServerConfig) {
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
    async ({ daemon, command, params = [] }) => {
      try {
        const result = await cryptoMcp.executeCommand(daemon, command as RpcMethod, params);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      } catch (error) {
        return {
          isError: true,
          content: [{
            type: "text",
            text: `Error: ${error.message}`
          }]
        };
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
    async ({ daemon, address, amount, comment, subtractFee }) => {
      try {
        const client = cryptoMcp.getClient(daemon);
        const txid = await client.sendCoins({ address, amount, comment, subtractFee });
        return {
          content: [{
            type: "text",
            text: `Transaction sent successfully. TXID: ${txid}`
          }]
        };
      } catch (error) {
        return {
          isError: true,
          content: [{
            type: "text",
            text: `Error sending coins: ${error.message}`
          }]
        };
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
    async ({ daemon, fromAddress, toAddress, amount, memo }) => {
      try {
        const client = cryptoMcp.getClient(daemon);
        const opid = await client.zSendCoins(fromAddress, toAddress, amount, memo);
        return {
          content: [{
            type: "text",
            text: `Operation initiated. Operation ID: ${opid}`
          }]
        };
      } catch (error) {
        return {
          isError: true,
          content: [{
            type: "text",
            text: `Error sending shielded transaction: ${error.message}`
          }]
        };
      }
    }
  );

  server.tool(
    "shield-coins",
    "Shield transparent coins to a shielded address",
    {
      daemon: "string",
      fromAddress: "string",
      toAddress: "string",
      fee: "number?"
    },
    async ({ daemon, fromAddress, toAddress, fee }) => {
      try {
        const client = cryptoMcp.getClient(daemon);
        const opid = await client.shieldCoins({ fromAddress, toAddress, fee });
        return {
          content: [{
            type: "text",
            text: `Shield operation initiated. Operation ID: ${opid}`
          }]
        };
      } catch (error) {
        return {
          isError: true,
          content: [{
            type: "text",
            text: `Error shielding coins: ${error.message}`
          }]
        };
      }
    }
  );

  server.tool(
    "get-balance",
    "Get wallet balance",
    {
      daemon: "string"
    },
    async ({ daemon }) => {
      try {
        const client = cryptoMcp.getClient(daemon);
        const balance = await client.getBalance();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(balance, null, 2)
          }]
        };
      } catch (error) {
        return {
          isError: true,
          content: [{
            type: "text",
            text: `Error getting balance: ${error.message}`
          }]
        };
      }
    }
  );

  server.tool(
    "check-status",
    "Check daemon status",
    {
      daemon: "string"
    },
    async ({ daemon }) => {
      try {
        const client = cryptoMcp.getClient(daemon);
        const status = await client.checkStatus();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(status, null, 2)
          }]
        };
      } catch (error) {
        return {
          isError: true,
          content: [{
            type: "text",
            text: `Error checking status: ${error.message}`
          }]
        };
      }
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  for (const daemon of cryptoMcp.getDaemons()) {
    try {
      const client = cryptoMcp.getClient(daemon);
      await client.validateConnection();
      console.error(`Successfully connected to daemon: ${daemon}`);
    } catch (error) {
      console.error(`Failed to connect to daemon ${daemon}: ${error.message}`);
    }
  }

  console.error('Cryptocurrency Daemon MCP Server started');
  return server;
}