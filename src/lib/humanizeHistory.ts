import { resolveHumanTitle, isCodeLikeTitle } from '../services/inventoryCleanupService';

export interface HumanizeOptions {
  inventoryItems?: { id?: string; sku?: string; title?: string; name?: string; baseCode?: string; baseName?: string; language?: string }[];
  events?: { id?: string; name?: string; location?: string; date?: string }[];
  orders?: { key?: string; id?: string; title?: string; code?: string; qty?: number }[];
}

/**
 * Checks if a string looks like a raw Firestore auto-generated document ID
 * (typically 20-character base62 string like 'hDIKJyICWVGX9cUvF0sV')
 */
export function isRawFirestoreId(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  const trimmed = str.trim();
  // Standard Firestore document IDs are 20 characters alphanumeric (letters and numbers)
  return /^[A-Za-z0-9]{18,24}$/.test(trimmed);
}

/**
 * Resolves a raw document ID or SKU to a friendly human-readable name.
 */
export function resolveTargetName(
  targetId: string | undefined | null,
  targetType: string | undefined | null,
  options?: HumanizeOptions
): string {
  if (!targetId) return '';

  // 1. Check inventory items
  if (options?.inventoryItems) {
    const item = options.inventoryItems.find(
      i => i.id === targetId || i.sku === targetId || i.baseCode === targetId
    );
    if (item) {
      const cand = item.title || item.name || item.baseName;
      if (cand && !isCodeLikeTitle(cand)) return cand;
      return resolveHumanTitle(cand || item.sku, (item.language as any) || 'EN', item.baseName, item.baseCode);
    }
  }

  // Also check if targetId itself is a code-like title (e.g. TR-009-001-EN)
  if (targetType === 'inventory' || isCodeLikeTitle(targetId)) {
    const resolved = resolveHumanTitle(targetId);
    if (resolved && !isCodeLikeTitle(resolved)) return resolved;
  }

  // 2. Check events
  if (options?.events) {
    const ev = options.events.find(e => e.id === targetId);
    if (ev) {
      return ev.location || ev.name || 'Outreach Event';
    }
  }

  // 3. Check orders
  if (options?.orders) {
    const ord = options.orders.find(o => o.id === targetId || o.key === targetId);
    if (ord) {
      return ord.title || ord.code || 'Order';
    }
  }

  // 4. If it's a known system target
  if (targetId === 'system' || targetId === 'settings') return 'System Settings';
  if (targetId === 'direct') return 'Direct Distribution';

  // 5. If it's a raw Firestore ID and couldn't be resolved, return a generic friendly label
  if (isRawFirestoreId(targetId)) {
    if (targetType === 'inventory') return 'Literature Item';
    if (targetType === 'event') return 'Outreach Event';
    if (targetType === 'order') return 'Print Order';
    if (targetType === 'user') return 'User Profile';
    return 'Record';
  }

  return targetId;
}

/**
 * Replaces any embedded raw 20-character Firestore IDs in detail text with friendly names.
 */
export function sanitizeDetailText(text: string, options?: HumanizeOptions): string {
  if (!text || typeof text !== 'string') return '';

  let sanitized = text;

  // Replace phrases like "Deleted item ID: hDIKJyICWVGX9cUvF0sV"
  sanitized = sanitized.replace(/Deleted item ID:\s*([A-Za-z0-9]{18,24})/gi, (_, id) => {
    const name = resolveTargetName(id, 'inventory', options);
    return name && name !== 'Record' && name !== 'Literature Item' ? `Deleted item: ${name}` : 'Removed literature item from catalog';
  });

  // Replace phrases like "Deleted event ID: hDIKJyICWVGX9cUvF0sV"
  sanitized = sanitized.replace(/Deleted event ID:\s*([A-Za-z0-9]{18,24})/gi, (_, id) => {
    const name = resolveTargetName(id, 'event', options);
    return name && name !== 'Record' && name !== 'Outreach Event' ? `Deleted event: ${name}` : 'Removed outreach event';
  });

  // Replace phrases like "Adjusted quantity of material in event hDIKJyICWVGX9cUvF0sV"
  sanitized = sanitized.replace(/(?:Adjusted|Removed)\s+(?:quantity of\s+)?material\s+(?:in|from)\s+event\s+([A-Za-z0-9]{18,24})/gi, (_, id) => {
    const name = resolveTargetName(id, 'event', options);
    return name && name !== 'Record' && name !== 'Outreach Event' ? `Adjusted material in ${name}` : 'Adjusted material in event';
  });

  // Replace phrases like "event hDIKJyICWVGX9cUvF0sV"
  sanitized = sanitized.replace(/event\s+([A-Za-z0-9]{18,24})/gi, (_, id) => {
    const name = resolveTargetName(id, 'event', options);
    return name && name !== 'Record' && name !== 'Outreach Event' ? name : 'event';
  });

  // Replace any standalone 20-char IDs that match inventory or events
  sanitized = sanitized.replace(/\b([A-Za-z0-9]{18,24})\b/g, (match) => {
    const resolved = resolveTargetName(match, null, options);
    if (resolved && !isRawFirestoreId(resolved) && resolved !== 'Record') {
      return resolved;
    }
    // If it's still a raw hash in the middle of a string, replace with friendly noun
    return 'item';
  });

  // Clean up any double spaces or awkward artifacts
  sanitized = sanitized.replace(/\s{2,}/g, ' ').trim();

  return sanitized;
}

export interface HumanizedHistoryEntry {
  what: string;
  detail: string;
  kind: 'count' | 'receipt' | 'adjust';
  delta: number | null;
}

/**
 * Transforms a raw Firestore audit log entry or movement into a clear, readable trail entry.
 */
export function humanizeAuditLog(log: any, options?: HumanizeOptions): HumanizedHistoryEntry {
  const action = (log.action || '').toUpperCase();
  const targetId = log.targetId || log.target || '';
  const targetType = log.targetType || '';
  const metadata = log.metadata || {};

  // Extract delta if present
  let delta: number | null = null;
  if (typeof log.delta === 'number') {
    delta = log.delta;
  } else if (typeof metadata.delta === 'number') {
    delta = metadata.delta;
  } else if (metadata.previousStock !== undefined && metadata.newStock !== undefined) {
    delta = Number(metadata.newStock) - Number(metadata.previousStock);
  }

  // Determine kind
  let kind: 'count' | 'receipt' | 'adjust' = 'adjust';
  if (
    action.includes('DISTRIBUTION') ||
    action.includes('COUNT') ||
    action.includes('EVENT') ||
    log.kind === 'count'
  ) {
    kind = 'count';
  } else if (
    action.includes('RECEIPT') ||
    action.includes('ORDER') ||
    action.includes('DELIVERY') ||
    log.kind === 'receipt'
  ) {
    kind = 'receipt';
  }

  // Resolve target name
  const itemTitle =
    metadata.item?.title ||
    metadata.title ||
    metadata.sku ||
    resolveTargetName(targetId, targetType, options);

  const eventName =
    metadata.eventName ||
    metadata.location ||
    metadata.name ||
    resolveTargetName(targetId, 'event', options);

  let what = '';
  let detail = '';

  switch (action) {
    case 'COUNT_POSTED': {
      what = `Count posted — ${eventName || 'Outreach event'}`;
      if (metadata.linesCount) {
        detail = `${metadata.linesCount} editions counted back`;
      } else if (delta !== null) {
        detail = `${Math.abs(delta)} pieces distributed`;
      } else {
        detail = log.details ? sanitizeDetailText(log.details, options) : 'Event distribution recorded';
      }
      break;
    }

    case 'CORRECTION_FILED': {
      what = `Correction filed — ${eventName || 'Outreach event'}`;
      detail = metadata.note
        ? `"${metadata.note}"`
        : log.details
        ? sanitizeDetailText(log.details, options)
        : 'Recount recorded';
      break;
    }

    case 'STOCK_ADJUSTED':
    case 'STOCK_UPDATE': {
      what = `Adjusted — ${itemTitle || 'Shelf stock'}`;
      if (metadata.isDirectMovement) {
        const isOut = metadata.movementType === 'SUBTRACT';
        what = isOut ? `Direct outflow — ${itemTitle}` : `Direct restock — ${itemTitle}`;
        const parts: string[] = [];
        if (metadata.recipient) parts.push(`To/By: ${metadata.recipient}`);
        if (metadata.category) parts.push(metadata.category);
        if (metadata.note) parts.push(`"${metadata.note}"`);
        detail = parts.length > 0 ? parts.join(' · ') : (log.details ? sanitizeDetailText(log.details, options) : 'Movement logged');
      } else if (metadata.note) {
        detail = `"${metadata.note}"`;
      } else if (metadata.previousStock !== undefined && metadata.newStock !== undefined) {
        detail = `Shelf count: ${metadata.previousStock} → ${metadata.newStock}`;
      } else if (log.details) {
        detail = sanitizeDetailText(log.details, options);
      } else {
        detail = 'Manual shelf stock adjustment';
      }
      break;
    }

    case 'STARTING_STOCK': {
      what = `Initial stock — ${itemTitle || 'Literature'}`;
      detail = delta !== null ? `${delta} units recorded on shelves` : 'Initial catalog quantity set';
      break;
    }

    case 'DELIVERY_RECEIVED': {
      what = `Stock received — ${metadata.orderTitle || itemTitle || 'Literature order'}`;
      detail = log.details ? sanitizeDetailText(log.details, options) : 'Restock arrived on shelves';
      break;
    }

    case 'ORDER_CREATED': {
      what = `Order created — ${metadata.title || itemTitle || 'Literature'}`;
      detail = metadata.qty ? `${metadata.qty} units requested` : (log.details ? sanitizeDetailText(log.details, options) : 'Print order placed');
      break;
    }

    case 'ORDER_UPDATED': {
      what = `Order updated — ${itemTitle || 'Literature order'}`;
      detail = log.details ? sanitizeDetailText(log.details, options) : 'Order details updated';
      break;
    }

    case 'ORDER_DELETED': {
      what = `Order cancelled — ${itemTitle || 'Literature order'}`;
      detail = 'Removed from active orders';
      break;
    }

    case 'ITEM_CREATED': {
      what = `New title added — ${itemTitle || 'Literature'}`;
      detail = metadata.category ? `Category: ${metadata.category}` : 'Added to inventory catalog';
      break;
    }

    case 'ITEM_DELETED': {
      what = `Title removed — ${itemTitle || 'Literature item'}`;
      detail = 'Removed from active catalog';
      break;
    }

    case 'EVENT_CREATED': {
      what = `Event scheduled — ${eventName || metadata.name || 'Outreach'}`;
      detail = metadata.date ? `Date: ${metadata.date}` : 'Added to upcoming events';
      break;
    }

    case 'EVENT_UPDATED': {
      what = `Event updated — ${eventName || 'Outreach event'}`;
      detail = log.details ? sanitizeDetailText(log.details, options) : 'Event details updated';
      break;
    }

    case 'EVENT_DELETED': {
      what = `Event removed — ${eventName || 'Outreach event'}`;
      detail = 'Deleted from event records';
      break;
    }

    case 'DISTRIBUTION': {
      what = `Direct distribution — ${eventName || metadata.recipient || itemTitle || 'Outreach'}`;
      if (log.details) {
        detail = sanitizeDetailText(log.details, options);
      } else if (metadata.items && Array.isArray(metadata.items)) {
        detail = `${metadata.items.length} titles distributed`;
      } else {
        detail = 'Distributed to readers';
      }
      break;
    }

    case 'SETTINGS_UPDATE': {
      what = 'Settings updated';
      detail = 'System configuration and reorder thresholds updated';
      break;
    }

    case 'ROLE_UPDATE': {
      what = `User role updated — ${metadata.newRole || 'Profile'}`;
      detail = log.details ? sanitizeDetailText(log.details, options) : 'Permissions updated';
      break;
    }

    case 'EMAIL_AUTHORIZED': {
      what = `Authorized user added — ${targetId}`;
      detail = 'Granted application access';
      break;
    }

    case 'EMAIL_DEAUTHORIZED': {
      what = `User access revoked — ${targetId}`;
      detail = 'Removed from authorized list';
      break;
    }

    default: {
      // Fallback for pre-existing or custom logs
      if (log.what && !isRawFirestoreId(log.what)) {
        what = sanitizeDetailText(log.what, options);
      } else {
        const readableAction = action
          .toLowerCase()
          .replace(/_/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase());
        what = itemTitle && itemTitle !== 'Record' && itemTitle !== 'Literature Item'
          ? `${readableAction} — ${itemTitle}`
          : readableAction || 'Stock Activity';
      }

      if (log.detail || log.details) {
        detail = sanitizeDetailText(log.detail || log.details, options);
      } else {
        detail = 'Activity recorded in ledger';
      }
      break;
    }
  }

  // Final check: if `what` or `detail` somehow contains raw 20-character IDs, clean them
  what = sanitizeDetailText(what, options);
  detail = sanitizeDetailText(detail, options);

  return { what, detail, kind, delta };
}
