import { Title, EventItem, Movement, OrderItem, Language } from '../types';
import { INITIAL_MOVEMENTS } from '../data/initialData';
import { sanitizeDetailText } from '../lib/humanizeHistory';

export interface ItemTrailEntry {
  id: string;
  date: string;
  isoDate: string;
  type: 'delivery' | 'event' | 'adjustment' | 'starting' | 'correction' | 'outflow';
  typeLabel: string;
  badgeClass: string;
  title: string;
  detail: string;
  delta: number | null;
  previousStock?: number;
  newStock?: number;
  runningBalance?: number;
  user?: string;
  location?: string;
  note?: string;
  recipient?: string;
  lang?: Language;
}

export interface ItemTrailSummary {
  code: string;
  titleName: string;
  editionTitle: string;
  category: string;
  lang?: Language;
  currentStock: number;
  reorderPoint: number;
  packSize: number;
  totalDelivered: number;
  totalDistributed: number;
  netAdjustments: number;
  eventCount: number;
  totalEntries: number;
  entries: ItemTrailEntry[];
}

/**
 * Normalizes SKU or item code for comparison.
 */
function normalizeCode(code?: string): string {
  if (!code) return '';
  return code.trim().toUpperCase().replace(/_/g, '-');
}

/**
 * Checks if a string contains another, case-insensitive.
 */
function textIncludes(haystack?: string, needle?: string): boolean {
  if (!haystack || !needle) return false;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/**
 * Extracts and formats date string from various representations.
 */
function formatTrailDate(rawDate: any): { displayDate: string; isoDate: string } {
  if (!rawDate) {
    const now = new Date();
    const iso = now.toISOString().slice(0, 10);
    return { displayDate: formatDateString(iso), isoDate: iso };
  }

  if (typeof rawDate === 'string') {
    const iso = rawDate.slice(0, 10);
    return { displayDate: formatDateString(iso), isoDate: iso };
  }

  if (rawDate && typeof rawDate.toDate === 'function') {
    const d = rawDate.toDate();
    const iso = d.toISOString().slice(0, 10);
    return { displayDate: formatDateString(iso), isoDate: iso };
  }

  if (rawDate && rawDate.seconds) {
    const d = new Date(rawDate.seconds * 1000);
    const iso = d.toISOString().slice(0, 10);
    return { displayDate: formatDateString(iso), isoDate: iso };
  }

  try {
    const d = new Date(rawDate);
    const iso = d.toISOString().slice(0, 10);
    return { displayDate: formatDateString(iso), isoDate: iso };
  } catch {
    return { displayDate: String(rawDate), isoDate: '' };
  }
}

function formatDateString(iso: string): string {
  try {
    const [y, m, d] = iso.split('-').map(Number);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (d && m) {
      return `${d} ${months[m - 1]} ${y}`;
    }
  } catch {}
  return iso;
}

/**
 * Compiles a complete audit trail for a specific literature item / edition.
 */
export function buildItemTrail({
  title,
  editionLang,
  rawLogs = [],
  events = [],
  rawInventory = []
}: {
  title: Title;
  editionLang?: Language; // If omitted, builds trail across all editions of this title
  rawLogs?: any[];
  events?: EventItem[];
  rawInventory?: any[];
}): ItemTrailSummary {
  const edition = editionLang 
    ? title.editions.find(e => e.lang === editionLang) 
    : undefined;

  const currentStock = edition 
    ? edition.stock 
    : title.editions.reduce((sum, e) => sum + e.stock, 0);

  const editionCode = editionLang ? `${title.code}-${editionLang}` : title.code;
  const aliases = title.aliases || (title.alias ? [title.alias] : []);

  const entriesMap = new Map<string, ItemTrailEntry>();

  // Helper to test if an event line or record belongs to this edition / title
  const matchesItem = (codeToCheck?: string, titleToCheck?: string, langToCheck?: string): boolean => {
    const normCheck = normalizeCode(codeToCheck);
    const normTitleCode = normalizeCode(title.code);
    const normEdCode = normalizeCode(editionCode);

    // Exact edition code match
    if (normCheck && (normCheck === normEdCode || normCheck.startsWith(normEdCode))) {
      return true;
    }

    // Base code match
    if (normCheck && (normCheck === normTitleCode || normCheck.startsWith(normTitleCode))) {
      if (!editionLang) return true;
      if (langToCheck && langToCheck.toUpperCase() === editionLang) return true;
      if (normCheck.endsWith(`-${editionLang}`)) return true;
    }

    // Title / Alias match
    const titleMatch = textIncludes(titleToCheck, title.name) ||
      (edition && textIncludes(titleToCheck, edition.title)) ||
      aliases.some(a => textIncludes(titleToCheck, a));

    if (titleMatch) {
      if (!editionLang) return true;
      if (langToCheck && langToCheck.toUpperCase() === editionLang) return true;
      if (!langToCheck) return true;
    }

    return false;
  };

  // 1. Process Outreach Events
  events.forEach(ev => {
    if (!ev.lines || ev.lines.length === 0) return;

    ev.lines.forEach(line => {
      const lineLang = line.lang?.toUpperCase() as Language;
      if (editionLang && lineLang && lineLang !== editionLang) return;

      const isMatch = matchesItem(line.code, line.title, lineLang) ||
                      matchesItem(line.key, line.title, lineLang);

      if (isMatch) {
        const took = Number(line.took) || 0;
        const back = Number(line.back) || 0;
        const distributed = Math.max(0, took - back);
        const { displayDate, isoDate } = formatTrailDate(ev.date);

        const entryId = `event-${ev.id}-${line.key || line.code}-${line.lang}`;
        entriesMap.set(entryId, {
          id: entryId,
          date: displayDate,
          isoDate,
          type: 'event',
          typeLabel: 'Event Distribution',
          badgeClass: 'bg-[#e9f1f7] text-[#1f5f8b] border-[#bed6e8]',
          title: `Outreach — ${ev.location || 'Outreach Event'}`,
          detail: took > 0
            ? `${took} taken out, ${back} returned · ${distributed} copies given to seekers`
            : `Present on event roster (${line.before || 0} in stock before event)`,
          delta: distributed > 0 ? -distributed : 0,
          location: ev.location,
          user: 'Outreach Team',
          lang: lineLang
        });
      }
    });

    // Check corrections for this event
    if (ev.corrections && ev.corrections.length > 0) {
      ev.corrections.forEach(corr => {
        if (!corr.changes) return;
        corr.changes.forEach(chg => {
          if (matchesItem(chg.key, undefined, editionLang)) {
            const { displayDate, isoDate } = formatTrailDate(corr.when || ev.date);
            const deltaCount = chg.to - chg.from;
            const entryId = `corr-${ev.id}-${corr.id}-${chg.key}`;
            entriesMap.set(entryId, {
              id: entryId,
              date: displayDate,
              isoDate,
              type: 'correction',
              typeLabel: 'Recount Correction',
              badgeClass: 'bg-[#f4edf7] text-[#7a4a8b] border-[#dfcde5]',
              title: `Recount correction — ${ev.location || 'Outreach Event'}`,
              detail: `Distribution recount adjusted from ${chg.from} to ${chg.to} (${deltaCount > 0 ? '+' : ''}${deltaCount}) · Note: "${corr.note || 'Shelf recount'}"`,
              delta: -deltaCount,
              location: ev.location,
              user: corr.by || 'Admin',
              note: corr.note,
              lang: editionLang
            });
          }
        });
      });
    }
  });

  // 2. Process Firestore Audit Logs
  rawLogs.forEach(log => {
    const meta = log.metadata || {};
    const logDate = meta.occurredAt || meta.date || log.timestamp;
    const { displayDate, isoDate } = formatTrailDate(logDate);

    // Delivery Received
    if (log.action === 'DELIVERY_RECEIVED' || (log.action === 'STOCK_UPDATE' && meta.orderTitle)) {
      let matchedQty = 0;
      let matchedTitle = meta.orderTitle || 'Shipment received';

      if (Array.isArray(meta.items)) {
        meta.items.forEach((item: any) => {
          const itemLang = (item.lang || '').toUpperCase();
          if (editionLang && itemLang && itemLang !== editionLang) return;
          if (matchesItem(item.code || item.sku || item.itemId, item.title, itemLang)) {
            matchedQty += Number(item.qty || item.quantity || item.received || 0);
            if (item.title) matchedTitle = item.title;
          }
        });
      } else if (matchesItem(meta.sku || meta.code || log.targetId, meta.title, meta.lang)) {
        matchedQty = Number(meta.delta || meta.quantity || 0);
      }

      if (matchedQty > 0) {
        const entryId = `delivery-${log.id}`;
        entriesMap.set(entryId, {
          id: entryId,
          date: displayDate,
          isoDate,
          type: 'delivery',
          typeLabel: 'Delivery Receipt',
          badgeClass: 'bg-[#e6f4ea] text-[#137333] border-[#bce2c7]',
          title: `Delivery receipt — ${meta.orderTitle || matchedTitle}`,
          detail: `+${matchedQty} units received into store shelves`,
          delta: matchedQty,
          user: log.userName || 'Admin',
          note: meta.note,
          lang: editionLang
        });
      }
      return;
    }

    // Direct Stock Adjustment or Outflow
    if (log.action === 'STOCK_ADJUSTED' || log.action === 'STOCK_UPDATE') {
      const logLang = (meta.lang || '').toUpperCase();
      if (editionLang && logLang && logLang !== editionLang) return;

      const isMatch = matchesItem(meta.sku || meta.code || log.targetId, meta.title, logLang) ||
                      textIncludes(log.details, title.name) ||
                      (edition && textIncludes(log.details, edition.title));

      if (isMatch) {
        const prev = meta.previousStock !== undefined ? Number(meta.previousStock) : undefined;
        const next = meta.newStock !== undefined ? Number(meta.newStock) : undefined;
        const delta = meta.delta !== undefined 
          ? Number(meta.delta) 
          : (next !== undefined && prev !== undefined ? next - prev : null);

        const isDirect = meta.isDirectMovement;
        const isSubtract = meta.movementType === 'SUBTRACT' || (delta !== null && delta < 0);

        let typeLabel = 'Shelf Adjustment';
        let badgeClass = 'bg-[#f6f7f9] text-[#44474e] border-[#c9cbd2]';
        let type: ItemTrailEntry['type'] = 'adjustment';

        if (isDirect) {
          type = isSubtract ? 'outflow' : 'delivery';
          typeLabel = isSubtract ? 'Direct Outflow' : 'Direct Restock';
          badgeClass = isSubtract 
            ? 'bg-[#fdf0d8] text-[#8a5a00] border-[#f2d9a8]' 
            : 'bg-[#e6f4ea] text-[#137333] border-[#bce2c7]';
        }

        let detailText = '';
        if (prev !== undefined && next !== undefined) {
          detailText = `Counted on shelf: ${prev} → ${next} (${delta !== null && delta > 0 ? '+' : ''}${delta})`;
        } else if (delta !== null) {
          detailText = `Adjustment: ${delta > 0 ? '+' : ''}${delta} units`;
        } else {
          detailText = sanitizeDetailText(log.details);
        }

        if (meta.note) {
          detailText += ` · "${meta.note}"`;
        }
        if (meta.recipient) {
          detailText += ` · Recipient: ${meta.recipient}`;
        }

        const entryId = `adj-${log.id}`;
        entriesMap.set(entryId, {
          id: entryId,
          date: displayDate,
          isoDate,
          type,
          typeLabel,
          badgeClass,
          title: meta.note ? `Adjusted — ${meta.note}` : `Stock adjusted`,
          detail: detailText,
          delta,
          previousStock: prev,
          newStock: next,
          user: log.userName || 'Admin',
          note: meta.note,
          recipient: meta.recipient,
          lang: editionLang
        });
      }
      return;
    }

    // Initial Starting Stock
    if (log.action === 'STARTING_STOCK') {
      const isMatch = matchesItem(meta.sku || meta.code || log.targetId, meta.title, editionLang);
      if (isMatch) {
        const delta = meta.delta !== undefined ? Number(meta.delta) : Number(meta.newStock ?? 0);
        const entryId = `start-${log.id}`;
        entriesMap.set(entryId, {
          id: entryId,
          date: displayDate,
          isoDate,
          type: 'starting',
          typeLabel: 'Initial Stock',
          badgeClass: 'bg-[#f1f3f4] text-[#191c20] border-[#dcdee3]',
          title: 'Initial catalog baseline',
          detail: `${delta} units recorded on shelves`,
          delta,
          user: log.userName || 'System',
          lang: editionLang
        });
      }
    }
  });

  // 3. Process Initial Static Movements (Seed data fallback if applicable)
  INITIAL_MOVEMENTS.forEach((m, idx) => {
    const isMatch = matchesItem(undefined, m.what, editionLang) ||
                    (edition && textIncludes(m.what, edition.title)) ||
                    textIncludes(m.what, title.name) ||
                    aliases.some(a => textIncludes(m.what, a));

    if (isMatch) {
      const entryId = `initial-m-${idx}`;
      if (!entriesMap.has(entryId)) {
        const { displayDate, isoDate } = formatTrailDate(m.iso || m.date);
        const isReceipt = m.kind === 'receipt';
        entriesMap.set(entryId, {
          id: entryId,
          date: displayDate,
          isoDate,
          type: isReceipt ? 'delivery' : 'adjustment',
          typeLabel: isReceipt ? 'Delivery Receipt' : 'Shelf Adjustment',
          badgeClass: isReceipt 
            ? 'bg-[#e6f4ea] text-[#137333] border-[#bce2c7]' 
            : 'bg-[#f6f7f9] text-[#44474e] border-[#c9cbd2]',
          title: m.what,
          detail: m.detail || (m.delta ? `${m.delta > 0 ? '+' : ''}${m.delta} units` : ''),
          delta: m.delta,
          user: 'Admin',
          lang: editionLang
        });
      }
    }
  });

  // Convert map to array and sort chronologically (oldest to newest for running balance)
  const sortedChronological = Array.from(entriesMap.values()).sort((a, b) => {
    if (a.isoDate && b.isoDate && a.isoDate !== b.isoDate) {
      return a.isoDate.localeCompare(b.isoDate);
    }
    return 0;
  });

  // Calculate metrics
  let totalDelivered = 0;
  let totalDistributed = 0;
  let netAdjustments = 0;
  let eventCount = 0;

  sortedChronological.forEach(entry => {
    if (entry.type === 'delivery') {
      if (entry.delta && entry.delta > 0) totalDelivered += entry.delta;
    } else if (entry.type === 'event') {
      eventCount++;
      if (entry.delta && entry.delta < 0) totalDistributed += Math.abs(entry.delta);
    } else if (entry.type === 'outflow') {
      if (entry.delta && entry.delta < 0) totalDistributed += Math.abs(entry.delta);
    } else if (entry.type === 'adjustment' || entry.type === 'correction') {
      if (entry.delta !== null) netAdjustments += entry.delta;
    }
  });

  // Return newest first for standard display
  const sortedNewestFirst = [...sortedChronological].reverse();

  return {
    code: editionCode,
    titleName: title.name,
    editionTitle: edition ? edition.title : title.name,
    category: title.cat,
    lang: editionLang,
    currentStock,
    reorderPoint: title.reorder,
    packSize: title.pack,
    totalDelivered,
    totalDistributed,
    netAdjustments,
    eventCount,
    totalEntries: sortedNewestFirst.length,
    entries: sortedNewestFirst
  };
}
