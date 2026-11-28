import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSupplyDoc, nextSupplySku, planSupplyEdit, supplyView } from '../src/supplies.ts';

const bleach = {
  sku: 'CLN-001',
  name: 'Clorox Bleach 121 oz',
  category: 'Cleaning Supply',
  unit: 'fl_oz',
  unitVolume: 121,
  fullUnitsCount: 3,
  partialRemainingVolume: 77,
  stockLevel: 3,
  stock: 3,
  reorderThreshold: 1,
  reorder: 1,
};

test('supplyView computes total volume and status like the Supplies screen', () => {
  const view = supplyView('abc', bleach);
  assert.equal(view.totalVolumeEquivalent, 3 * 121 + 77);
  assert.equal(view.status, 'Healthy');
  assert.equal(supplyView('x', { ...bleach, fullUnitsCount: 1 }).status, 'Low');
  assert.equal(supplyView('y', { name: 'Wipes', category: 'Cleaning Supply', unit: 'count', stockLevel: 7 }).totalVolumeEquivalent, 7);
});

test('planSupplyEdit records a count and keeps derived fields in step', () => {
  const plan = planSupplyEdit(bleach, { fullUnitsCount: 1, partialRemainingVolume: 40 }, '2026-11-28');
  assert.deepEqual(plan.changes.map((c) => c.field), ['fullUnitsCount', 'partialRemainingVolume']);
  assert.equal(plan.fields.stockLevel, 1);
  assert.equal(plan.fields.stock, 1);
  assert.equal(plan.fields.totalVolumeEquivalent, 161);
  assert.equal(plan.fields.status, 'Low');
  assert.equal(plan.fields.lastAuditedDate, '2026-11-28');
});

test('planSupplyEdit refuses non-supplies, no-op edits and an overfull open container', () => {
  assert.throws(() => planSupplyEdit({ title: 'Bible', category: 'Bibles' }, { fullUnitsCount: 1 }, '2026-11-28'), /not a cleaning supply/);
  assert.throws(() => planSupplyEdit(bleach, { fullUnitsCount: 3 }, '2026-11-28'), /Nothing to change/);
  assert.throws(() => planSupplyEdit(bleach, { partialRemainingVolume: 130 }, '2026-11-28'), /can't hold/);
});

test('planSupplyEdit changes notes without touching counts or the audit date', () => {
  const plan = planSupplyEdit(bleach, { notes: 'Under the sink' }, '2026-11-28');
  assert.deepEqual(plan.fields, { notes: 'Under the sink' });
  const cleared = planSupplyEdit({ ...bleach, notes: 'old' }, { notes: '' }, '2026-11-28');
  assert.deepEqual(cleared.fields, { notes: null });
});

test('buildSupplyDoc writes the app\'s shape and nextSupplySku continues the series', () => {
  const doc = buildSupplyDoc({
    name: 'Glass Cleaner 19 oz',
    sku: 'cln-015',
    category: 'Cleaning Supply',
    unit: 'fl_oz',
    unitVolume: 19,
    fullUnitsCount: 0,
    partialRemainingVolume: 19,
    reorderThreshold: 1,
    lastAuditedDate: '2026-10-07',
  });
  assert.equal(doc.sku, 'CLN-015');
  assert.equal(doc.code, 'CLN-015');
  assert.equal(doc.title, 'Glass Cleaner 19 oz');
  assert.equal(doc.stockLevel, 0);
  assert.equal(doc.status, 'Low');
  assert.equal(doc.totalVolumeEquivalent, 19);
  assert.equal(nextSupplySku('Cleaning Supply', ['CLN-001', 'cln-014', 'TR-001-EN']), 'CLN-015');
  assert.equal(nextSupplySku('Consumable', ['CLN-001']), 'CON-001');
});
