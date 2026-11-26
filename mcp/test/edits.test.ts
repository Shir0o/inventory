import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventDateValue, planEventEdit, planItemEdit } from '../src/edits.ts';

test('item edit returns only changed fields and upper-cases the SKU', () => {
  const plan = planItemEdit(
    { sku: 'TR-002-ES', title: 'La palabra de la cruz', stockLevel: 11, status: 'Low' },
    { sku: ' tr-001-es ', title: 'La palabra de la cruz' }
  );
  assert.deepEqual(plan.fields, { sku: 'TR-001-ES' });
  assert.deepEqual(plan.changes, [{ field: 'sku', from: 'TR-002-ES', to: 'TR-001-ES' }]);
});

test('item edit never writes stock and refuses empty or unchanged values', () => {
  const plan = planItemEdit({ title: 'Old', subtitle: 'placeholder' }, { title: 'New', subtitle: '' });
  assert.deepEqual(plan.fields, { title: 'New', subtitle: '' });
  assert.throws(() => planItemEdit({ title: 'Same' }, { title: 'Same' }), /Nothing to change/);
  assert.throws(() => planItemEdit({ title: 'A' }, { title: '  ' }), /Title cannot be empty/);
});

// Shaped like the 8/29 Jerome Park event the bug was found on.
const jerome = {
  name: 'Jerome Park Gospel',
  date: new Date('2026-08-29T19:00:00.000Z'),
  materialsDistributed: 175,
  categoryStats: {
    bibles: 4, bibles_en: 4, bibles_es: 0,
    tracts: 74, tracts_en: 0, tracts_es: 30,
    booklets: 1, booklets_en: 0, booklets_es: 0,
    total: -96,
  },
};

test('event stats merge and recompute total from the categories', () => {
  const plan = planEventEdit(jerome, { materialsDistributed: 79, categoryStats: { tracts_en: 44 } });
  const stats = plan.fields.categoryStats as Record<string, number>;
  assert.equal(stats.tracts_en, 44);
  assert.equal(stats.total, 79);
  assert.equal(stats.bibles, 4);
  assert.equal(plan.fields.materialsDistributed, 79);
  assert.deepEqual(
    plan.changes.map((change) => change.field),
    ['materialsDistributed', 'categoryStats.tracts_en', 'categoryStats.total']
  );
  // The one booklet still has no language split; materials and total agree.
  assert.deepEqual(plan.warnings, ['1 booklets have no English/Spanish split.']);
});

test('event edit refuses a split larger than its category', () => {
  assert.throws(
    () => planEventEdit(jerome, { categoryStats: { tracts_en: 50 } }),
    /English 50 \+ Spanish 30 is more than the tracts total 74/
  );
});

test('event edit warns when the total and materialsDistributed disagree', () => {
  const plan = planEventEdit(jerome, { categoryStats: { tracts_en: 44 } });
  assert.match(plan.warnings[0], /materialsDistributed \(175\) differs from categoryStats.total \(79\)/);
});

test('event date keeps the stored time of day, or stays a plain day string', () => {
  assert.equal(
    (eventDateValue(new Date('2026-08-29T19:00:00.000Z'), '2026-08-30') as Date).toISOString(),
    '2026-08-30T19:00:00.000Z'
  );
  assert.equal(eventDateValue('2026-08-29', '2026-08-30'), '2026-08-30');
  assert.throws(() => eventDateValue(undefined, '2026-02-30'), /not a real date/);
});
