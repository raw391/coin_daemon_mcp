#!/usr/bin/env node
import { startMcpServer } from '../src';
import { readFileSync } from 'fs';
import { join } from 'path';

const configPath = process.argv[2] || 'config.json';
const config = JSON.parse(readFileSync(join(process.cwd(), configPath), 'utf8'));

startMcpServer(config).catch(error => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});