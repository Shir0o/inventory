/**
 * Pure helpers for cleaning supplies and other consumables.
 *
 * Supplies live in the same `inventory` collection as literature, with
 * category "Cleaning Supply" or "Consumable" and the fields the app's
 * Supplies screen reads and writes (see `src/App.tsx`, handleUpdateConsumable):
 * fullUnitsCount, unit, unitVolume, partialRemainingVolume,
 * totalVolumeEquivalent, reorderThreshold, location, notes, lastAuditedDate.
 * The app mirrors fullUnitsCount into stockLevel/stock and reorderThreshold
 * into reorder, and marks an item Low when its full containers are at or below
 * its reorder threshold. These helpers write the same shape.
 */
import { asNumber } from './stock.ts';

export const SUPPLY_CATEGORIES = ['Cleaning Supply', 'Consumable'] as const;
export type SupplyCategory = (typeof SUPPLY_CATEGORIES)[number];

export const SUPPLY_UNITS = ['count', 'fl_oz', 'oz', 'box', 'pack'] as const;
export type SupplyUnit = (typeof SUPPLY_UNITS)[number];

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type Data = Record<string, unknown>;

export function isSupply(data: Data): boolean {
  const category = String(data.category ?? data.cat ?? '').trim();
  return (SUPPLY_CATEGORIES as readonly string[]).includes(category);
}

export function supplyCategoryOf(data: Data): SupplyCategory {
  return String(data.category ?? data.cat ?? '').trim() === 'Consumable' ? 'Consumable' : 'Cleaning Supply';
}

function optionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function fullUnitsOf(data: Data): number {
  return asNumber(data.fullUnitsCount ?? data.stockLevel ?? data.stock, 0);
}

export function reorderThresholdOf(data: Data): number {
  return asNumber(data.reorderThreshold ?? data.reorder, 1);
}

export function supplyStatus(fullUnits: number, threshold: number): 'Low' | 'Healthy' {
  return fullUnits <= threshold ? 'Low' : 'Healthy';
}

export function totalVolume(fullUnits: number, unitVolume: number | undefined, partial: number | undefined): number {
  return unitVolume && unitVolume > 0 ? fullUnits * unitVolume + (partial ?? 0) : fullUnits;
}

/** The supply as the Supplies screen shows it. */
export function supplyView(id: string, data: Data): Record<string, unknown> {
  const fullUnitsCount = fullUnitsOf(data);
  const unitVolume = optionalNumber(data.unitVolume);
  const partialRemainingVolume = optionalNumber(data.partialRemainingVolume) ?? 0;
  const reorderThreshold = reorderThresholdOf(data);
  return {
    id,
    sku: data.sku ?? data.code ?? null,
    name: data.name ?? data.title ?? null,
    category: supplyCategoryOf(data),
    unit: data.unit ?? null,
    unitVolume: unitVolume ?? null,
    fullUnitsCount,
    partialRemainingVolume,
    totalVolumeEquivalent: totalVolume(fullUnitsCount, unitVolume, partialRemainingVolume),
    reorderThreshold,
    status: supplyStatus(fullUnitsCount, reorderThreshold),
    location: data.location ?? null,
    notes: data.notes ?? null,
    lastAuditedDate: data.lastAuditedDate ?? null,
  };
}

function checkDay(day: string): string {
  if (!DAY_PATTERN.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`))) {
    throw new Error(`"${day}" is not a valid date; use YYYY-MM-DD.`);
  }
  return day;
}

function checkPartial(partial: number | undefined, unitVolume: number | undefined): void {
  if (partial !== undefined && partial > 0 && unitVolume !== undefined && unitVolume > 0 && partial > unitVolume) {
    throw new Error(`The open container can't hold ${partial} when a full one is ${unitVolume}.`);
  }
}

export interface SupplyInput {
  name: string;
  sku: string;
  category: SupplyCategory;
  unit: SupplyUnit;
  unitVolume?: number;
  fullUnitsCount: number;
  partialRemainingVolume?: number;
  reorderThreshold: number;
  location?: string;
  notes?: string;
  lastAuditedDate: string;
}

/** The fields of a new supply document, in the shape the app writes (timestamps added by the caller). */
export function buildSupplyDoc(input: SupplyInput): Data {
  const name = input.name.trim();
  if (!name) throw new Error('A supply needs a name.');
  checkPartial(input.partialRemainingVolume, input.unitVolume);
  const partial = input.partialRemainingVolume ?? 0;
  const sku = input.sku.trim().toUpperCase();
  return {
    sku,
    code: sku,
    name,
    title: name,
    category: input.category,
    unit: input.unit,
    ...(input.unitVolume === undefined ? {} : { unitVolume: input.unitVolume }),
    fullUnitsCount: input.fullUnitsCount,
    partialRemainingVolume: partial,
    totalVolumeEquivalent: totalVolume(input.fullUnitsCount, input.unitVolume, partial),
    stockLevel: input.fullUnitsCount,
    stock: input.fullUnitsCount,
    reorderThreshold: input.reorderThreshold,
    reorder: input.reorderThreshold,
    status: supplyStatus(input.fullUnitsCount, input.reorderThreshold),
    ...(input.location?.trim() ? { location: input.location.trim() } : {}),
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
    lastAuditedDate: checkDay(input.lastAuditedDate),
  };
}

/** Next free SKU like CLN-016 or CON-001 for the category, given the SKUs in use. */
export function nextSupplySku(category: SupplyCategory, usedSkus: Iterable<unknown>): string {
  const prefix = category === 'Consumable' ? 'CON' : 'CLN';
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  let highest = 0;
  for (const raw of usedSkus) {
    const match = pattern.exec(String(raw ?? '').trim().toUpperCase());
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return `${prefix}-${String(highest + 1).padStart(3, '0')}`;
}

export interface SupplyEdit {
  fullUnitsCount?: number;
  partialRemainingVolume?: number;
  unitVolume?: number;
  reorderThreshold?: number;
  location?: string;
  notes?: string;
  name?: string;
}

export interface SupplyChange {
  field: string;
  from: unknown;
  to: unknown;
}

export interface SupplyEditPlan {
  fields: Data;
  changes: SupplyChange[];
  status: 'Low' | 'Healthy';
}

/**
 * Plan an edit to a supply. Only fields that differ are written; counts and
 * levels also refresh the derived fields (stockLevel, stock, reorder,
 * totalVolumeEquivalent, status). `auditedOn` is stamped as lastAuditedDate
 * whenever a count or level changes. An empty location or notes clears it.
 */
export function planSupplyEdit(current: Data, edit: SupplyEdit, auditedOn: string): SupplyEditPlan {
  if (!isSupply(current)) {
    throw new Error('That item is not a cleaning supply or consumable.');
  }

  const before = {
    fullUnitsCount: fullUnitsOf(current),
    partialRemainingVolume: optionalNumber(current.partialRemainingVolume) ?? 0,
    unitVolume: optionalNumber(current.unitVolume),
    reorderThreshold: reorderThresholdOf(current),
    location: typeof current.location === 'string' ? current.location : undefined,
    notes: typeof current.notes === 'string' ? current.notes : undefined,
    name: String(current.name ?? current.title ?? ''),
  };

  const after = {
    fullUnitsCount: edit.fullUnitsCount ?? before.fullUnitsCount,
    partialRemainingVolume: edit.partialRemainingVolume ?? before.partialRemainingVolume,
    unitVolume: edit.unitVolume ?? before.unitVolume,
    reorderThreshold: edit.reorderThreshold ?? before.reorderThreshold,
    location: edit.location === undefined ? before.location : edit.location.trim() || undefined,
    notes: edit.notes === undefined ? before.notes : edit.notes.trim() || undefined,
    name: edit.name === undefined ? before.name : edit.name.trim(),
  };
  if (edit.name !== undefined && !after.name) {
    throw new Error('A supply needs a name.');
  }
  checkPartial(after.partialRemainingVolume, after.unitVolume);

  const changes: SupplyChange[] = [];
  const fields: Data = {};
  const note = (field: keyof typeof before) => {
    if (before[field] !== after[field]) {
      changes.push({ field, from: before[field] ?? null, to: after[field] ?? null });
      return true;
    }
    return false;
  };

  const countsChanged = [
    note('fullUnitsCount'),
    note('partialRemainingVolume'),
    note('unitVolume'),
  ].some(Boolean);
  const thresholdChanged = note('reorderThreshold');
  const locationChanged = note('location');
  const notesChanged = note('notes');
  const nameChanged = note('name');

  if (changes.length === 0) {
    throw new Error('Nothing to change: the values given already match.');
  }

  const status = supplyStatus(after.fullUnitsCount, after.reorderThreshold);
  if (countsChanged || thresholdChanged) {
    Object.assign(fields, {
      fullUnitsCount: after.fullUnitsCount,
      partialRemainingVolume: after.partialRemainingVolume,
      ...(after.unitVolume === undefined ? {} : { unitVolume: after.unitVolume }),
      totalVolumeEquivalent: totalVolume(after.fullUnitsCount, after.unitVolume, after.partialRemainingVolume),
      stockLevel: after.fullUnitsCount,
      stock: after.fullUnitsCount,
      reorderThreshold: after.reorderThreshold,
      reorder: after.reorderThreshold,
      status,
    });
  }
  if (countsChanged) fields.lastAuditedDate = checkDay(auditedOn);
  if (locationChanged) fields.location = after.location ?? null;
  if (notesChanged) fields.notes = after.notes ?? null;
  if (nameChanged) Object.assign(fields, { name: after.name, title: after.name });

  return { fields, changes, status };
}
