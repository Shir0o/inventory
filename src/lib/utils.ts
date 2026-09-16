import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Smart calculates the minimum order quantity in whole packs required
 * to bring current inventory back at or above the reorder threshold.
 *
 * Example: If threshold is 50, stock is 13, and pack size is 50:
 * Deficit = 37 -> Math.ceil(37 / 50) = 1 pack -> Order 50 pieces (Stock becomes 63 >= 50).
 */
export function calculateSuggestedOrderQty(currentStock: number, threshold: number, packSize: number): number {
  const pack = Math.max(1, packSize || 1);
  const deficit = Math.max(0, threshold - currentStock);
  if (deficit === 0) return 0;
  const packsNeeded = Math.ceil(deficit / pack);
  return packsNeeded * pack;
}

