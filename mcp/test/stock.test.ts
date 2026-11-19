import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeDocs } from '../src/firestore.ts';
import { DEFAULT_REORDER, planStockChange, reorderPointFor, serialize, statusForStock } from '../src/stock.ts';

// Shaped like the English Bible document the bug was found on.
const englishBible = {
  sku: 'BIB-001-EN',
  title: 'English Bible',
  category: 'Bibles',
  language: 'English',
  stockLevel: 61,
  stock: 61,
  status: 'Out',
};

test('giving units out updates both count fields', () => {
  const change = planStockChange(englishBible, 'subtract', 2, DEFAULT_REORDER);
  assert.equal(change.previousStock, 61);
  assert.equal(change.nextStock, 59);
  assert.deepEqual(change.fields, { stockLevel: 59, stock: 59, status: 'Healthy' });
});

test('status follows the app: Out at zero, Low below the reorder point', () => {
  assert.equal(planStockChange(englishBible, 'set', 0, DEFAULT_REORDER).status, 'Out');
  assert.equal(planStockChange(englishBible, 'set', 19, DEFAULT_REORDER).status, 'Low');
  assert.equal(planStockChange(englishBible, 'set', 20, DEFAULT_REORDER).status, 'Healthy');
  assert.equal(statusForStock(59, 100), 'Low');
});

test('reorder point uses the item, then settings by category, then the app fallback', () => {
  assert.equal(reorderPointFor({ category: 'Bibles', reorder: 40 }, DEFAULT_REORDER), 40);
  assert.equal(reorderPointFor({ category: 'Tracts' }, DEFAULT_REORDER), 200);
  assert.equal(reorderPointFor({ category: 'Bibles' }, { Bible: 30 }), 30);
  assert.equal(reorderPointFor({ category: 'Posters' }, DEFAULT_REORDER), 100);
});

test('reads the older stock field when stockLevel is missing', () => {
  const change = planStockChange({ stock: 10, category: 'Bibles' }, 'add', 5, DEFAULT_REORDER);
  assert.equal(change.previousStock, 10);
  assert.deepEqual(change.fields, { stockLevel: 15, stock: 15, status: 'Low' });
});

test('refuses to go below zero', () => {
  assert.throws(() => planStockChange(englishBible, 'subtract', 62, DEFAULT_REORDER), /Insufficient stock/);
});

test('one unreadable document does not fail the whole list', () => {
  const snapshots = [{ id: 'good' }, { id: 'bad' }];
  const docs = decodeDocs(snapshots, (snapshot) => {
    if (snapshot.id === 'bad') throw new TypeError("Cannot read properties of undefined (reading 'map')");
    return { id: snapshot.id, data: { sku: 'A' } };
  });
  assert.deepEqual(docs[0], { id: 'good', data: { sku: 'A' } });
  assert.equal(docs[1].id, 'bad');
  assert.match(String(docs[1].readError), /reading 'map'/);
  assert.deepEqual(decodeDocs(undefined, () => ({ id: 'x', data: {} })), []);
});

test('serialize turns SDK objects into plain values without walking cycles', () => {
  class DocumentReference {
    id = 'abc';
    path = 'inventory/abc';
    firestore: Record<string, unknown> = {};
    constructor() {
      this.firestore.self = this.firestore;
    }
  }
  class Timestamp {
    toDate() {
      return new Date('2026-11-18T07:02:44.472Z');
    }
  }
  const cyclic: Record<string, unknown> = { name: 'loop' };
  cyclic.self = cyclic;

  assert.deepEqual(
    serialize({
      ref: new DocumentReference(),
      updatedAt: new Timestamp(),
      tags: ['a', 1],
      cyclic,
      plain: { id: 'x', path: 'not-a-ref' },
    }),
    {
      ref: 'inventory/abc',
      updatedAt: '2026-11-18T07:02:44.472Z',
      tags: ['a', 1],
      cyclic: { name: 'loop', self: null },
      plain: { id: 'x', path: 'not-a-ref' },
    }
  );
});
