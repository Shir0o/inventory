// Stdio handshake smoke test: spawn the real stdio entrypoint, list its tools,
// then call two read-only tools against the in-memory backend. No Firebase
// credentials and no network. Run with `npm run smoke`.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const directory = fileURLToPath(new URL('.', import.meta.url));
const tsx = fileURLToPath(new URL('./node_modules/.bin/tsx', import.meta.url));

const env = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
);

const transport = new StdioClientTransport({
  command: tsx,
  args: ['src/stdio.ts'],
  cwd: directory,
  env: {
    ...env,
    MCP_BACKEND: 'memory',
    MCP_ACTOR: 'smoke',
    FIREBASE_PROJECT_ID: 'inventory-website-ca94e',
    FIREBASE_DATABASE_ID: 'ai-studio-7dcfaee1-ad85-4940-b13d-8df8f061af40',
  },
  stderr: 'inherit',
});

const client = new Client({ name: 'lit-ledger-smoke', version: '0.0.1' });

try {
  await client.connect(transport);

  const { tools } = await client.listTools();
  console.log(tools.map((tool) => tool.name).join('\n'));

  const expected = [
    'list_items',
    'get_item',
    'search_items',
    'list_categories',
    'list_events',
    'get_event',
    'update_item_quantity',
    'create_item',
    'list_audit_logs',
  ];
  const missing = expected.filter((name) => !tools.some((tool) => tool.name === name));
  if (missing.length > 0) throw new Error(`Missing tools: ${missing.join(', ')}`);

  const categories = await client.callTool({ name: 'list_categories', arguments: {} });
  const categoriesText = (categories.content as { type: string; text?: string }[])[0]?.text ?? '';
  console.log(`\nlist_categories → ${categoriesText.replace(/\s+/g, ' ')}`);
  if (!categoriesText.includes('"reorderPoints"')) throw new Error('list_categories returned no JSON payload');

  const items = await client.callTool({ name: 'list_items', arguments: {} });
  const itemsText = (items.content as { type: string; text?: string }[])[0]?.text ?? '';
  console.log(`list_items → ${itemsText.replace(/\s+/g, ' ')}`);
  if (items.isError) throw new Error(`list_items failed: ${itemsText}`);

  console.log(`\n[lit-ledger-mcp] smoke passed: ${tools.length} tools over stdio`);
} finally {
  await client.close();
}
