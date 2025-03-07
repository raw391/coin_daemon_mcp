import { Server } from "@modelcontextprotocol/sdk/server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp";
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
  
  getCoinNames(): Map<string, string> {
    const result = new Map<string, string>();
    for (const [nickname, client] of this.clients.entries()) {
      result.set(nickname, client.coinName);
    }
    return result;
  }
}

const CRYPTO_HELP_MAP: Record<string, string> = {
  bitcoin: `
# Bitcoin RPC Guide

Bitcoin Core provides a powerful RPC interface for interacting with the daemon.

## Common Commands

- \`getinfo\`: Get general information about the node
- \`getbalance\`: Get wallet balance
- \`sendtoaddress <address> <amount>\`: Send BTC to an address
- \`listtransactions\`: List recent transactions
- \`getnewaddress\`: Generate a new receiving address

## Transaction Management

- \`createrawtransaction\`: Create a transaction manually
- \`signrawtransaction\`: Sign a raw transaction
- \`sendrawtransaction\`: Broadcast a signed transaction

## Block Information

- \`getblock <hash>\`: Get block details
- \`getblockhash <height>\`: Get block hash at height
- \`getblockcount\`: Get current block height

For more information, visit [Bitcoin Core Documentation](https://bitcoin.org/en/developer-reference)
`,
  zcash: `
# Zcash RPC Guide

Zcash extends Bitcoin Core with privacy features using shielded addresses.

## Transparent Operations

- \`getbalance\`: Get transparent balance
- \`sendtoaddress <address> <amount>\`: Send to transparent address

## Shielded Operations

- \`z_getbalance <address>\`: Get balance of a shielded address
- \`z_gettotalbalance\`: Get total balances (transparent, private, total)
- \`z_sendmany <from> '[{"address": "to", "amount": x}]'\`: Send from one address to one or more recipients
- \`z_listaddresses\`: List shielded addresses

## Privacy Features

- \`z_shieldcoinbase\`: Convert transparent funds to shielded
- \`z_mergetoaddress\`: Merge multiple UTXOs or notes into one

For more information, visit [Zcash Documentation](https://zcash.readthedocs.io/)
`
};

export async function startMcpServer(config: ServerConfig) {
  logger.info('MCP', 'Starting MCP Server');
  const cryptoMcp = new CryptoDaemonMCP(config);

  const server = new Server({
    name: "crypto-daemon-mcp",
    version: "1.0.0",
  }, {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {}
    }
  });

  // TOOLS IMPLEMENTATION
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

  // RESOURCES IMPLEMENTATION

  // Help documentation for each coin type
  server.resource(
    "docs",
    new ResourceTemplate("crypto://{coinType}/help", { list: undefined }),
    async (uri, { coinType }) => {
      try {
        logger.info('MCP', 'Fetching documentation', { coinType });
        
        let content = CRYPTO_HELP_MAP[coinType.toLowerCase()] || 
                    `No specific documentation available for ${coinType}. Try 'bitcoin' or 'zcash' instead.`;
                    
        return {
          contents: [{
            uri: uri.href,
            text: content,
            mimeType: "text/markdown"
          }]
        };
      } catch (error) {
        logger.error('MCP', 'Failed to fetch documentation', {
          coinType,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    }
  );

  // Daemon help text
  server.resource(
    "daemon-help",
    new ResourceTemplate("daemon://{name}/help", { list: undefined }),
    async (uri, { name }) => {
      try {
        logger.info('MCP', 'Fetching daemon help', { daemon: name });
        const client = cryptoMcp.getClient(name);
        const helpText = await client.executeCommand<string>('help', []);
        
        return {
          contents: [{
            uri: uri.href,
            text: helpText,
            mimeType: "text/plain"
          }]
        };
      } catch (error) {
        logger.error('MCP', 'Failed to fetch daemon help', {
          daemon: name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    }
  );

  // Transaction history
  server.resource(
    "transactions",
    new ResourceTemplate("daemon://{name}/transactions", { list: undefined }),
    async (uri, { name }) => {
      try {
        logger.info('MCP', 'Fetching transaction history', { daemon: name });
        const client = cryptoMcp.getClient(name);
        
        // Get recent transactions
        const transactions = await client.executeCommand<any[]>('listtransactions', ['*', 20]); // Last 20 transactions
        
        let formattedTransactions = '';
        if (transactions && transactions.length > 0) {
          formattedTransactions = transactions.map(tx => {
            return `Transaction: ${tx.txid}\n` +
                  `Amount: ${tx.amount}\n` +
                  `Category: ${tx.category}\n` +
                  `Confirmations: ${tx.confirmations}\n` +
                  `Time: ${new Date(tx.time * 1000).toISOString()}\n` +
                  '-'.repeat(40);
          }).join('\n\n');
        } else {
          formattedTransactions = 'No recent transactions found.';
        }
        
        return {
          contents: [{
            uri: uri.href,
            text: formattedTransactions,
            mimeType: "text/plain"
          }]
        };
      } catch (error) {
        logger.error('MCP', 'Failed to fetch transaction history', {
          daemon: name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    }
  );

  // PROMPTS IMPLEMENTATION

  // Transaction template prompt
  server.prompt(
    "send-transaction-template",
    {
      daemon: "string",
      amount: "number?"
    },
    ({ daemon, amount }) => {
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `I want to send a transaction on my ${daemon} wallet${amount ? ` for approximately ${amount} coins` : ''}. Can you help me construct this transaction step by step, explaining considerations like fees and confirmations? If I need to use any particular commands, please explain them thoroughly.`
          }
        }]
      };
    }
  );

  // Balance analysis prompt
  server.prompt(
    "balance-analysis",
    {
      daemon: "string"
    },
    ({ daemon }) => {
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Can you help me analyze my ${daemon} wallet balance? I'm interested in understanding the transparent and shielded balances (if applicable), the implications of my current balance distribution, and any recommendations for better fund management.`
          }
        }]
      };
    }
  );

  // Daemon status diagnostic prompt
  server.prompt(
    "daemon-diagnostic",
    {
      daemon: "string"
    },
    ({ daemon }) => {
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Please perform a thorough diagnostic check of my ${daemon} daemon. Analyze the status, check for any issues with connections, synchronization status, block height, and provide recommendations to improve its performance.`
          }
        }]
      };
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

  logger.info('MCP', 'Cryptocurrency Daemon MCP Server started with resources and prompts support');
  return server;
}