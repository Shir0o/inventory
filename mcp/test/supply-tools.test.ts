import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { MemoryBackend } from '../src/memory.ts';
import { createMcpServer } from '../src/tools.ts';

async function connect(backend: MemoryBackend): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await createMcpServer(backend).connect(serverTransport);
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(clientTransport);
  return client;
}

type CallResult = { content: { type: string; text: string }[]; isError?: boolean };

async function call(client: Client, name: string, args: Record<string, unknown>): Promise<CallResult> {
  return (await client.callTool({ name, arguments: args })) as CallResult;
}

function payload(result: CallResult): Record<string, any> {
  assert.equal(result.isError, undefined, result.content[0].text);
  return JSON.parse(result.content[0].text);
}

test('create_supply, list_supplies and update_supply round-trip in the app\'s shape', async () => {
  const backend = new MemoryBackend();
  await backend.addDoc('inventory', { sku: 'B-EN-001', title: 'Holy Bible', category: 'Bibles', stockLevel: 27 });
  const client = await connect(backend);

  const created = payload(
    await call(client, 'create_supply', {
      name: 'Clorox Bleach 121 oz',
      unit: 'fl_oz',
      unitVolume: 121,
      fullUnitsCount: 3,
      partialRemainingVolume: 77,
      countedOn: '2026-10-07',
    })
  );
  assert.equal(created.supply.sku, 'CLN-001');
  assert.equal(created.supply.totalVolumeEquivalent, 440);

  const second = payload(
    await call(client, 'create_supply', { name: 'Disinfecting Wipes Canisters', unit: 'count', fullUnitsCount: 7, reorderThreshold: 2 })
  );
  assert.equal(second.supply.sku, 'CLN-002');

  const duplicate = await call(client, 'create_supply', { name: 'clorox bleach 121 oz', unit: 'fl_oz' });
  assert.equal(duplicate.isError, true);

  const listed = payload(await call(client, 'list_supplies', {}));
  assert.equal(listed.total, 2);
  assert.deepEqual(listed.supplies.map((s: { sku: string }) => s.sku), ['CLN-001', 'CLN-002']);

  const updated = payload(
    await call(client, 'update_supply', { sku: 'CLN-001', fullUnitsCount: 1, partialRemainingVolume: 40, countedOn: '2026-11-28' })
  );
  assert.equal(updated.supply.status, 'Low');
  const stored = await backend.getDoc(`inventory/${created.supply.id}`);
  assert.equal(stored?.data.stockLevel, 1);
  assert.equal(stored?.data.stock, 1);
  assert.equal(stored?.data.lastAuditedDate, '2026-11-28');

  const low = payload(await call(client, 'list_supplies', { lowOnly: true }));
  assert.deepEqual(low.supplies.map((s: { sku: string }) => s.sku), ['CLN-001']);

  const logs = await backend.listCollection('audit_logs');
  assert.deepEqual(logs.map((log) => log.data.action).sort(), ['ITEM_CREATED', 'ITEM_CREATED', 'SUPPLY_UPDATED']);
});

test('supply tools refuse literature items', async () => {
  const backend = new MemoryBackend();
  await backend.addDoc('inventory', { sku: 'B-EN-001', title: 'Holy Bible', category: 'Bibles', stockLevel: 27 });
  const client = await connect(backend);

  const result = await call(client, 'update_supply', { sku: 'B-EN-001', fullUnitsCount: 5 });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /not a cleaning supply/);
  assert.equal((await backend.listCollection('audit_logs')).length, 0);
});
