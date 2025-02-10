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

## Installation

### 1. Install the Package

You can install the package via npm:

\`\`\`bash
npm install @raw391/coin-daemon-mcp
\`\`\`

### 2. Configure Claude Desktop

To use this MCP with Claude Desktop, you'll need to modify your Claude Desktop configuration. The configuration file is located at:

- Windows: %APPDATA%\\Claude\\claude_desktop_config.json
- macOS: ~/Library/Application Support/Claude/claude_desktop_config.json

Add the following to your configuration:

\`\`\`json
{
  "mcpServers": {
    "cryptocurrency": {
      "command": "npx",
      "args": [
      "-y",
        "@raw391/coin-daemon-mcp"
      ],
      "env": {
        "CONFIG_PATH": "path/to/your/config.json"
      }
    }
  }
}
\`\`\`

### 3. Create Configuration File

Create a configuration file for your cryptocurrency daemons. Here are some example configurations:

#### Basic Single Daemon Configuration
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

#### Multiple Daemons Configuration
\`\`\`json
{
  "daemons": [
    {
      "coinName": "zcash",
      "nickname": "zec-main",
      "rpcEndpoint": "127.0.0.1:8232",
      "rpcUser": "zec-user",
      "rpcPassword": "zec-password"
    },
    {
      "coinName": "bitcoin",
      "nickname": "btc-main",
      "rpcEndpoint": "127.0.0.1:8332",
      "rpcUser": "btc-user",
      "rpcPassword": "btc-password"
    }
  ]
}
\`\`\`

#### Advanced Configuration with Data Directory
For best security practices, you might want to also use a file system MCP to manage daemon data. Here's how to configure both together:

\`\`\`json
{
  "mcpServers": {
    "cryptocurrency": {
      "command": "npx",
      "args": [
        "-y",
        "@raw391/coin-daemon-mcp"
      ],
      "env": {
        "CONFIG_PATH": "C:/CryptoConfig/daemon-config.json"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "C:/CryptoData"
      ]
    }
  }
}
\`\`\`

### 4. Configure Your Cryptocurrency Daemon

Make sure your cryptocurrency daemon's configuration file (e.g., zcash.conf, bitcoin.conf) has the appropriate RPC settings:

\`\`\`ini
server=1
rpcuser=your-rpc-user
rpcpassword=your-rpc-password
rpcallowip=127.0.0.1
\`\`\`

### 5. Start Using the MCP

After configuration, restart Claude Desktop. You should see new tools available for:
- Sending transactions
- Checking balances
- Managing wallets
- Monitoring daemon status
- And more

## Available Tools

The MCP provides these main tools:

1. Transaction Management
   - send-coins: Send transparent transactions
   - zsend-coins: Send shielded transactions (for privacy coins)
   - shield-coins: Convert transparent to shielded funds

2. Wallet Operations
   - backup-wallet: Create wallet backups
   - import-wallet: Import wallet data
   - list-addresses: Show available addresses
   - get-balance: Check balances

3. Daemon Management
   - check-status: Get daemon information
   - restart-daemon: Restart the daemon

## Security Best Practices

1. Separate Wallets
   - Create dedicated wallets for AI interactions
   - Keep minimal funds in accessible wallets
   - Use test networks for development

2. RPC Security
   - Use strong, unique RPC credentials
   - Enable only necessary RPC commands
   - Restrict RPC access to localhost
   - Monitor RPC logs

3. Data Management
   - Regular wallet backups
   - Secure storage of configuration files
   - Monitoring of all transactions
   - Regular security audits

## Example Usage

Here's how Claude can help with common tasks:

1. Checking Status:
   "What's the current status of the Zcash daemon?"

2. Managing Balances:
   "What's my current balance across all addresses?"

3. Creating Backups:
   "Please create a backup of my wallet"

4. Sending Transactions:
   "Can you help me send 0.1 ZEC to address xxx?"

## Troubleshooting

1. Connection Issues
   - Verify daemon is running
   - Check RPC credentials
   - Ensure correct port numbers
   - Verify localhost access

2. Permission Problems
   - Check file permissions
   - Verify RPC user rights
   - Ensure correct configuration paths

3. Transaction Issues
   - Verify sufficient funds
   - Check network connectivity
   - Ensure daemon is synced

## Support

- GitHub Issues: Bug reports and feature requests
- Discussions: General questions and community support
- Security Issues: Email security@pooly.ca

## License

MIT License with additional cryptocurrency operations disclaimer. See [LICENSE](LICENSE) for details.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.
