/**
 * Lit-Ledger MCP server (stdio).
 *
 * Exposes read/write inventory tools over the Model Context Protocol (stdio)
 * backed by the project's Firestore database. Run with `npm run mcp`.
 *
 * The tool definitions live in `mcp/src/tools.ts` and are shared with the remote
 * Streamable HTTP entrypoint (`mcp/src/http-server.ts`, `npm run mcp:http`) and
 * the Cloudflare Worker (`mcp/worker`).
 */
import process from 'node:process';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createBackend, logToStderr } from './firestore.ts';
import { createMcpServer } from './tools.ts';

const backend = await createBackend();
const server = createMcpServer(backend);

const transport = new StdioServerTransport();
await server.connect(transport);

const shutdown = () => {
  void server.close().finally(() => process.exit(0));
};

process.stdin.on('end', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

logToStderr(
  `[lit-ledger-mcp] ready on stdio (project ${backend.projectId}, database ${backend.databaseId}, mode ${backend.mode}; ` +
    'tools: list_items, get_item, search_items, list_categories, list_events, get_event, update_item_quantity, create_item, list_audit_logs)'
);
