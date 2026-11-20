import { EventLine } from '../types';

export const DEFAULT_WARNING_LIMIT = 250;
export const DEFAULT_CRITICAL_LIMIT = 75;

export interface StockUpdate {
  id: string;
  title: string;
  sku: string;
  previousStock: number;
  newStock: number;
  status: 'Healthy' | 'Low' | 'Out';
  delta: number;
}

export function computeStockStatus(stockLevel: number): StockUpdate['status'] {
  if (stockLevel <= DEFAULT_CRITICAL_LIMIT) return 'Out';
  if (stockLevel <= DEFAULT_WARNING_LIMIT) return 'Low';
  return 'Healthy';
}

type MatchItem = (
  items: any[],
  code: string,
  lang?: string,
  title?: string
) => any;

export function buildCountStockUpdates(
  lines: EventLine[],
  inventory: any[],
  findMatch: MatchItem
): StockUpdate[] {
  // Aggregate `took - back` per inventory item id: the same item can appear on
  // multiple lines, and a Firestore writeBatch cannot update a doc twice.
  const byId = new Map<string, { item: any; passed: number }>();
  for (const line of lines) {
    const passed = Math.max(0, (line.took || 0) - (line.back || 0));
    if (passed === 0) continue;
    const item = findMatch(inventory, line.code, line.lang, line.title);
    if (!item || !item.id) continue;
    const entry = byId.get(item.id) || { item, passed: 0 };
    entry.passed += passed;
    byId.set(item.id, entry);
  }

  const updates: StockUpdate[] = [];
  byId.forEach(({ item, passed }, id) => {
    const previousStock = Number(item.stockLevel || 0);
    const newStock = Math.max(0, previousStock - passed);
    updates.push({
      id,
      title: item.title || item.name || 'Item',
      sku: item.sku || item.code || '',
      previousStock,
      newStock,
      status: computeStockStatus(newStock),
      delta: newStock - previousStock,
    });
  });
  return updates;
}
