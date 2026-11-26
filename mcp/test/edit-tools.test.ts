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

async function seed(): Promise<{ backend: MemoryBackend; palabra: string; librados: string; event: string }> {
  const backend = new MemoryBackend();
  const palabra = await backend.addDoc('inventory', {
    sku: 'TR-002-ES', title: 'La palabra de la cruz', category: 'Tracts', language: 'Spanish', stockLevel: 11,
  });
  const librados = await backend.addDoc('inventory', {
    sku: 'TR-002-ES', title: 'Librados del temor de la muerte', category: 'Tracts', language: 'Spanish', stockLevel: 0,
  });
  await backend.addDoc('inventory', { sku: 'TR-001-EN', title: 'Foolishness or the Power of God?', stockLevel: 30 });
  const event = await backend.addDoc('events', {
    name: 'Jerome Park Gospel',
    materialsDistributed: 175,
    categoryStats: { bibles: 4, bibles_en: 4, tracts: 74, tracts_es: 30, booklets: 1, total: -96 },
  });
  return { backend, palabra, librados, event };
}

test('update_item changes the SKU by item id, keeps stock and logs it', async () => {
  const { backend, palabra } = await seed();
  const client = await connect(backend);

  const result = await call(client, 'update_item', { itemId: palabra, newSku: 'tr-001-es' });
  assert.equal(result.isError, undefined, result.content[0].text);

  const item = await backend.getDoc(`inventory/${palabra}`);
  assert.equal(item?.data.sku, 'TR-001-ES');
  assert.equal(item?.data.stockLevel, 11);

  const logs = await backend.listCollection('audit_logs');
  assert.equal(logs.length, 1);
  assert.equal(logs[0].data.action, 'ITEM_UPDATED');
  assert.equal(logs[0].data.targetId, palabra);
});

test('update_item refuses a SKU another item uses and an ambiguous current SKU', async () => {
  const { backend, palabra } = await seed();
  const client = await connect(backend);

  const taken = await call(client, 'update_item', { itemId: palabra, newSku: 'TR-001-EN' });
  assert.equal(taken.isError, true);
  assert.match(taken.content[0].text, /already used by/);

  const ambiguous = await call(client, 'update_item', { sku: 'TR-002-ES', newTitle: 'x' });
  assert.equal(ambiguous.isError, true);
  assert.match(ambiguous.content[0].text, /Multiple items match/);
  assert.equal((await backend.listCollection('audit_logs')).length, 0);
});

test('update_event fixes the totals and reports what is left', async () => {
  const { backend, event } = await seed();
  const client = await connect(backend);

  const result = await call(client, 'update_event', {
    eventId: event,
    materialsDistributed: 79,
    categoryStats: { tracts_en: 44 },
    reason: 'Total was overwritten on save',
  });
  assert.equal(result.isError, undefined, result.content[0].text);
  const payload = JSON.parse(result.content[0].text);
  assert.deepEqual(payload.warnings, ['1 booklets have no English/Spanish split.']);

  const stored = await backend.getDoc(`events/${event}`);
  assert.equal(stored?.data.materialsDistributed, 79);
  assert.equal((stored?.data.categoryStats as Record<string, number>).total, 79);

  const logs = await backend.listCollection('audit_logs');
  assert.equal(logs[0].data.action, 'EVENT_UPDATED');
  assert.match(String(logs[0].data.details), /Total was overwritten on save/);
});
