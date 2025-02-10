import { Server } from "@modelcontextprotocol/sdk/server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio";
import { RpcClient } from './rpcClient';
import { ServerConfig, DaemonConfig } from './types';

class CryptoDaemonMCP {
  private config: ServerConfig;
  private clients: Map<string, RpcClient> = new Map();

  constructor(config: ServerConfig) {
    this.config = config;
    this.initializeClients();
  }

  private initializeClients() {
    for (const daemon of this.config.daemons) {
      this.clients.set(daemon.nickname, new RpcClient(daemon));
    }
  }

  getDaemons(): string[] {
    return Array.from(this.clients.keys());
  }

  async executeCommand(daemon: string, command: string, params: any[] = []): Promise<any> {
    const client = this.clients.get(daemon);
    if (!client) {
      throw new Error(`Daemon ${daemon} not found`);
    }
    return client.makeRequest(command, params);
  }

  async getCommandHelp(daemon: string, command?: string): Promise<string> {
    const client = this.clients.get(daemon);
    if (!client) {
      throw new Error(`Daemon ${daemon} not found`);
    }
    return client.getHelp(command);
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

  // Generic command execution tool
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
        const result = await cryptoMcp.executeCommand(daemon, command, params);
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

  // Send coins tool
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
        const client = cryptoMcp.clients.get(daemon);
        if (!client) throw new Error(`Daemon ${daemon} not found`);
        
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

  // Send shielded transaction tool
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
        const client = cryptoMcp.clients.get(daemon);
        if (!client) throw new Error(`Daemon ${daemon} not found`);
        
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

  // Shield coins tool
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
        const client = cryptoMcp.clients.get(daemon);
        if (!client) throw new Error(`Daemon ${daemon} not found`);
        
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

  // Backup wallet tool
  server.tool(
    "backup-wallet",
    "Backup the wallet to a file",
    {
      daemon: "string",
      filename: "string"
    },
    async ({ daemon, filename }) => {
      try {
        const client = cryptoMcp.clients.get(daemon);
        if (!client) throw new Error(`Daemon ${daemon} not found`);
        
        await client.backupWallet(filename);
        return {
          content: [{
            type: "text",
            text: `Wallet backed up successfully to ${filename}`
          }]
        };
      } catch (error) {
        return {
          isError: true,
          content: [{
            type: "text",
            text: `Error backing up wallet: ${error.message}`
          }]
        };
      }
    }
  );

  // List addresses tool
  server.tool(
    "list-addresses",
    "List all addresses in the wallet",
    {
      daemon: "string"
    },
    async ({ daemon }) => {
      try {
        const client = cryptoMcp.clients.get(daemon);
        if (!client) throw new Error(`Daemon ${daemon} not found`);
        
        const addresses = await client.listAddresses();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(addresses, null, 2)
          }]
        };
      } catch (error) {
        return {
          isError: true,
          content: [{
            type: "text",
            text: `Error listing addresses: ${error.message}`
          }]
        };
      }
    }
  );

  // Get balance tool
  server.tool(
    "get-balance",
    "Get wallet balance",
    {
      daemon: "string"
    },
    async ({ daemon }) => {
      try {
        const client = cryptoMcp.clients.get(daemon);
        if (!client) throw new Error(`Daemon ${daemon} not found`);
        
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

  // Check status tool
  server.tool(
    "check-status",
    "Check daemon status",
    {
      daemon: "string"
    },
    async ({ daemon }) => {
      try {
        const client = cryptoMcp.clients.get(daemon);
        if (!client) throw new Error(`Daemon ${daemon} not found`);
        
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

  // Restart daemon tool
  server.tool(
    "restart-daemon",
    "Restart the cryptocurrency daemon",
    {
      daemon: "string"
    },
    async ({ daemon }) => {
      try {
        const client = cryptoMcp.clients.get(daemon);
        if (!client) throw new Error(`Daemon ${daemon} not found`);
        
        await client.restartDaemon();
        return {
          content: [{
            type: "text",
            text: "Daemon shutdown initiated. It should restart automatically if managed by a service."
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: "Daemon shutdown initiated (error response is expected)."
          }]
        };
      }
    }
  );

  // Connect and start the server
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Cryptocurrency Daemon MCP Server started');
  return server;
}