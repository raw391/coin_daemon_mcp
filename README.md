# Cryptocurrency Daemon MCP Server (BETA)

A Model Context Protocol (MCP) server for interacting with cryptocurrency daemon RPC interfaces. This server enables AI assistants to help manage and interact with cryptocurrency nodes in a controlled manner.

⚠️ **IMPORTANT SECURITY WARNING** ⚠️

This software allows AI systems to interact with cryptocurrency daemons. Please read this warning carefully:

1. Running this MCP server gives AI systems the ability to:
   - Send transactions
   - Access wallet information
   - Modify wallet settings
   - View private data
   - Execute daemon commands

2. Potential risks include:
   - Loss of funds through unauthorized transactions
   - Exposure of private information
   - Unintended wallet or daemon modifications
   - Potential security vulnerabilities if improperly configured

3. Required Safety Measures:
   - Use a separate wallet with limited funds for AI interactions
   - Never give access to wallets containing significant value
   - Configure strict RPC permissions
   - Monitor all AI interactions with the daemon
   - Regular security audits of configurations
   - Keep backups of all important data

**This software is in BETA. Use at your own risk.**

## About

This MCP server provides a standardized interface for AI assistants to interact with cryptocurrency daemon RPC interfaces. While developed and tested primarily with Zcash, it should work with most Bitcoin-derived cryptocurrency daemons that follow similar RPC patterns.

### Supported Features

- Sending transparent and shielded transactions
- Wallet backup and import
- Address management
- Balance checking
- Daemon status monitoring
- Coin shielding operations
- Daemon management

## Installation

\`\`\`bash
npm install @pooly-canada/coin-daemon-mcp
\`\`\`

## Configuration

Create a configuration file that specifies your daemon(s):

\`\`\`json
{
  "daemons": [
    {
      "coinName": "zcash",
      "nickname": "zec-main",
      "rpcEndpoint": "127.0.0.1:8232",
      "rpcUser": "your-rpc-user",
      "rpcPassword": "your-rpc-password"
    }
  ]
}
\`\`\`

## Usage

### Starting the MCP Server

\`\`\`typescript
import { startMcpServer } from '@pooly-canada/coin-daemon-mcp';
import config from './config.json';

startMcpServer(config).catch(console.error);
\`\`\`

### Available MCP Tools

1. Basic Operations
   - execute-command: Execute any RPC command
   - get-command-help: Get help for commands
   - list-daemons: List configured daemons
   - get-daemon-info: Get daemon status

2. Wallet Operations
   - send-coins: Send transparent transactions
   - zsend-coins: Send shielded transactions
   - backup-wallet: Create wallet backup
   - import-wallet: Import wallet data
   - list-addresses: Show all addresses
   - get-balance: Check balances
   
3. Management
   - check-status: Get daemon status
   - shield-coins: Convert transparent to shielded
   - restart-daemon: Restart the daemon

## Security Recommendations

1. Network Security
   - Run daemons and MCP server behind a firewall
   - Use localhost-only RPC connections when possible
   - Implement IP whitelisting for remote connections
   
2. Wallet Security
   - Use dedicated wallets for AI interactions
   - Keep minimal funds in accessible wallets
   - Regular backup procedures
   - Monitor all transactions

3. RPC Security
   - Use strong, unique RPC credentials
   - Limit RPC capabilities to required commands
   - Regular credential rotation
   - Audit RPC access logs

## Compatibility

This server is tested with:
- Zcash (Primary)
- Bitcoin
- Litecoin
- Other Bitcoin-derived cryptocurrencies

Some commands may vary between currencies, especially privacy-focused features.

## Contributing

Contributions are welcome! Please read our contributing guidelines and code of conduct.

## License

MIT

## Disclaimer

THIS SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND. The developers are not responsible for any loss of funds, data breaches, or other damages that may occur from using this software.

## Support

- GitHub Issues: Bug reports and feature requests
- Discussions: General questions and community support