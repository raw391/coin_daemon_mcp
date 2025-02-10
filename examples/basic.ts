import { startMcpServer } from '../src';

const config = {
  daemons: [
    {
      coinName: "zcash",
      nickname: "zec-main",
      rpcEndpoint: "127.0.0.1:8232",
      rpcUser: "user",
      rpcPassword: "password"
    },
    {
      coinName: "bitcoin",
      nickname: "btc-main",
      rpcEndpoint: "127.0.0.1:8332",
      rpcUser: "user",
      rpcPassword: "password"
    }
  ]
};

startMcpServer(config).catch(error => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});