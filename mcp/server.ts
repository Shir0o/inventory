/**
 * Lit-Ledger MCP server.
 *
 * Exposes read/write inventory tools over the Model Context Protocol (stdio)
 * backed by the project's Firestore database. Run with `npm run mcp`.
 */
import process from 'node:process';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { createBackend, logToStderr, type FirestoreBackend, type FirestoreDoc } from './firestore.ts';

const DEFAULT_WARNING_LIMIT = 250;
const DEFAULT_CRITICAL_LIMIT = 75;
const MAX_INVENTORY_SCAN = 2500;
const MAX_EVENT_SCAN = 2500;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface Thresholds {
  warning: number;
  critical: number;
}

type TextContent = { type: 'text'; text: string };
type ToolResponse = { content: TextContent[]; isError?: boolean };

let backendPromise: Promise<FirestoreBackend> | undefined;

function getBackend(): Promise<FirestoreBackend> {
  if (!backendPromise) {
    backendPromise = createBackend().catch((error: unknown) => {
      // Allow a later tool call to retry after a transient connection failure.
      backendPromise = undefined;
      throw error;
    });
  }
  return backendPromise;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function jsonResult(payload: unknown): ToolResponse {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

async function runTool(work: () => Promise<unknown>): Promise<ToolResponse> {
  try {
    return jsonResult(await work());
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${errorMessage(error)}` }],
      isError: true,
    };
  }
}

/** Converts Firestore Timestamps and nested values into JSON-safe values. */
function serialize(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(serialize);
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.toDate === 'function') {
      const date = (record as { toDate: () => Date }).toDate();
      if (date instanceof Date && !Number.isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(record)) {
      result[key] = serialize(nested);
    }
    return result;
  }
  return value;
}

function asNumber(value: unknown, fallback = 0): number {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function categoryKey(raw: unknown): string {
  const value = String(raw ?? '').trim().toLowerCase();
  if (!value) return '';
  if (value.includes('bib')) return 'bibles';
  if (value.includes('book') || value.includes('element') || value.includes('folleto')) return 'booklets';
  if (value.includes('tract') || value.includes('tratado')) return 'tracts';
  return value;
}

function displayCategory(raw: unknown): string | null {
  if (raw === null || raw === undefined || String(raw).trim() === '') return null;
  const key = categoryKey(raw);
  if (key === 'bibles') return 'Bibles';
  if (key === 'tracts') return 'Tracts';
  if (key === 'booklets') return 'Booklets';
  return String(raw).trim();
}

function languageKey(raw: unknown): string {
  const value = String(raw ?? '').trim().toLowerCase();
  if (!value) return '';
  if (value.startsWith('en') || value.includes('english') || value.includes('ingl')) return 'en';
  if (value.startsWith('es') || value.includes('spanish') || value.includes('espa')) return 'es';
  return value;
}

function displayLanguage(raw: unknown): string | null {
  if (raw === null || raw === undefined || String(raw).trim() === '') return null;
  const key = languageKey(raw);
  if (key === 'en') return 'English';
  if (key === 'es') return 'Spanish';
  return String(raw).trim();
}

function stockOf(data: Record<string, unknown>): number {
  return asNumber(data.stockLevel ?? data.stock, 0);
}

function statusForStock(stock: number, thresholds: Thresholds): 'Healthy' | 'Low' | 'Out' {
  if (stock <= thresholds.critical) return 'Out';
  if (stock <= thresholds.warning) return 'Low';
  return 'Healthy';
}

function normalizeItem(doc: FirestoreDoc, thresholds: Thresholds): Record<string, unknown> {
  const data = serialize(doc.data) as Record<string, unknown>;
  const stockLevel = stockOf(data);
  const rawStatus = typeof data.status === 'string' ? data.status.trim() : '';

  return {
    ...data,
    id: doc.id,
    sku: data.sku ?? data.code ?? null,
    title: data.title ?? data.name ?? null,
    category: displayCategory(data.category ?? data.cat),
    language: displayLanguage(data.language ?? data.lang),
    stockLevel,
    status: rawStatus || statusForStock(stockLevel, thresholds),
  };
}

function normalizeEvent(doc: FirestoreDoc): Record<string, unknown> {
  const data = serialize(doc.data) as Record<string, unknown>;
  return {
    ...data,
    id: doc.id,
    name: data.name ?? data.location ?? null,
    materialsDistributed: asNumber(data.materialsDistributed),
  };
}

function normalizeMaterial(doc: FirestoreDoc): Record<string, unknown> {
  const data = serialize(doc.data) as Record<string, unknown>;
  return {
    ...data,
    id: doc.id,
    quantity: asNumber(data.quantity),
    ...(data.preCount === undefined ? {} : { preCount: asNumber(data.preCount) }),
    ...(data.postCount === undefined ? {} : { postCount: asNumber(data.postCount) }),
  };
}

function dateTimeOf(value: unknown): number | null {
  const serialized = serialize(value);
  if (typeof serialized !== 'string') return null;
  const time = Date.parse(serialized);
  return Number.isFinite(time) ? time : null;
}

function parseDay(value: string, endOfDay: boolean): number {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(
    year,
    month - 1,
    day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0
  ).getTime();
}

async function loadThresholds(backend: FirestoreBackend): Promise<Thresholds> {
  const settings = await backend.getDoc('settings/system');
  return {
    warning: Math.max(0, asNumber(settings?.data.warningThreshold, DEFAULT_WARNING_LIMIT)),
    critical: Math.max(0, asNumber(settings?.data.criticalThreshold, DEFAULT_CRITICAL_LIMIT)),
  };
}

async function fetchInventory(backend: FirestoreBackend): Promise<FirestoreDoc[]> {
  return backend.listCollection('inventory', { limit: MAX_INVENTORY_SCAN });
}

async function findItemsBySku(backend: FirestoreBackend, sku: string): Promise<FirestoreDoc[]> {
  const trimmed = sku.trim();
  const exact = await backend.getDocsWhere('inventory', 'sku', trimmed, 10);
  if (exact.length > 0) return exact;

  const upper = await backend.getDocsWhere('inventory', 'sku', trimmed.toUpperCase(), 10);
  if (upper.length > 0) return upper;

  const wanted = trimmed.toLowerCase();
  const all = await fetchInventory(backend);
  return all.filter(
    (doc) => String(doc.data.sku ?? doc.data.code ?? '').trim().toLowerCase() === wanted
  );
}

async function resolveItem(
  backend: FirestoreBackend,
  reference: { itemId?: string; sku?: string }
): Promise<FirestoreDoc> {
  if (reference.itemId) {
    const item = await backend.getDoc(`inventory/${reference.itemId}`);
    if (!item) {
      throw new Error(`Inventory item "${reference.itemId}" was not found.`);
    }
    return item;
  }

  if (!reference.sku) {
    throw new Error('Provide either itemId or sku.');
  }

  const matches = await findItemsBySku(backend, reference.sku);
  if (matches.length === 0) {
    throw new Error(`No inventory item found with SKU "${reference.sku}".`);
  }
  if (matches.length > 1) {
    const ids = matches.map((match) => `${match.id} (${match.data.title ?? 'untitled'})`).join(', ');
    throw new Error(`Multiple items match SKU "${reference.sku}": ${ids}. Pass itemId to disambiguate.`);
  }
  return matches[0];
}

function sortItems(
  items: Record<string, unknown>[],
  sortBy: 'sku' | 'title' | 'stockLevel' | 'updatedAt',
  direction: 'asc' | 'desc'
): Record<string, unknown>[] {
  const factor = direction === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    if (sortBy === 'stockLevel') {
      return (asNumber(a.stockLevel) - asNumber(b.stockLevel)) * factor;
    }
    const left = String(a[sortBy] ?? '').toLowerCase();
    const right = String(b[sortBy] ?? '').toLowerCase();
    return left.localeCompare(right) * factor;
  });
}

function scoreItem(item: Record<string, unknown>, query: string, terms: string[]): number {
  const title = String(item.title ?? '').toLowerCase();
  const subtitle = String(item.subtitle ?? '').toLowerCase();
  const sku = String(item.sku ?? '').toLowerCase();
  const baseCode = String(item.baseCode ?? '').toLowerCase();
  const baseName = String(item.baseName ?? '').toLowerCase();
  const aliases = Array.isArray(item.aliases) ? item.aliases.join(' ').toLowerCase() : '';
  const haystack = [sku, title, subtitle, baseCode, baseName, aliases].join(' ');

  if (!terms.every((term) => haystack.includes(term))) {
    return 0;
  }
  if (sku === query) return 100;
  if (title.startsWith(query)) return 60;
  if (sku.startsWith(query)) return 50;
  if (baseCode === query) return 45;
  if (title.includes(query)) return 30;
  return 10;
}

const server = new McpServer(
  {
    name: 'lit-ledger',
    version: '1.0.1',
    title: 'Lit-Ledger Inventory',
  },
  {
    instructions:
      'Read and manage the Lit-Ledger Firestore inventory: literature catalog items, ' +
      'distribution events, categories and audit logs. Stock-changing tools recompute ' +
      'Healthy/Low/Out status and write an audit log entry.',
  }
);

// ---------------------------------------------------------------------------
// Inventory read tools
// ---------------------------------------------------------------------------

server.registerTool(
  'list_items',
  {
    title: 'List inventory items',
    description:
      'List inventory items with optional category, language, status and stock filters. ' +
      'Returns the total number of matches plus the requested page.',
    inputSchema: {
      category: z
        .string()
        .trim()
        .min(1)
        .optional()
        .describe('Category filter, e.g. "Bibles", "Tracts" or "Booklets" (case/plural tolerant).'),
      language: z
        .string()
        .trim()
        .min(1)
        .optional()
        .describe('Language filter, e.g. "English", "Spanish", "EN" or "ES".'),
      status: z
        .enum(['Healthy', 'Low', 'Out'])
        .optional()
        .describe('Filter by effective stock status.'),
      lowStockOnly: z
        .boolean()
        .default(false)
        .describe('Only return items whose effective status is Low or Out.'),
      maxStockLevel: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe('Only return items at or below this stock level.'),
      sortBy: z.enum(['sku', 'title', 'stockLevel', 'updatedAt']).default('sku'),
      sortDirection: z.enum(['asc', 'desc']).default('asc'),
      limit: z.number().int().min(1).max(500).default(50),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async ({ category, language, status, lowStockOnly, maxStockLevel, sortBy, sortDirection, limit }) =>
    runTool(async () => {
      const backend = await getBackend();
      const thresholds = await loadThresholds(backend);
      const docs = await fetchInventory(backend);
      let items = docs.map((doc) => normalizeItem(doc, thresholds));

      if (category) {
        const wanted = categoryKey(category);
        items = items.filter((item) => categoryKey(item.category) === wanted);
      }
      if (language) {
        const wanted = languageKey(language);
        items = items.filter((item) => languageKey(item.language) === wanted);
      }
      if (status) {
        items = items.filter((item) => String(item.status).toLowerCase() === status.toLowerCase());
      }
      if (lowStockOnly) {
        items = items.filter((item) => String(item.status) !== 'Healthy');
      }
      if (maxStockLevel !== undefined) {
        items = items.filter((item) => asNumber(item.stockLevel) <= maxStockLevel);
      }

      items = sortItems(items, sortBy, sortDirection);
      return {
        total: items.length,
        returned: Math.min(items.length, limit),
        limit,
        items: items.slice(0, limit),
      };
    })
);

server.registerTool(
  'get_item',
  {
    title: 'Get inventory item',
    description:
      'Fetch a single inventory item by Firestore document id or by SKU. SKU matching is case-insensitive.',
    inputSchema: {
      itemId: z.string().trim().min(1).optional().describe('Firestore document id from the inventory collection.'),
      sku: z.string().trim().min(1).optional().describe('Stock Keeping Unit, e.g. "B-EN-001".'),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async ({ itemId, sku }) =>
    runTool(async () => {
      const backend = await getBackend();
      const thresholds = await loadThresholds(backend);
      const item = await resolveItem(backend, { itemId, sku });
      return { item: normalizeItem(item, thresholds) };
    })
);

server.registerTool(
  'search_items',
  {
    title: 'Search inventory',
    description:
      'Search the catalog by free text across SKU, title, subtitle, base code, base name and aliases. ' +
      'All whitespace-separated terms must match.',
    inputSchema: {
      query: z.string().trim().min(1).describe('Search text, e.g. "bible spanish" or "T-EN-001".'),
      category: z.string().trim().min(1).optional().describe('Optional category filter.'),
      language: z.string().trim().min(1).optional().describe('Optional language filter.'),
      limit: z.number().int().min(1).max(100).default(20),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async ({ query, category, language, limit }) =>
    runTool(async () => {
      const backend = await getBackend();
      const thresholds = await loadThresholds(backend);
      const docs = await fetchInventory(backend);
      const normalizedQuery = query.toLowerCase();
      const terms = normalizedQuery.split(/\s+/).filter(Boolean);

      let items = docs.map((doc) => normalizeItem(doc, thresholds));
      if (category) {
        const wanted = categoryKey(category);
        items = items.filter((item) => categoryKey(item.category) === wanted);
      }
      if (language) {
        const wanted = languageKey(language);
        items = items.filter((item) => languageKey(item.language) === wanted);
      }

      const matches = items
        .map((item) => ({ item, score: scoreItem(item, normalizedQuery, terms) }))
        .filter((match) => match.score > 0)
        .sort((left, right) => {
          if (right.score !== left.score) return right.score - left.score;
          return String(left.item.title ?? '').localeCompare(String(right.item.title ?? ''));
        });

      return {
        query,
        total: matches.length,
        returned: Math.min(matches.length, limit),
        items: matches.slice(0, limit).map((match) => ({ ...match.item, matchScore: match.score })),
      };
    })
);

server.registerTool(
  'list_categories',
  {
    title: 'List categories',
    description:
      'Summarize inventory by category: item count, total stock, low-stock and out-of-stock counts. ' +
      'Also returns the configured warning/critical thresholds and any categories stored in settings.',
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async () =>
    runTool(async () => {
      const backend = await getBackend();
      const [settings, docs] = await Promise.all([
        backend.getDoc('settings/system'),
        fetchInventory(backend),
      ]);
      const thresholds = {
        warning: Math.max(0, asNumber(settings?.data.warningThreshold, DEFAULT_WARNING_LIMIT)),
        critical: Math.max(0, asNumber(settings?.data.criticalThreshold, DEFAULT_CRITICAL_LIMIT)),
      };
      const items = docs.map((doc) => normalizeItem(doc, thresholds));

      const categories = new Map<
        string,
        { category: string; itemCount: number; totalStock: number; lowStockCount: number; outOfStockCount: number }
      >();

      for (const item of items) {
        const label = String(item.category ?? 'Uncategorized');
        const current = categories.get(label) ?? {
          category: label,
          itemCount: 0,
          totalStock: 0,
          lowStockCount: 0,
          outOfStockCount: 0,
        };
        const status = String(item.status);
        current.itemCount += 1;
        current.totalStock += asNumber(item.stockLevel);
        if (status === 'Low') current.lowStockCount += 1;
        if (status === 'Out') current.outOfStockCount += 1;
        categories.set(label, current);
      }

      const configured = settings?.data.categories;

      return {
        totalItems: items.length,
        totalStock: items.reduce((sum, item) => sum + asNumber(item.stockLevel), 0),
        thresholds,
        configuredCategories: Array.isArray(configured) ? configured : null,
        categories: [...categories.values()].sort((left, right) => right.totalStock - left.totalStock),
      };
    })
);

// ---------------------------------------------------------------------------
// Event read tools
// ---------------------------------------------------------------------------

server.registerTool(
  'list_events',
  {
    title: 'List distribution events',
    description:
      'List distribution events, newest first, with optional status and inclusive date-range filters.',
    inputSchema: {
      status: z.string().trim().min(1).optional().describe('Status filter, e.g. "Scheduled" or "Completed".'),
      from: z.string().regex(DATE_PATTERN).optional().describe('Inclusive start date (YYYY-MM-DD).'),
      to: z.string().regex(DATE_PATTERN).optional().describe('Inclusive end date (YYYY-MM-DD).'),
      limit: z.number().int().min(1).max(100).default(20),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async ({ status, from, to, limit }) =>
    runTool(async () => {
      const backend = await getBackend();
      const docs = await backend.listCollection('events', { limit: MAX_EVENT_SCAN });
      let events = docs.map(normalizeEvent);

      if (status) {
        const wanted = status.toLowerCase();
        events = events.filter((event) => String(event.status ?? '').toLowerCase() === wanted);
      }
      if (from) {
        const fromTime = parseDay(from, false);
        events = events.filter((event) => {
          const time = dateTimeOf(event.date);
          return time !== null && time >= fromTime;
        });
      }
      if (to) {
        const toTime = parseDay(to, true);
        events = events.filter((event) => {
          const time = dateTimeOf(event.date);
          return time !== null && time <= toTime;
        });
      }

      events.sort((left, right) => {
        const leftTime = dateTimeOf(left.date) ?? 0;
        const rightTime = dateTimeOf(right.date) ?? 0;
        return rightTime - leftTime;
      });

      return {
        total: events.length,
        returned: Math.min(events.length, limit),
        events: events.slice(0, limit),
      };
    })
);

server.registerTool(
  'get_event',
  {
    title: 'Get distribution event',
    description:
      'Fetch one distribution event by id. By default it also returns the event materials subcollection.',
    inputSchema: {
      eventId: z.string().trim().min(1).describe('Firestore document id from the events collection.'),
      includeMaterials: z.boolean().default(true).describe('Include the event materials subcollection.'),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async ({ eventId, includeMaterials }) =>
    runTool(async () => {
      const backend = await getBackend();
      const event = await backend.getDoc(`events/${eventId}`);
      if (!event) {
        throw new Error(`Event "${eventId}" was not found.`);
      }

      if (!includeMaterials) {
        return { event: normalizeEvent(event) };
      }

      const materialDocs = await backend.listCollection(`events/${eventId}/materials`, {
        limit: 1000,
      });
      const materials = materialDocs
        .map(normalizeMaterial)
        .sort((left, right) => {
          const leftTime = dateTimeOf(left.assignedAt) ?? 0;
          const rightTime = dateTimeOf(right.assignedAt) ?? 0;
          return rightTime - leftTime;
        });

      return {
        event: normalizeEvent(event),
        materialCount: materials.length,
        materials,
      };
    })
);

// ---------------------------------------------------------------------------
// Inventory write tools
// ---------------------------------------------------------------------------

server.registerTool(
  'update_item_quantity',
  {
    title: 'Update item quantity',
    description:
      'Change an item\'s stock level in a transaction. mode="set" replaces it, "add" receives units, ' +
      '"subtract" gives units out (never below zero). Recomputes Healthy/Low/Out status from settings ' +
      'thresholds and writes an audit log entry.',
    inputSchema: {
      itemId: z.string().trim().min(1).optional().describe('Firestore document id of the item.'),
      sku: z.string().trim().min(1).optional().describe('SKU of the item, if itemId is not provided.'),
      mode: z.enum(['set', 'add', 'subtract']).default('set').describe('How to apply quantity.'),
      quantity: z.number().int().min(0).describe('Units to set, add or subtract.'),
      reason: z
        .string()
        .trim()
        .max(500)
        .optional()
        .describe('Optional note stored in the audit log, e.g. "Weekly count correction".'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  async ({ itemId, sku, mode, quantity, reason }) =>
    runTool(async () => {
      const backend = await getBackend();
      const thresholds = await loadThresholds(backend);
      const target = await resolveItem(backend, { itemId, sku });
      const title = String(target.data.title ?? target.data.name ?? target.id);

      const result = await backend.runTransaction(async (tx) => {
        const current = await tx.get(`inventory/${target.id}`);
        if (!current) {
          throw new Error(`Inventory item "${target.id}" no longer exists.`);
        }

        const previousStock = stockOf(current.data);
        const nextStock =
          mode === 'set' ? quantity : mode === 'add' ? previousStock + quantity : previousStock - quantity;

        if (nextStock < 0) {
          throw new Error(
            `Insufficient stock for "${title}": ${previousStock} available, ${quantity} requested.`
          );
        }

        const status = statusForStock(nextStock, thresholds);
        tx.update(`inventory/${target.id}`, {
          stockLevel: nextStock,
          status,
          updatedAt: backend.serverTimestamp(),
        });

        return { previousStock, nextStock, status };
      });

      const action =
        mode === 'set'
          ? `Set stock of ${title} from ${result.previousStock} to ${result.nextStock}`
          : mode === 'add'
            ? `Received ${quantity} unit(s) of ${title}`
            : `Gave out ${quantity} unit(s) of ${title}`;
      const detail = `${action} (${result.previousStock} → ${result.nextStock})`;
      const note = reason?.trim();

      await backend.addDoc('audit_logs', {
        action: 'STOCK_UPDATE',
        targetId: target.id,
        targetType: 'inventory',
        details: note ? `${detail} • "${note}"` : detail,
        userId: null,
        userName: 'Lit-Ledger MCP',
        userEmail: null,
        timestamp: backend.serverTimestamp(),
        metadata: {
          source: 'mcp',
          mode,
          quantity,
          previousStock: result.previousStock,
          newStock: result.nextStock,
          status: result.status,
          item: { id: target.id, title, sku: target.data.sku ?? null },
        },
      });

      const updated = await backend.getDoc(`inventory/${target.id}`);
      return {
        mode,
        quantity,
        previousStock: result.previousStock,
        newStock: result.nextStock,
        change: result.nextStock - result.previousStock,
        status: result.status,
        item: updated ? normalizeItem(updated, thresholds) : null,
      };
    })
);

server.registerTool(
  'create_item',
  {
    title: 'Create inventory item',
    description:
      'Create a new inventory item. Rejects a SKU that already exists (case-insensitive) and writes ' +
      'an audit log entry. Status is derived from the initial stock level.',
    inputSchema: {
      sku: z.string().trim().min(1).max(128).describe('Unique stock keeping unit, e.g. "B-EN-002".'),
      title: z.string().trim().min(1).max(512).describe('Title of the literature or material.'),
      category: z.enum(['Bibles', 'Tracts', 'Booklets']).describe('Catalog category.'),
      language: z.enum(['English', 'Spanish']).default('English'),
      subtitle: z.string().trim().max(512).optional().describe('Subtitle or edition details.'),
      unitPrice: z.number().min(0).optional().describe('Cost per unit for valuation.'),
      stockLevel: z.number().int().min(0).default(0).describe('Initial stock level.'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  async ({ sku, title, category, language, subtitle, unitPrice, stockLevel }) =>
    runTool(async () => {
      const backend = await getBackend();
      const thresholds = await loadThresholds(backend);
      const normalizedSku = sku.trim().toUpperCase();

      const existing = await findItemsBySku(backend, normalizedSku);
      if (existing.length > 0) {
        const ids = existing.map((match) => match.id).join(', ');
        throw new Error(`An item with SKU "${normalizedSku}" already exists (id: ${ids}).`);
      }

      const itemId = await backend.addDoc('inventory', {
        sku: normalizedSku,
        title: title.trim(),
        ...(subtitle ? { subtitle: subtitle.trim() } : {}),
        category,
        language,
        stockLevel,
        status: statusForStock(stockLevel, thresholds),
        ...(unitPrice === undefined ? {} : { unitPrice }),
        createdAt: backend.serverTimestamp(),
        updatedAt: backend.serverTimestamp(),
      });

      await backend.addDoc('audit_logs', {
        action: 'ITEM_CREATED',
        targetId: itemId,
        targetType: 'inventory',
        details: `Created catalog item: ${title.trim()} (${normalizedSku})`,
        userId: null,
        userName: 'Lit-Ledger MCP',
        userEmail: null,
        timestamp: backend.serverTimestamp(),
        metadata: { source: 'mcp', sku: normalizedSku, category, language, stockLevel },
      });

      const created = await backend.getDoc(`inventory/${itemId}`);
      return { item: created ? normalizeItem(created, thresholds) : { id: itemId } };
    })
);

// ---------------------------------------------------------------------------
// Audit log tool
// ---------------------------------------------------------------------------

server.registerTool(
  'list_audit_logs',
  {
    title: 'List audit logs',
    description:
      'List recent audit log entries, newest first, optionally filtered by action or target id.',
    inputSchema: {
      limit: z.number().int().min(1).max(200).default(20),
      action: z
        .string()
        .trim()
        .min(1)
        .optional()
        .describe('Case-insensitive action filter, e.g. "STOCK_UPDATE" or "DISTRIBUTION".'),
      targetId: z.string().trim().min(1).optional().describe('Filter by the affected item/event id.'),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async ({ limit, action, targetId }) =>
    runTool(async () => {
      const backend = await getBackend();
      const fetchLimit = action || targetId ? Math.min(1000, limit * 10) : limit;
      const docs = await backend.listCollection('audit_logs', {
        orderBy: 'timestamp',
        direction: 'desc',
        limit: fetchLimit,
      });

      let logs: Record<string, unknown>[] = docs.map((doc) => ({
        ...(serialize(doc.data) as Record<string, unknown>),
        id: doc.id,
      }));

      if (action) {
        const wanted = action.toLowerCase();
        logs = logs.filter((log) => String(log.action ?? '').toLowerCase() === wanted);
      }
      if (targetId) {
        logs = logs.filter((log) => String(log.targetId ?? '') === targetId);
      }

      return {
        returned: Math.min(logs.length, limit),
        logs: logs.slice(0, limit),
      };
    })
);

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);

const shutdown = () => {
  void server.close().finally(() => process.exit(0));
};

process.stdin.on('end', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

logToStderr('[lit-ledger-mcp] ready on stdio (tools: list_items, get_item, search_items, list_categories, list_events, get_event, update_item_quantity, create_item, list_audit_logs)');
