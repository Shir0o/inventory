/**
 * Pure planners for the catalog and event edit tools. Kept free of Firestore
 * and MCP imports so they can be tested on their own.
 */
import { asNumber, serialize } from './stock.ts';

export interface FieldChange {
  field: string;
  from: unknown;
  to: unknown;
}

export interface EditPlan {
  /** Fields to write; only the ones that change. */
  fields: Record<string, unknown>;
  changes: FieldChange[];
}

export function normalizeSku(sku: string): string {
  return sku.trim().toUpperCase();
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export interface ItemEdit {
  sku?: string;
  title?: string;
  /** An empty string clears the subtitle. */
  subtitle?: string;
}

/** Plans an edit of an item's SKU, title or subtitle. Stock fields are never touched. */
export function planItemEdit(current: Record<string, unknown>, edit: ItemEdit): EditPlan {
  const wanted: Record<string, string> = {};
  if (edit.sku !== undefined) wanted.sku = normalizeSku(edit.sku);
  if (edit.title !== undefined) wanted.title = edit.title.trim();
  if (edit.subtitle !== undefined) wanted.subtitle = edit.subtitle.trim();

  if (wanted.sku === '') throw new Error('SKU cannot be empty.');
  if (wanted.title === '') throw new Error('Title cannot be empty.');

  return diff(current, wanted);
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export const STAT_KEYS = [
  'bibles',
  'bibles_en',
  'bibles_es',
  'tracts',
  'tracts_en',
  'tracts_es',
  'booklets',
  'booklets_en',
  'booklets_es',
  'total',
] as const;

export type StatKey = (typeof STAT_KEYS)[number];
export type CategoryStats = Record<StatKey, number>;

export interface EventEdit {
  name?: string;
  location?: string;
  /** YYYY-MM-DD. */
  date?: string;
  status?: string;
  materialsDistributed?: number;
  categoryStats?: Partial<CategoryStats>;
}

export interface EventEditPlan extends EditPlan {
  /** Inconsistencies left after the edit, for the caller to see. */
  warnings: string[];
}

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Keeps the stored form of the event date. A plain YYYY-MM-DD string stays a
 * string; a timestamp keeps its time of day (the app saves local noon), so
 * only the day moves.
 */
export function eventDateValue(current: unknown, day: string): string | Date {
  const match = DAY_PATTERN.exec(day);
  if (!match) throw new Error(`Date "${day}" must be YYYY-MM-DD.`);
  const [year, month, date] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, date));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== date) {
    throw new Error(`Date "${day}" is not a real date.`);
  }

  if (typeof current === 'string' && DAY_PATTERN.test(current)) return day;

  const serialized = serialize(current);
  const existing = typeof serialized === 'string' ? new Date(serialized) : null;
  const hours = existing && !Number.isNaN(existing.getTime()) ? existing.getUTCHours() : 12;
  const minutes = existing && !Number.isNaN(existing.getTime()) ? existing.getUTCMinutes() : 0;
  return new Date(Date.UTC(year, month - 1, date, hours, minutes));
}

const CATEGORIES = ['bibles', 'tracts', 'booklets'] as const;
type Category = (typeof CATEGORIES)[number];

function splitOf(stats: CategoryStats, category: Category): { en: number; es: number } {
  return { en: stats[`${category}_en` as StatKey], es: stats[`${category}_es` as StatKey] };
}

function statsOf(raw: unknown): CategoryStats {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const stats = {} as CategoryStats;
  for (const key of STAT_KEYS) stats[key] = asNumber(source[key], 0);
  return stats;
}

/**
 * Plans an edit of an event record. Changes the record only: stock levels,
 * count-sheet lines and the materials subcollection are left alone.
 *
 * `categoryStats` is merged into the stored stats. Unless `total` is given,
 * it is recomputed as bibles + tracts + booklets. Each category must be at
 * least its English + Spanish split.
 */
export function planEventEdit(current: Record<string, unknown>, edit: EventEdit): EventEditPlan {
  const wanted: Record<string, unknown> = {};
  if (edit.name !== undefined) {
    if (!edit.name.trim()) throw new Error('Name cannot be empty.');
    wanted.name = edit.name.trim();
  }
  if (edit.location !== undefined) {
    if (!edit.location.trim()) throw new Error('Location cannot be empty.');
    wanted.location = edit.location.trim();
  }
  if (edit.status !== undefined) {
    if (!edit.status.trim()) throw new Error('Status cannot be empty.');
    wanted.status = edit.status.trim();
  }
  if (edit.date !== undefined) wanted.date = eventDateValue(current.date, edit.date);
  if (edit.materialsDistributed !== undefined) wanted.materialsDistributed = edit.materialsDistributed;

  const before = statsOf(current.categoryStats);
  let after = before;
  if (edit.categoryStats && Object.keys(edit.categoryStats).length > 0) {
    after = { ...before };
    for (const key of STAT_KEYS) {
      const value = edit.categoryStats[key];
      if (value !== undefined) after[key] = value;
    }
    if (edit.categoryStats.total === undefined) {
      after.total = after.bibles + after.tracts + after.booklets;
    }
    for (const category of CATEGORIES) {
      const { en, es } = splitOf(after, category);
      if (en + es > after[category]) {
        throw new Error(
          `${category}: English ${en} + Spanish ${es} is more than the ${category} total ${after[category]}.`
        );
      }
    }
    if (STAT_KEYS.some((key) => after[key] !== before[key])) {
      // Keep any extra keys the app may have stored alongside the known ones.
      const stored = current.categoryStats;
      const extra = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
      wanted.categoryStats = { ...extra, ...after };
    }
  }

  const plan = diff(current, wanted);
  // Report category stats key by key, which is easier to read than the whole map.
  const statsIndex = plan.changes.findIndex((change) => change.field === 'categoryStats');
  if (statsIndex >= 0) {
    const statChanges = STAT_KEYS.filter((key) => after[key] !== before[key]).map((key) => ({
      field: `categoryStats.${key}`,
      from: before[key],
      to: after[key],
    }));
    plan.changes.splice(statsIndex, 1, ...statChanges);
  }

  const warnings: string[] = [];
  const finalMaterials = asNumber(wanted.materialsDistributed ?? current.materialsDistributed, 0);
  if (current.categoryStats !== undefined || wanted.categoryStats !== undefined) {
    if (finalMaterials !== after.total) {
      warnings.push(
        `materialsDistributed (${finalMaterials}) differs from categoryStats.total (${after.total}).`
      );
    }
  }
  for (const category of CATEGORIES) {
    const { en, es } = splitOf(after, category);
    if (en + es < after[category]) {
      warnings.push(`${after[category] - en - es} ${category} have no English/Spanish split.`);
    }
  }
  if (Array.isArray(current.lines) && current.lines.length > 0 && wanted.categoryStats) {
    warnings.push('This event has a count sheet; the app may show stats computed from its lines instead.');
  }

  return { ...plan, warnings };
}

// ---------------------------------------------------------------------------

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(serialize(left)) === JSON.stringify(serialize(right));
}

function diff(current: Record<string, unknown>, wanted: Record<string, unknown>): EditPlan {
  const fields: Record<string, unknown> = {};
  const changes: FieldChange[] = [];
  for (const [field, value] of Object.entries(wanted)) {
    if (sameValue(current[field], value)) continue;
    fields[field] = value;
    changes.push({ field, from: serialize(current[field]) ?? null, to: serialize(value) });
  }
  if (changes.length === 0) {
    throw new Error('Nothing to change: the values given already match.');
  }
  return { fields, changes };
}
