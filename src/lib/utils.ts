import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a date string or Firestore Timestamp for display.
 * Uses UTC timezone for pure date strings (midnight) to avoid one-day-off bug.
 */
export function formatDate(date: any): string {
  if (!date) return '';
  const d = date.toDate ? date.toDate() : new Date(date);
  
  // If it's a pure date (midnight UTC), display in UTC to avoid local shift
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
    return d.toLocaleDateString(undefined, { timeZone: 'UTC' });
  }
  
  return d.toLocaleDateString();
}
