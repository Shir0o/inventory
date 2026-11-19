/**
 * Pure helpers shared by the MCP tools: JSON-safe serialization and the app's
 * stock/status rules. Kept free of Firestore and MCP imports so they can be tested.
 */

export type StockStatus = 'Healthy' | 'Low' | 'Out';
export type ReorderTable = Record<string, number>;
type ReorderCategory = 'Bible' | 'Booklet' | 'Tract';

/** Same defaults the app uses when `settings/system.reorder` is missing (src/App.tsx). */
export const DEFAULT_REORDER: ReorderTable = { Bible: 20, Booklet: 60, Tract: 200 };
/** The app's fallback when a category has no reorder point. */
const FALLBACK_REORDER = 100;

/** Converts Firestore values into JSON-safe values. */
export function serialize(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value !== 'object') {
    return value;
  }
  if (seen.has(value)) {
    return null;
  }
  seen.add(value);

  try {
    if (Array.isArray(value)) {
      return value.map((nested) => serialize(nested, seen));
    }

    const record = value as Record<string, unknown>;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      // Firestore SDK class instances (Timestamp, DocumentReference, GeoPoint, VectorValue, Bytes).
      if (typeof record.toDate === 'function') {
        const date = (record as { toDate: () => Date }).toDate();
        if (date instanceof Date && !Number.isNaN(date.getTime())) {
          return date.toISOString();
        }
      }
      // DocumentReference: return its path instead of walking the SDK client behind it.
      if (typeof record.path === 'string' && typeof record.id === 'string') {
        return record.path;
      }
      if (typeof record.latitude === 'number' && typeof record.longitude === 'number') {
        return { latitude: record.latitude, longitude: record.longitude };
      }
      if (typeof record.toArray === 'function') {
        return (record as { toArray: () => unknown }).toArray();
      }
      if (typeof record.toBase64 === 'function') {
        return (record as { toBase64: () => string }).toBase64();
      }
      if (Buffer.isBuffer(value)) {
        return value.toString('base64');
      }
    }

    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(record)) {
      result[key] = serialize(nested, seen);
    }
    return result;
  } finally {
    seen.delete(value);
  }
}

export function asNumber(value: unknown, fallback = 0): number {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function categoryKey(raw: unknown): string {
  const value = String(raw ?? '').trim().toLowerCase();
  if (!value) return '';
  if (value.includes('bib')) return 'bibles';
  if (value.includes('book') || value.includes('element') || value.includes('folleto')) return 'booklets';
  if (value.includes('tract') || value.includes('tratado')) return 'tracts';
  return value;
}

function reorderCategory(raw: unknown): ReorderCategory | null {
  const key = categoryKey(raw);
  if (key === 'bibles') return 'Bible';
  if (key === 'booklets') return 'Booklet';
  if (key === 'tracts') return 'Tract';
  return null;
}

/** Reads `settings/system.reorder`, falling back to the app defaults. */
export function reorderTableFrom(settings: Record<string, unknown> | undefined): ReorderTable {
  const raw = settings?.reorder;
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as ReorderTable) : DEFAULT_REORDER;
}

/** The reorder point the app's Inventory screen uses for an item. */
export function reorderPointFor(data: Record<string, unknown>, reorder: ReorderTable): number {
  const own = asNumber(data.reorder, 0);
  if (own > 0) return own;
  const category = reorderCategory(data.category ?? data.cat);
  return asNumber(category ? reorder[category] : undefined, 0) || FALLBACK_REORDER;
}

/** The app's rule: Out at zero, Low below the reorder point, otherwise Healthy. */
export function statusForStock(stock: number, reorderPoint: number): StockStatus {
  if (stock <= 0) return 'Out';
  if (stock < reorderPoint) return 'Low';
  return 'Healthy';
}

/** Current shelf count. The app reads `stockLevel` first, then the older `stock` field. */
export function stockOf(data: Record<string, unknown>): number {
  return asNumber(data.stockLevel ?? data.stock, 0);
}

export interface StockChange {
  previousStock: number;
  nextStock: number;
  status: StockStatus;
  /** Fields to write. Both count fields are kept equal, as the app does when it adjusts stock. */
  fields: { stockLevel: number; stock: number; status: StockStatus };
}

export function planStockChange(
  data: Record<string, unknown>,
  mode: 'set' | 'add' | 'subtract',
  quantity: number,
  reorder: ReorderTable,
  title = 'item'
): StockChange {
  const previousStock = stockOf(data);
  const nextStock =
    mode === 'set' ? quantity : mode === 'add' ? previousStock + quantity : previousStock - quantity;

  if (nextStock < 0) {
    throw new Error(`Insufficient stock for "${title}": ${previousStock} available, ${quantity} requested.`);
  }

  const status = statusForStock(nextStock, reorderPointFor(data, reorder));
  return { previousStock, nextStock, status, fields: { stockLevel: nextStock, stock: nextStock, status } };
}
