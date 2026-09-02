import { collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { createAuditLog } from './firestoreService';
import { Category, Language } from '../types';

export interface SourceDocument {
  id: string;
  sku: string;
  title: string;
  language: string;
  category: string;
  stockLevel: number;
  baseCode?: string;
  baseName?: string;
  isRedundant?: boolean;
  timestampMs: number;
  updatedAtFormatted: string;
  isLatest: boolean;
}

export type ReconciliationStrategy = 'reconcile_latest' | 'sum_all';

export interface ProposedEdition {
  lang: Language;
  canonicalSku: string;
  title: string;
  stockLevel: number; // The chosen reconciled stock level to apply
  latestStock: number; // Stock from the latest, most accurate document
  sumStock: number; // Sum of all duplicate documents
  countVariance: number; // sumStock - latestStock
  primaryDocId: string;
  latestDocId: string;
  latestDocDate: string;
  mergedDocIds: string[];
  sourceDocs: SourceDocument[];
  hasDuplicates: boolean;
  selectedStrategy: ReconciliationStrategy | 'custom';
  recentEventCount?: { date: string; count: number; eventName: string } | null;
  recentAuditAdjustment?: { date: string; newStock: number; reason: string } | null;
}

export interface ProposedGroup {
  id: string;
  baseCode: string;
  baseName: string;
  category: Category;
  editions: ProposedEdition[];
  totalStockBefore: number;
  totalStockAfter: number;
  totalStockSum: number;
  redundantDocCount: number;
  reconcileVariance: number;
  hasCountVariance: boolean;
  reason: string;
}

export interface AnalyzeOptions {
  strategy?: ReconciliationStrategy;
  customCounts?: Record<string, number>; // canonicalSku -> custom count
  events?: any[];
  auditLogs?: any[];
}

export interface CleanupPlan {
  groups: ProposedGroup[];
  totalDocsBefore: number;
  totalDocsAfter: number;
  totalStockBefore: number;
  totalStockAfter: number; // Total stock based on selected reconciliation strategy
  totalStockSum: number; // Total stock if all duplicates were summed
  totalVarianceResolved: number; // Duplicate inflation eliminated (totalStockSum - totalStockAfter)
  duplicateDocsCount: number;
  duplicateGroupsCount: number;
  unlinkedPairsUnified: number;
  docsToDelete: string[];
  docsToUpdate: {
    id: string;
    data: any;
  }[];
  hasChanges: boolean;
  reconciliationStrategy: ReconciliationStrategy;
}

// Known title pairs for standard catalog literature if unlinked
const KNOWN_TITLE_PAIRS: { [key: string]: { baseCode: string; baseName: string; cat: Category; enTitle: string; esTitle: string } } = {
  'nkjv holy bible': { baseCode: 'BIB-NKJV', baseName: 'NKJV Holy Bible', cat: 'Bible', enTitle: 'NKJV Holy Bible', esTitle: 'Santa Biblia RV1960' },
  'santa biblia rv1960': { baseCode: 'BIB-NKJV', baseName: 'NKJV Holy Bible', cat: 'Bible', enTitle: 'NKJV Holy Bible', esTitle: 'Santa Biblia RV1960' },
  'new testament recovery version': { baseCode: 'BIB-NTRV', baseName: 'New Testament Recovery Version', cat: 'Bible', enTitle: 'New Testament Recovery Version', esTitle: 'Nuevo Testamento Versión Recobro' },
  'nuevo testamento versión recobro': { baseCode: 'BIB-NTRV', baseName: 'New Testament Recovery Version', cat: 'Bible', enTitle: 'New Testament Recovery Version', esTitle: 'Nuevo Testamento Versión Recobro' },
  'steps to christ': { baseCode: 'TR-STC', baseName: 'Steps to Christ', cat: 'Tract', enTitle: 'Steps to Christ', esTitle: 'El Camino a Cristo' },
  'el camino a cristo': { baseCode: 'TR-STC', baseName: 'Steps to Christ', cat: 'Tract', enTitle: 'Steps to Christ', esTitle: 'El Camino a Cristo' },
  'understanding prophecy': { baseCode: 'BKL-PROP', baseName: 'Understanding Prophecy', cat: 'Booklet', enTitle: 'Understanding Prophecy', esTitle: 'Entendiendo la Profecía' },
  'entendiendo la profecía': { baseCode: 'BKL-PROP', baseName: 'Understanding Prophecy', cat: 'Booklet', enTitle: 'Understanding Prophecy', esTitle: 'Entendiendo la Profecía' },
  'foolishness or the power of god?': { baseCode: 'TR-FOOL', baseName: 'Foolishness or the Power of God?', cat: 'Tract', enTitle: 'Foolishness or the Power of God?', esTitle: 'La palabra de la cruz: ¿locura o sabiduría?' },
  'freed from the fear of death': { baseCode: 'TR-FEAR', baseName: 'Freed from the Fear of Death', cat: 'Tract', enTitle: 'Freed from the Fear of Death', esTitle: 'Librados del temor de la muerte' },
  'how can i know god exists?': { baseCode: 'TR-EXIST', baseName: 'How Can I Know God Exists?', cat: 'Tract', enTitle: 'How Can I Know God Exists?', esTitle: '¿Cómo saber que Dios existe?' },
  'is jesus in your boat?': { baseCode: 'TR-BOAT', baseName: 'Is Jesus in Your Boat?', cat: 'Tract', enTitle: 'Is Jesus in Your Boat?', esTitle: '¿Está Jesús en su barca?' },
  'basic elements of the christian life, vol. 1': { baseCode: 'BKL-BE1', baseName: 'Basic Elements of the Christian Life, vol. 1', cat: 'Booklet', enTitle: 'Basic Elements of the Christian Life, vol. 1', esTitle: 'Elementos básicos de la vida cristiana, tomo 1' },
  'basic elements of the christian life, vol. 2': { baseCode: 'BKL-BE2', baseName: 'Basic Elements of the Christian Life, vol. 2', cat: 'Booklet', enTitle: 'Basic Elements of the Christian Life, vol. 2', esTitle: 'Elementos básicos de la vida cristiana, tomo 2' },
  'basic elements of the christian life, vol. 3': { baseCode: 'BKL-BE3', baseName: 'Basic Elements of the Christian Life, vol. 3', cat: 'Booklet', enTitle: 'Basic Elements of the Christian Life, vol. 3', esTitle: 'Elementos básicos de la vida cristiana, tomo 3' }
};

export function normalizeLang(item: any): Language {
  const langRaw = String(item.language || '').toLowerCase().trim();
  const skuRaw = String(item.sku || '').toUpperCase();
  const titleRaw = String(item.title || '').toLowerCase();

  if (
    langRaw.includes('es') || 
    langRaw.includes('span') || 
    skuRaw.endsWith('-ES') || 
    skuRaw.includes('-ES-') || 
    skuRaw.includes('_ES') ||
    titleRaw.includes('(spanish)') ||
    titleRaw.includes('(es)')
  ) {
    return 'ES';
  }
  return 'EN';
}

export function normalizeCategory(catRaw: any): Category {
  const c = String(catRaw || 'Tract').trim().toLowerCase();
  if (c.includes('bib')) return 'Bible';
  if (c.includes('book')) return 'Booklet';
  return 'Tract';
}

export function extractBaseCode(item: any): { baseCode: string; baseName: string; category: Category } {
  const cat = normalizeCategory(item.category || item.cat);
  const titleNorm = String(item.title || '').trim().toLowerCase();
  
  // Check known catalog literature pairs first
  for (const [key, val] of Object.entries(KNOWN_TITLE_PAIRS)) {
    if (titleNorm.includes(key) || key.includes(titleNorm)) {
      return { baseCode: val.baseCode, baseName: val.baseName, category: val.cat };
    }
  }

  // If item already has an explicit baseCode
  if (item.baseCode && String(item.baseCode).trim()) {
    const cleanBaseCode = String(item.baseCode).trim().toUpperCase();
    const cleanBaseName = item.baseName || item.title?.replace(/\s*\((English|Spanish|EN|ES)\)/i, '').trim() || item.title;
    return { baseCode: cleanBaseCode, baseName: cleanBaseName, category: cat };
  }

  // Derive from SKU
  const sku = String(item.sku || item.id || '').toUpperCase().trim();
  if (sku) {
    let derived = sku
      .replace(/-(EN|ES)$/i, '')
      .replace(/-(EN|ES)-/i, '-')
      .replace(/_(EN|ES)$/i, '')
      .replace(/_(EN|ES)_/i, '_');
    
    if (derived && derived !== sku) {
      const cleanBaseName = item.baseName || item.title?.replace(/\s*\((English|Spanish|EN|ES)\)/i, '').trim() || item.title;
      return { baseCode: derived, baseName: cleanBaseName, category: cat };
    }
  }

  // Derive from title slug
  const titleSlug = (item.title || 'ITEM')
    .toUpperCase()
    .replace(/\s*\((ENGLISH|SPANISH|EN|ES)\)/i, '')
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
  
  const prefix = cat === 'Bible' ? 'BIB' : cat === 'Booklet' ? 'BKL' : 'TR';
  const fallbackCode = `${prefix}-${titleSlug || 'ITEM'}`;
  const baseName = item.baseName || item.title?.replace(/\s*\((English|Spanish|EN|ES)\)/i, '').trim() || item.title;
  
  return { baseCode: fallbackCode, baseName, category: cat };
}

export function extractTimestampMs(doc: any): number {
  if (!doc) return 0;
  // Check updatedAt
  if (doc.updatedAt) {
    if (typeof doc.updatedAt.toDate === 'function') return doc.updatedAt.toDate().getTime();
    if (typeof doc.updatedAt.toMillis === 'function') return doc.updatedAt.toMillis();
    if (doc.updatedAt.seconds) return doc.updatedAt.seconds * 1000;
    const t = new Date(doc.updatedAt).getTime();
    if (!isNaN(t)) return t;
  }
  // Check createdAt
  if (doc.createdAt) {
    if (typeof doc.createdAt.toDate === 'function') return doc.createdAt.toDate().getTime();
    if (typeof doc.createdAt.toMillis === 'function') return doc.createdAt.toMillis();
    if (doc.createdAt.seconds) return doc.createdAt.seconds * 1000;
    const t = new Date(doc.createdAt).getTime();
    if (!isNaN(t)) return t;
  }
  // Check date or occurredAt
  if (doc.occurredAt || doc.date) {
    const t = new Date(doc.occurredAt || doc.date).getTime();
    if (!isNaN(t)) return t;
  }
  return 0;
}

export function formatTimestamp(doc: any): string {
  const ms = extractTimestampMs(doc);
  if (!ms) return 'Initial database entry';
  const d = new Date(ms);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + 
         d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/**
 * Analyzes raw inventory documents and generates a non-destructive Dry Run Cleanup Plan
 * with intelligent Count Reconciliation (update to latest most accurate count).
 */
export function analyzeInventory(rawInventory: any[], options: AnalyzeOptions = {}): CleanupPlan {
  const strategy: ReconciliationStrategy = options.strategy || 'reconcile_latest';
  const customCounts = options.customCounts || {};
  const events = options.events || [];
  const auditLogs = options.auditLogs || [];

  if (!rawInventory || rawInventory.length === 0) {
    return {
      groups: [],
      totalDocsBefore: 0,
      totalDocsAfter: 0,
      totalStockBefore: 0,
      totalStockAfter: 0,
      totalStockSum: 0,
      totalVarianceResolved: 0,
      duplicateDocsCount: 0,
      duplicateGroupsCount: 0,
      unlinkedPairsUnified: 0,
      docsToDelete: [],
      docsToUpdate: [],
      hasChanges: false,
      reconciliationStrategy: strategy
    };
  }

  const totalDocsBefore = rawInventory.length;
  let totalStockBefore = 0;

  // 1. Group documents by calculated Base Code
  interface InternalGroup {
    baseCode: string;
    baseName: string;
    category: Category;
    editionsMap: Map<Language, any[]>;
  }

  const groupsMap = new Map<string, InternalGroup>();

  rawInventory.forEach((doc) => {
    const stock = Number(doc.stockLevel ?? doc.stock ?? 0);
    totalStockBefore += isNaN(stock) ? 0 : stock;

    const { baseCode, baseName, category } = extractBaseCode(doc);
    const lang = normalizeLang(doc);

    if (!groupsMap.has(baseCode)) {
      groupsMap.set(baseCode, {
        baseCode,
        baseName,
        category,
        editionsMap: new Map<Language, any[]>()
      });
    }

    const group = groupsMap.get(baseCode)!;
    if (!group.editionsMap.has(lang)) {
      group.editionsMap.set(lang, []);
    }
    group.editionsMap.get(lang)!.push(doc);
  });

  const proposedGroups: ProposedGroup[] = [];
  const docsToDelete: string[] = [];
  const docsToUpdate: { id: string; data: any }[] = [];
  let duplicateDocsCount = 0;
  let duplicateGroupsCount = 0;
  let unlinkedPairsUnified = 0;
  let totalStockAfter = 0;
  let totalStockSum = 0;

  // 2. Resolve duplicates within each edition of each title group
  for (const [baseCode, group] of groupsMap.entries()) {
    let groupStockBefore = 0;
    let groupStockAfter = 0;
    let groupStockSum = 0;
    let groupRedundantDocs = 0;
    let groupHasDuplicates = false;
    let groupReason = '';

    const editionsResult: ProposedEdition[] = [];

    // Check if this was an unlinked pair
    const distinctSkuPrefixes = new Set<string>();
    for (const [_, docs] of group.editionsMap.entries()) {
      docs.forEach(d => {
        if (d.sku) distinctSkuPrefixes.add(d.sku);
        groupStockBefore += Number(d.stockLevel ?? d.stock ?? 0);
      });
    }

    const isBilingualPair = group.editionsMap.has('EN') && group.editionsMap.has('ES');

    for (const lang of ['EN', 'ES'] as Language[]) {
      const docsForLang = group.editionsMap.get(lang) || [];
      if (docsForLang.length === 0) continue;

      const canonicalSku = `${baseCode}-${lang}`;
      
      // Calculate Sum across all duplicates
      let sumStock = 0;
      docsForLang.forEach(d => {
        const s = Number(d.stockLevel ?? d.stock ?? 0);
        sumStock += isNaN(s) ? 0 : s;
      });

      // Sort docs by recency (latest timestamp first) to find the most accurate record
      docsForLang.sort((a, b) => {
        const timeA = extractTimestampMs(a);
        const timeB = extractTimestampMs(b);
        if (timeB !== timeA) return timeB - timeA;

        // If timestamps equal, prefer canonical SKU or baseCode
        if (a.sku === canonicalSku && b.sku !== canonicalSku) return -1;
        if (b.sku === canonicalSku && a.sku !== canonicalSku) return 1;
        if (a.baseCode && !b.baseCode) return -1;
        if (!a.baseCode && b.baseCode) return 1;

        return Number(b.stockLevel || 0) - Number(a.stockLevel || 0);
      });

      const latestDoc = docsForLang[0];
      const latestStock = Number(latestDoc.stockLevel ?? latestDoc.stock ?? 0);
      const latestDocDate = formatTimestamp(latestDoc);

      // Determine reconciled stock based on options/strategy:
      let effectiveStock: number;
      let selectedStrat: ProposedEdition['selectedStrategy'] = strategy;

      if (customCounts[canonicalSku] !== undefined) {
        effectiveStock = customCounts[canonicalSku];
        selectedStrat = 'custom';
      } else if (strategy === 'reconcile_latest') {
        effectiveStock = latestStock;
      } else {
        effectiveStock = sumStock;
      }

      groupStockAfter += effectiveStock;
      groupStockSum += sumStock;
      totalStockAfter += effectiveStock;
      totalStockSum += sumStock;

      // Select primary doc to keep in Firestore
      // Prefer one that already has the canonical SKU or baseCode to avoid unnecessary SKU migrations
      const primaryDoc = docsForLang.find(d => d.sku === canonicalSku) || latestDoc;
      const redundantDocs = docsForLang.filter(d => d.id !== primaryDoc.id);

      if (redundantDocs.length > 0) {
        groupHasDuplicates = true;
        duplicateDocsCount += redundantDocs.length;
        groupRedundantDocs += redundantDocs.length;
        redundantDocs.forEach(d => docsToDelete.push(d.id));
      }

      // Check if primary doc needs updating
      const needsUpdate = 
        primaryDoc.sku !== canonicalSku ||
        primaryDoc.baseCode !== baseCode ||
        primaryDoc.baseName !== group.baseName ||
        Number(primaryDoc.stockLevel) !== effectiveStock ||
        primaryDoc.language !== (lang === 'ES' ? 'Spanish' : 'English');

      if (needsUpdate || redundantDocs.length > 0) {
        const catStr = group.category === 'Bible' ? 'Bibles' : group.category === 'Booklet' ? 'Booklets' : 'Tracts';
        const titleName = primaryDoc.title || (lang === 'ES' ? `${group.baseName} (Spanish)` : group.baseName);

        docsToUpdate.push({
          id: primaryDoc.id,
          data: {
            sku: canonicalSku,
            title: titleName,
            category: catStr,
            language: lang === 'ES' ? 'Spanish' : 'English',
            stockLevel: effectiveStock,
            baseCode: baseCode,
            baseName: group.baseName,
            status: effectiveStock === 0 ? 'Out' : effectiveStock < 100 ? 'Low' : 'Healthy',
            updatedAt: serverTimestamp()
          }
        });
      }

      // Cross-reference recent Count Event or Audit Log if available
      let recentEventCount: ProposedEdition['recentEventCount'] = null;
      if (events && events.length > 0) {
        for (const ev of events) {
          const lines = Array.isArray(ev.lines) ? ev.lines : [];
          const matchLine = lines.find((l: any) => l.code === canonicalSku || l.code === primaryDoc.sku || (l.key && l.key.includes(canonicalSku)));
          if (matchLine && matchLine.back !== undefined) {
            recentEventCount = {
              date: ev.date || 'Recent event',
              count: Number(matchLine.before ?? 0) - Number(matchLine.took ?? 0) + Number(matchLine.back ?? 0),
              eventName: ev.name || ev.location || 'Count Event'
            };
            break;
          }
        }
      }

      let recentAuditAdjustment: ProposedEdition['recentAuditAdjustment'] = null;
      if (auditLogs && auditLogs.length > 0) {
        for (const log of auditLogs) {
          if (
            (log.metadata?.sku === canonicalSku || log.targetId === primaryDoc.id || log.targetId === latestDoc.id) &&
            typeof log.metadata?.newStock === 'number'
          ) {
            recentAuditAdjustment = {
              date: log.metadata?.occurredAt || 'Recent log',
              newStock: log.metadata.newStock,
              reason: log.details || 'Stock adjusted'
            };
            break;
          }
        }
      }

      const sourceDocs: SourceDocument[] = docsForLang.map((d) => ({
        id: d.id,
        sku: d.sku || d.id,
        title: d.title || group.baseName,
        language: d.language || (lang === 'ES' ? 'Spanish' : 'English'),
        category: d.category || group.category,
        stockLevel: Number(d.stockLevel ?? d.stock ?? 0),
        baseCode: d.baseCode,
        baseName: d.baseName,
        isRedundant: d.id !== primaryDoc.id,
        timestampMs: extractTimestampMs(d),
        updatedAtFormatted: formatTimestamp(d),
        isLatest: d.id === latestDoc.id
      }));

      const variance = sumStock - latestStock;

      editionsResult.push({
        lang,
        canonicalSku,
        title: primaryDoc.title || group.baseName,
        stockLevel: effectiveStock,
        latestStock,
        sumStock,
        countVariance: variance,
        primaryDocId: primaryDoc.id,
        latestDocId: latestDoc.id,
        latestDocDate,
        mergedDocIds: redundantDocs.map(d => d.id),
        sourceDocs,
        hasDuplicates: redundantDocs.length > 0,
        selectedStrategy: selectedStrat,
        recentEventCount,
        recentAuditAdjustment
      });
    }

    if (groupHasDuplicates) {
      duplicateGroupsCount++;
      const reconcileDiff = groupStockSum - groupStockAfter;
      if (strategy === 'reconcile_latest' && reconcileDiff > 0) {
        groupReason = `Reconciled to latest most accurate count (${groupStockAfter} units). Prevented ${reconcileDiff} duplicate double-counted units.`;
      } else {
        groupReason = `Merged ${groupRedundantDocs} duplicate document(s) & set reconciled stock to ${groupStockAfter} units.`;
      }
    } else if (isBilingualPair && distinctSkuPrefixes.size > 1) {
      groupReason = `Linked EN and ES editions into a single bilingual title family.`;
      unlinkedPairsUnified++;
    } else {
      groupReason = `Standardized title base codes and SKU keys.`;
    }

    const reconcileVariance = groupStockSum - groupStockAfter;

    proposedGroups.push({
      id: baseCode,
      baseCode,
      baseName: group.baseName,
      category: group.category,
      editions: editionsResult,
      totalStockBefore: groupStockBefore,
      totalStockAfter: groupStockAfter,
      totalStockSum: groupStockSum,
      redundantDocCount: groupRedundantDocs,
      reconcileVariance,
      hasCountVariance: reconcileVariance !== 0,
      reason: groupReason
    });
  }

  const totalDocsAfter = totalDocsBefore - docsToDelete.length;
  const hasChanges = docsToDelete.length > 0 || docsToUpdate.length > 0;
  const totalVarianceResolved = Math.max(0, totalStockSum - totalStockAfter);

  return {
    groups: proposedGroups,
    totalDocsBefore,
    totalDocsAfter,
    totalStockBefore,
    totalStockAfter,
    totalStockSum,
    totalVarianceResolved,
    duplicateDocsCount,
    duplicateGroupsCount,
    unlinkedPairsUnified,
    docsToDelete,
    docsToUpdate,
    hasChanges,
    reconciliationStrategy: strategy
  };
}

/**
 * Executes the cleanup and count reconciliation atomically in Firestore.
 */
export async function executeInventoryCleanup(plan: CleanupPlan): Promise<{
  success: boolean;
  mergedCount: number;
  deletedCount: number;
  updatedCount: number;
  reconciledStock: number;
  varianceResolved: number;
}> {
  if (!plan.hasChanges) {
    return { 
      success: true, 
      mergedCount: 0, 
      deletedCount: 0, 
      updatedCount: 0, 
      reconciledStock: plan.totalStockAfter, 
      varianceResolved: 0 
    };
  }

  try {
    // Process in batches of 400 to respect Firestore write limits
    const BATCH_SIZE = 400;
    const ops: Array<{ type: 'update'; id: string; data: any } | { type: 'delete'; id: string }> = [
      ...plan.docsToUpdate.map(u => ({ type: 'update' as const, id: u.id, data: u.data })),
      ...plan.docsToDelete.map(delId => ({ type: 'delete' as const, id: delId }))
    ];

    for (let i = 0; i < ops.length; i += BATCH_SIZE) {
      const chunk = ops.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      for (const op of chunk) {
        const docRef = doc(db, 'inventory', op.id);
        if (op.type === 'update') {
          batch.update(docRef, op.data);
        } else {
          batch.delete(docRef);
        }
      }
      await batch.commit();
    }

    // Log the audit event safely with detailed reconciliation metadata
    try {
      const strategyDesc = plan.reconciliationStrategy === 'reconcile_latest' 
        ? 'updated to latest most accurate counts' 
        : 'consolidated by summing quantities';

      await createAuditLog(
        'STOCK_ADJUSTED',
        'inventory_system',
        'inventory',
        `Executed inventory merge & count reconciliation (${strategyDesc}): ${plan.duplicateDocsCount} duplicate documents removed, ${plan.docsToUpdate.length} records updated. Final reconciled stock: ${plan.totalStockAfter} units (${plan.totalVarianceResolved} duplicate overcount units resolved).`,
        {
          totalDocsBefore: plan.totalDocsBefore,
          totalDocsAfter: plan.totalDocsAfter,
          reconciledStock: plan.totalStockAfter,
          sumStock: plan.totalStockSum,
          varianceResolved: plan.totalVarianceResolved,
          strategy: plan.reconciliationStrategy,
          deletedIds: plan.docsToDelete
        }
      );
    } catch (logErr) {
      console.warn('Audit log write after cleanup encountered non-blocking warning:', logErr);
    }

    return {
      success: true,
      mergedCount: plan.duplicateDocsCount,
      deletedCount: plan.docsToDelete.length,
      updatedCount: plan.docsToUpdate.length,
      reconciledStock: plan.totalStockAfter,
      varianceResolved: plan.totalVarianceResolved
    };
  } catch (error) {
    console.error('Failed to execute inventory cleanup:', error);
    throw error;
  }
}
