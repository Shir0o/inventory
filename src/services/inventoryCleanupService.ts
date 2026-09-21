import { collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { createAuditLog } from './firestoreService';
import { Category, Language, EventLine } from '../types';

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

// Full Catalog Literature Registry supporting sequential codes (TR-001..TR-013, BKL-001..BKL-004, BIB-001..BIB-002)
// and legacy alphanumeric slugs (TR-THIRD, TR-FOOL, etc.)
export interface CatalogItemDefinition {
  seq: number;
  baseCode: string;
  legacyCodes: string[];
  baseName: string;
  cat: Category;
  enTitle: string;
  esTitle: string;
  aliases: string[];
}

export const CATALOG_REGISTRY: CatalogItemDefinition[] = [
  // Bibles
  {
    seq: 1,
    baseCode: 'BIB-001',
    legacyCodes: [
      'BIB-NTRV',
      'BIBLES',
      'BIB-BIBLE',
      'BIB-ENGLISHB',
      'BIB-SPANISHB',
      'BIBLES_EN',
      'BIBLES_ES',
      'BIB-EN',
      'BIB-ES'
    ],
    baseName: 'Bible',
    cat: 'Bible',
    enTitle: 'English Bible',
    esTitle: 'Spanish Bible',
    aliases: [
      'Bible',
      'Bibles',
      'English Bible',
      'Spanish Bible',
      'English Bibles',
      'Spanish Bibles',
      'Biblia',
      'Biblia en Español',
      'Santa Biblia',
      'Holy Bible',
      'New Testament Recovery Version',
      'Nuevo Testamento Versión Recobro',
      'Recovery Version NT',
      'RcV New Testament',
      'BIB-NTRV',
      'BIBLES',
      'BIBLES_EN',
      'BIBLES_ES'
    ]
  },
  {
    seq: 2,
    baseCode: 'BIB-002',
    legacyCodes: ['BIB-NKJV'],
    baseName: 'NKJV Holy Bible',
    cat: 'Bible',
    enTitle: 'NKJV Holy Bible',
    esTitle: 'Santa Biblia RV1960',
    aliases: ['NKJV', 'RV1960', 'Santa Biblia', 'BIB-NKJV']
  },

  // Booklets
  {
    seq: 1,
    baseCode: 'BKL-001',
    legacyCodes: ['BKL-BE1', 'BKL-BE-1', 'BE1', 'BE-1', 'BOOKLETS', 'BOOKLETS_EN', 'BOOKLETS_ES'],
    baseName: 'Basic Elements of the Christian Life, vol. 1',
    cat: 'Booklet',
    enTitle: 'Basic Elements of the Christian Life, vol. 1',
    esTitle: 'Elementos básicos de la vida cristiana, tomo 1',
    aliases: [
      'BE Vol 1',
      'BE Vol. 1',
      'BE, Vol. 1',
      'Basic Elements 1',
      'Basic Elements Vol 1',
      'Basic Elements Vol. 1',
      'Basic Elements, Vol. 1',
      'Basic Elements of the Christian Life 1',
      'Basic Elements of the Christian Life Vol 1',
      'Basic Elements of the Christian Life Vol. 1',
      'Basic Elements of the Christian Life, Vol. 1',
      'Basic Elements of the Christian Life',
      'Basic Elements',
      'Elementos Básicos 1',
      'Elementos Básicos Tomo 1',
      'Elementos Básicos de la Vida Cristiana Tomo 1',
      'Elementos básicos de la vida cristiana, tomo 1',
      'Elementos Básicos',
      'Elementos basicos',
      'BKL-BE1',
      'BE1',
      'BKL-001',
      'Booklet',
      'Booklets',
      'English Booklet',
      'Spanish Booklet',
      'English Booklets',
      'Spanish Booklets',
      'BOOKLETS',
      'BOOKLETS_EN',
      'BOOKLETS_ES'
    ]
  },
  {
    seq: 2,
    baseCode: 'BKL-002',
    legacyCodes: ['BKL-BE2', 'BKL-BE-2', 'BE2', 'BE-2'],
    baseName: 'Basic Elements of the Christian Life, vol. 2',
    cat: 'Booklet',
    enTitle: 'Basic Elements of the Christian Life, vol. 2',
    esTitle: 'Elementos básicos de la vida cristiana, tomo 2',
    aliases: [
      'BE Vol 2',
      'BE Vol. 2',
      'BE, Vol. 2',
      'Basic Elements 2',
      'Basic Elements Vol 2',
      'Basic Elements Vol. 2',
      'Basic Elements, Vol. 2',
      'Basic Elements of the Christian Life 2',
      'Basic Elements of the Christian Life Vol 2',
      'Basic Elements of the Christian Life Vol. 2',
      'Basic Elements of the Christian Life, Vol. 2',
      'Elementos Básicos 2',
      'Elementos Básicos Tomo 2',
      'Elementos Básicos de la Vida Cristiana Tomo 2',
      'Elementos básicos de la vida cristiana, tomo 2',
      'BKL-BE2',
      'BE2',
      'BKL-002'
    ]
  },
  {
    seq: 3,
    baseCode: 'BKL-003',
    legacyCodes: ['BKL-BE3', 'BKL-BE-3', 'BE3', 'BE-3'],
    baseName: 'Basic Elements of the Christian Life, vol. 3',
    cat: 'Booklet',
    enTitle: 'Basic Elements of the Christian Life, vol. 3',
    esTitle: 'Elementos básicos de la vida cristiana, tomo 3',
    aliases: [
      'BE Vol 3',
      'BE Vol. 3',
      'BE, Vol. 3',
      'Basic Elements 3',
      'Basic Elements Vol 3',
      'Basic Elements Vol. 3',
      'Basic Elements, Vol. 3',
      'Basic Elements of the Christian Life 3',
      'Basic Elements of the Christian Life Vol 3',
      'Basic Elements of the Christian Life Vol. 3',
      'Basic Elements of the Christian Life, Vol. 3',
      'Elementos Básicos 3',
      'Elementos Básicos Tomo 3',
      'Elementos Básicos de la Vida Cristiana Tomo 3',
      'Elementos básicos de la vida cristiana, tomo 3',
      'BKL-BE3',
      'BE3',
      'BKL-003'
    ]
  },
  {
    seq: 4,
    baseCode: 'BKL-004',
    legacyCodes: ['BKL-PROP'],
    baseName: 'Understanding Prophecy',
    cat: 'Booklet',
    enTitle: 'Understanding Prophecy',
    esTitle: 'Entendiendo la Profecía',
    aliases: ['BKL-PROP']
  },

  // Tracts (1-13)
  {
    seq: 1,
    baseCode: 'TR-001',
    legacyCodes: ['TR-FOOL'],
    baseName: 'Foolishness or the Power of God?',
    cat: 'Tract',
    enTitle: 'Foolishness or the Power of God?',
    esTitle: 'La palabra de la cruz: ¿locura o sabiduría?',
    aliases: ['The Word of the Cross', 'TR-FOOL']
  },
  {
    seq: 2,
    baseCode: 'TR-002',
    legacyCodes: ['TR-FEAR'],
    baseName: 'Freed from the Fear of Death',
    cat: 'Tract',
    enTitle: 'Freed from the Fear of Death',
    esTitle: 'Librados del temor de la muerte',
    aliases: ['Fear of Death', 'TR-FEAR']
  },
  {
    seq: 3,
    baseCode: 'TR-003',
    legacyCodes: ['TR-EXIST'],
    baseName: 'How Can I Know God Exists?',
    cat: 'Tract',
    enTitle: 'How Can I Know God Exists?',
    esTitle: '¿Cómo saber que Dios existe?',
    aliases: ['God Exists', 'TR-EXIST']
  },
  {
    seq: 4,
    baseCode: 'TR-004',
    legacyCodes: ['TR-BOAT'],
    baseName: 'Is Jesus in Your Boat?',
    cat: 'Tract',
    enTitle: 'Is Jesus in Your Boat?',
    esTitle: '¿Está Jesús en su barca?',
    aliases: ['Jesus in Your Boat', 'TR-BOAT']
  },
  {
    seq: 5,
    baseCode: 'TR-005',
    legacyCodes: ['TR-LOST'],
    baseName: 'Lost and Found',
    cat: 'Tract',
    enTitle: 'Lost and Found',
    esTitle: 'Perdido y hallado',
    aliases: ['Lost & Found', 'TR-LOST']
  },
  {
    seq: 6,
    baseCode: 'TR-006',
    legacyCodes: ['TR-ENEM'],
    baseName: 'No Longer Enemies',
    cat: 'Tract',
    enTitle: 'No Longer Enemies',
    esTitle: 'Ya no somos enemigos',
    aliases: ['TR-ENEM']
  },
  {
    seq: 7,
    baseCode: 'TR-007',
    legacyCodes: ['TR-HEAL'],
    baseName: 'Only Jesus Can Heal Us',
    cat: 'Tract',
    enTitle: 'Only Jesus Can Heal Us',
    esTitle: 'El toque que sana',
    aliases: ['Healing Touch', 'Healing Jesus', 'TR-HEAL']
  },
  {
    seq: 8,
    baseCode: 'TR-008',
    legacyCodes: ['TR-BIGQ'],
    baseName: 'The Big Question',
    cat: 'Tract',
    enTitle: 'The Big Question',
    esTitle: 'La pregunta crucial',
    aliases: ['The Ultimate Question', 'TR-BIGQ']
  },
  {
    seq: 9,
    baseCode: 'TR-009',
    legacyCodes: ['TR-THIRD'],
    baseName: 'The Third Part',
    cat: 'Tract',
    enTitle: 'The Third Part',
    esTitle: 'La tercera parte',
    aliases: ['Human Spirit - The Third Part', 'The Third Part (Human Spirit)', 'TR-THIRD']
  },
  {
    seq: 10,
    baseCode: 'TR-010',
    legacyCodes: ['TR-WHO'],
    baseName: 'Who Is Jesus?',
    cat: 'Tract',
    enTitle: 'Who Is Jesus?',
    esTitle: '¿Quién es Jesús?',
    aliases: ['TR-WHO']
  },
  {
    seq: 11,
    baseCode: 'TR-011',
    legacyCodes: ['TR-KNOW'],
    baseName: 'You Can Know God',
    cat: 'Tract',
    enTitle: 'You Can Know God',
    esTitle: 'Al Dios no conocido',
    aliases: ['To the Unknown God', 'TR-KNOW']
  },
  {
    seq: 12,
    baseCode: 'TR-012',
    legacyCodes: ['TR-BORN'],
    baseName: 'You Must Be Born Anew',
    cat: 'Tract',
    enTitle: 'You Must Be Born Anew',
    esTitle: 'Os es necesario nacer de nuevo',
    aliases: ['Born Again', 'Born Anew', 'TR-BORN']
  },
  {
    seq: 13,
    baseCode: 'TR-013',
    legacyCodes: ['TR-STC'],
    baseName: 'Steps to Christ',
    cat: 'Tract',
    enTitle: 'Steps to Christ',
    esTitle: 'El Camino a Cristo',
    aliases: ['TR-STC']
  }
];

/**
 * Checks if a string looks like a raw SKU / code rather than a human-readable title
 * (e.g. TR-009-001-EN, TR-009, BIB-001-001-EN, TR-THIRD, TR 009, etc.)
 */
export function isCodeLikeTitle(text: string | null | undefined): boolean {
  if (!text || typeof text !== 'string') return true;
  const t = text.trim();
  if (!t) return true;
  if (/^(TR|BIB|BKL|GEN)[-_ ][A-Z0-9]+([-_ ][A-Z0-9]+)*$/i.test(t)) return true;
  if (/^(TR|BIB|BKL|GEN)-\d+/i.test(t)) return true;
  if (/^[A-Z0-9_-]{4,25}$/i.test(t) && !t.includes(' ')) return true;
  return false;
}

/**
 * Matches an item or text against the Catalog Registry by title, SKU, baseCode, or legacy code
 */
export function findCatalogItem(params: {
  title?: string;
  sku?: string;
  baseCode?: string;
  id?: string;
}): CatalogItemDefinition | null {
  const titleNorm = String(params.title || '').trim().toLowerCase();
  const skuNorm = String(params.sku || '').trim().toUpperCase();
  const baseCodeNorm = String(params.baseCode || '').trim().toUpperCase();
  const idNorm = String(params.id || '').trim().toUpperCase();

  // 1. Direct SKU/Code exact or prefix match (e.g. TR-009-001-EN -> TR-009)
  for (const item of CATALOG_REGISTRY) {
    const codesToTest = [
      item.baseCode,
      ...item.legacyCodes,
      `${item.baseCode}-001-EN`,
      `${item.baseCode}-002-ES`,
      `${item.baseCode}-EN`,
      `${item.baseCode}-ES`
    ];
    const titleUpper = titleNorm.toUpperCase();
    if (
      (baseCodeNorm && (item.baseCode === baseCodeNorm || item.legacyCodes.includes(baseCodeNorm))) ||
      (skuNorm && (codesToTest.includes(skuNorm) || skuNorm.startsWith(`${item.baseCode}-`) || item.legacyCodes.some(l => skuNorm.startsWith(`${l}-`)))) ||
      (titleUpper && (codesToTest.includes(titleUpper) || titleUpper.startsWith(`${item.baseCode}-`) || item.legacyCodes.some(l => titleUpper.startsWith(`${l}-`)))) ||
      (idNorm && (codesToTest.includes(idNorm) || idNorm.startsWith(`${item.baseCode}-`)))
    ) {
      return item;
    }
  }

  // 2. Title match (English, Spanish, or Aliases)
  if (titleNorm) {
    // Strip trailing language tags for clean matching against registry titles
    const cleanTitle = titleNorm
      .replace(/\s*\((english|spanish|en|es)\)/gi, '')
      .replace(/\s*-\s*(english|spanish|en|es)$/gi, '')
      .trim();

    for (const item of CATALOG_REGISTRY) {
      const en = item.enTitle.toLowerCase();
      const es = item.esTitle.toLowerCase();
      if (
        titleNorm === en ||
        titleNorm === es ||
        cleanTitle === en ||
        cleanTitle === es ||
        titleNorm.includes(en) ||
        titleNorm.includes(es) ||
        en.includes(titleNorm) ||
        es.includes(titleNorm) ||
        (cleanTitle && (en.includes(cleanTitle) || es.includes(cleanTitle) || cleanTitle.includes(en) || cleanTitle.includes(es))) ||
        item.aliases.some(a => {
          const aLower = a.toLowerCase();
          return titleNorm === aLower ||
            cleanTitle === aLower ||
            titleNorm.includes(aLower) ||
            cleanTitle.includes(aLower) ||
            aLower.includes(titleNorm) ||
            (cleanTitle && aLower.includes(cleanTitle));
        })
      ) {
        return item;
      }
      // Check if title itself is a code (e.g. TR-009-001-EN)
      if (
        titleNorm === item.baseCode.toLowerCase() ||
        titleNorm.startsWith(`${item.baseCode.toLowerCase()}-`) ||
        item.legacyCodes.some(l => titleNorm === l.toLowerCase() || titleNorm.startsWith(`${l.toLowerCase()}-`))
      ) {
        return item;
      }
    }
  }

  return null;
}

/**
 * Resolves a human-readable title, strictly avoiding raw code display (e.g. TR-009-001-EN).
 */
export function resolveHumanTitle(
  rawTitle: string | undefined | null,
  lang: Language = 'EN',
  baseNameFallback?: string,
  baseCodeFallback?: string
): string {
  const trimmed = rawTitle ? rawTitle.trim() : '';

  // 1. Clean and normalize any divided or redundant Bible / Basic Elements / Booklets titles
  if (trimmed) {
    // Bible patterns
    if (/english bible\s*\(\s*(spanish|es)\s*\)/i.test(trimmed)) {
      return lang === 'ES' ? 'Spanish Bible' : 'English Bible';
    }
    if (/spanish bible\s*\(\s*(english|en)\s*\)/i.test(trimmed)) {
      return lang === 'EN' ? 'English Bible' : 'Spanish Bible';
    }
    if (/spanish bible\s*\(\s*(spanish|es)\s*\)/i.test(trimmed)) {
      return 'Spanish Bible';
    }
    if (/english bible\s*\(\s*(english|en)\s*\)/i.test(trimmed)) {
      return 'English Bible';
    }
    if (/^english bibles?$/i.test(trimmed) && lang === 'ES') {
      return 'Spanish Bible';
    }
    if (/^spanish bibles?$/i.test(trimmed) && lang === 'EN') {
      return 'English Bible';
    }
    if (/^biblia( en espa[ñn]ol)?$/i.test(trimmed) && lang === 'EN') {
      return 'English Bible';
    }
    if (/^bibles?$/i.test(trimmed)) {
      return lang === 'ES' ? 'Spanish Bible' : 'English Bible';
    }

    // Basic Elements patterns (unified English and Spanish editions without redundant language tags)
    const isBasicElements = /basic elements|elementos b[áa]sicos|bkl-be|be\s*vol|be\s*[123]/i.test(trimmed) ||
      (baseCodeFallback && (baseCodeFallback.startsWith('BKL-00') || baseCodeFallback.startsWith('BKL-BE')));
    if (isBasicElements) {
      const lower = trimmed.toLowerCase();
      const codeUpper = (baseCodeFallback || '').toUpperCase();
      const isVol3 = lower.includes('3') || codeUpper.includes('003') || codeUpper.includes('BE3');
      if (isVol3) {
        return lang === 'ES' ? 'Elementos básicos de la vida cristiana, tomo 3' : 'Basic Elements of the Christian Life, vol. 3';
      }
      const isVol2 = lower.includes('2') || codeUpper.includes('002') || codeUpper.includes('BE2');
      if (isVol2) {
        return lang === 'ES' ? 'Elementos básicos de la vida cristiana, tomo 2' : 'Basic Elements of the Christian Life, vol. 2';
      }
      // Vol 1 or general Basic Elements
      return lang === 'ES' ? 'Elementos básicos de la vida cristiana, tomo 1' : 'Basic Elements of the Christian Life, vol. 1';
    }

    // Generic Booklets patterns
    if (/^english booklets?(\s*\((spanish|es)\))?$/i.test(trimmed)) {
      return lang === 'ES' ? 'Spanish Booklet' : 'English Booklet';
    }
    if (/^spanish booklets?(\s*\((english|en)\))?$/i.test(trimmed)) {
      return lang === 'EN' ? 'English Booklet' : 'Spanish Booklet';
    }
  }

  // 2. Look up catalog definition by clean title (stripping language tags), sku, or baseCode
  const cleanTitle = trimmed
    .replace(/\s*\((english|spanish|en|es)\)$/i, '')
    .replace(/\s*-\s*(english|spanish|en|es)$/i, '')
    .trim();

  const catalog = findCatalogItem({
    title: cleanTitle || trimmed || undefined,
    baseCode: baseCodeFallback,
    sku: cleanTitle || trimmed || undefined
  }) || (baseNameFallback ? findCatalogItem({ title: baseNameFallback, baseCode: baseCodeFallback }) : null)
     || (baseCodeFallback ? findCatalogItem({ baseCode: baseCodeFallback }) : null);

  if (catalog) {
    return lang === 'ES' ? catalog.esTitle : catalog.enTitle;
  }

  // 3. If rawTitle is already human-readable, not code-like, and didn't have redundant language marker, use it
  if (trimmed && !isCodeLikeTitle(trimmed) && trimmed === cleanTitle) {
    return trimmed;
  }

  // 4. If baseNameFallback exists and is Bible or general title
  if (baseNameFallback) {
    const isBible = baseNameFallback.toLowerCase().includes('bible') || 
      baseNameFallback.toLowerCase().includes('biblia') || 
      (baseCodeFallback && (baseCodeFallback.startsWith('BIB') || baseCodeFallback.includes('BIBLE')));
    if (isBible) {
      return lang === 'ES' ? 'Spanish Bible' : 'English Bible';
    }

    const isBasicElem = baseNameFallback.toLowerCase().includes('basic element') ||
      baseNameFallback.toLowerCase().includes('elementos b') ||
      (baseCodeFallback && (baseCodeFallback.startsWith('BKL-00') || baseCodeFallback.startsWith('BKL-BE')));
    if (isBasicElem) {
      if (baseNameFallback.includes('3') || (baseCodeFallback && baseCodeFallback.includes('3'))) {
        return lang === 'ES' ? 'Elementos básicos de la vida cristiana, tomo 3' : 'Basic Elements of the Christian Life, vol. 3';
      }
      if (baseNameFallback.includes('2') || (baseCodeFallback && baseCodeFallback.includes('2'))) {
        return lang === 'ES' ? 'Elementos básicos de la vida cristiana, tomo 2' : 'Basic Elements of the Christian Life, vol. 2';
      }
      return lang === 'ES' ? 'Elementos básicos de la vida cristiana, tomo 1' : 'Basic Elements of the Christian Life, vol. 1';
    }

    if (!isCodeLikeTitle(baseNameFallback)) {
      const clean = baseNameFallback
        .replace(/\s*\((English|Spanish|EN|ES)\)/i, '')
        .replace(/\b(English|Spanish)\b/i, '')
        .trim();
      return lang === 'ES' ? `${clean} (Spanish)` : clean;
    }
  }

  // 5. Fallbacks
  if (baseCodeFallback) {
    if (baseCodeFallback.startsWith('BIB') || baseCodeFallback.includes('BIBLE')) {
      return lang === 'ES' ? 'Spanish Bible' : 'English Bible';
    }
    if (baseCodeFallback.startsWith('BKL-001') || baseCodeFallback === 'BKL-BE1') {
      return lang === 'ES' ? 'Elementos básicos de la vida cristiana, tomo 1' : 'Basic Elements of the Christian Life, vol. 1';
    }
    if (baseCodeFallback.startsWith('BKL-002') || baseCodeFallback === 'BKL-BE2') {
      return lang === 'ES' ? 'Elementos básicos de la vida cristiana, tomo 2' : 'Basic Elements of the Christian Life, vol. 2';
    }
    if (baseCodeFallback.startsWith('BKL-003') || baseCodeFallback === 'BKL-BE3') {
      return lang === 'ES' ? 'Elementos básicos de la vida cristiana, tomo 3' : 'Basic Elements of the Christian Life, vol. 3';
    }
    return `Literature Item ${baseCodeFallback}`;
  }

  return 'Literature Item';
}

export function normalizeLang(item: any): Language {
  const langRaw = String(item.language || '').toLowerCase().trim();
  const skuRaw = String(item.sku || '').toUpperCase();
  const titleRaw = String(item.title || '').toLowerCase();

  if (
    langRaw.includes('es') || 
    langRaw.includes('span') || 
    skuRaw.endsWith('-ES') || 
    skuRaw.includes('-ES-') || 
    skuRaw.includes('-002-') ||
    skuRaw.endsWith('-002') ||
    skuRaw.includes('_ES') ||
    titleRaw.includes('(spanish)') ||
    titleRaw.includes('(es)') ||
    titleRaw.includes('spanish bible') ||
    titleRaw.includes('spanish bibles') ||
    titleRaw.includes('spanish booklet') ||
    titleRaw.includes('spanish booklets') ||
    titleRaw.includes('biblia') ||
    titleRaw.includes('recobro') ||
    titleRaw.includes('elementos') ||
    titleRaw.includes('básicos') ||
    titleRaw.includes('basicos') ||
    titleRaw.includes('tomo')
  ) {
    return 'ES';
  }
  return 'EN';
}

export function normalizeCategory(catRaw: any): Category {
  const c = String(catRaw || 'Tract').trim().toLowerCase();
  if (c.includes('bib')) return 'Bible';
  if (c.includes('book') || c.includes('element') || c.includes('folleto')) return 'Booklet';
  return 'Tract';
}

export function extractBaseCode(item: any): { baseCode: string; baseName: string; category: Category } {
  const cat = normalizeCategory(item.category || item.cat);
  const titleNorm = String(item.title || '').trim();
  const skuNorm = String(item.sku || item.id || '').trim().toUpperCase();
  const baseCodeCand = String(item.baseCode || '').trim().toUpperCase();

  // 1. Check full catalog registry
  const matched = findCatalogItem({
    title: titleNorm,
    sku: skuNorm,
    baseCode: baseCodeCand,
    id: String(item.id || '')
  });
  if (matched) {
    return {
      baseCode: matched.baseCode,
      baseName: matched.baseName,
      category: matched.cat
    };
  }

  // 2. Unify Bibles: English and Spanish Bibles are combined under the single Bible entry
  const isBible = cat === 'Bible' || 
    titleNorm.toLowerCase().includes('bible') || 
    titleNorm.toLowerCase().includes('biblia') || 
    skuNorm.startsWith('BIB') || 
    skuNorm.includes('BIBLE') ||
    baseCodeCand.startsWith('BIB') ||
    baseCodeCand.includes('BIBLE');

  if (isBible) {
    const isNkjv = titleNorm.toLowerCase().includes('nkjv') || 
      skuNorm.includes('NKJV') || 
      titleNorm.toLowerCase().includes('rv1960') ||
      baseCodeCand.includes('NKJV');
    if (isNkjv) {
      return { baseCode: 'BIB-002', baseName: 'NKJV Holy Bible', category: 'Bible' };
    }
    return { baseCode: 'BIB-001', baseName: 'Bible', category: 'Bible' };
  }

  // 3. Unify Basic Elements / Booklets: Combine English and Spanish editions under single volume entries
  const isBasicElements = cat === 'Booklet' ||
    titleNorm.toLowerCase().includes('basic element') ||
    titleNorm.toLowerCase().includes('elementos b') ||
    titleNorm.toLowerCase().includes('elementos de la vida') ||
    skuNorm.startsWith('BKL') ||
    skuNorm.includes('BOOKLET') ||
    skuNorm.includes('BE1') ||
    skuNorm.includes('BE2') ||
    skuNorm.includes('BE3') ||
    baseCodeCand.startsWith('BKL') ||
    baseCodeCand.includes('BOOKLET');

  if (isBasicElements) {
    const lower = titleNorm.toLowerCase();
    const isVol3 = lower.includes('vol. 3') || lower.includes('vol 3') || lower.includes('volume 3') ||
      lower.includes('tomo 3') || lower.includes('be 3') || lower.includes('be3') || lower.includes('be-3') ||
      skuNorm.includes('BKL-003') || skuNorm.includes('BE3') || baseCodeCand.includes('003') || baseCodeCand.includes('BE3');
    if (isVol3) {
      return { baseCode: 'BKL-003', baseName: 'Basic Elements of the Christian Life, vol. 3', category: 'Booklet' };
    }

    const isVol2 = lower.includes('vol. 2') || lower.includes('vol 2') || lower.includes('volume 2') ||
      lower.includes('tomo 2') || lower.includes('be 2') || lower.includes('be2') || lower.includes('be-2') ||
      skuNorm.includes('BKL-002') || skuNorm.includes('BE2') || baseCodeCand.includes('002') || baseCodeCand.includes('BE2');
    if (isVol2) {
      return { baseCode: 'BKL-002', baseName: 'Basic Elements of the Christian Life, vol. 2', category: 'Booklet' };
    }

    // Check if Understanding Prophecy
    const isProphecy = lower.includes('prophecy') || lower.includes('profec') || skuNorm.includes('PROP') || baseCodeCand.includes('004');
    if (isProphecy) {
      return { baseCode: 'BKL-004', baseName: 'Understanding Prophecy', category: 'Booklet' };
    }

    // Default to Vol 1 / General Basic Elements
    return { baseCode: 'BKL-001', baseName: 'Basic Elements of the Christian Life, vol. 1', category: 'Booklet' };
  }

  // 3. If item already has an explicit baseCode
  if (item.baseCode && String(item.baseCode).trim()) {
    const cleanBaseCode = String(item.baseCode).trim().toUpperCase();
    const cleanBaseName = item.baseName || (!isCodeLikeTitle(item.title) ? item.title?.replace(/\s*\((English|Spanish|EN|ES)\)/i, '').trim() : '') || cleanBaseCode;
    return { baseCode: cleanBaseCode, baseName: cleanBaseName, category: cat };
  }

  // 4. Derive from SKU: strip -(001|002)-(EN|ES), -(001|002), -(EN|ES), etc.
  if (skuNorm) {
    let derived = skuNorm
      .replace(/-(001|002)?-(EN|ES)$/i, '')
      .replace(/-(001|002)$/i, '')
      .replace(/-(EN|ES)$/i, '')
      .replace(/-(EN|ES)-/i, '-')
      .replace(/_(EN|ES)$/i, '')
      .replace(/_(EN|ES)_/i, '_');
    
    if (derived && derived !== skuNorm) {
      const candidateName = item.baseName || (!isCodeLikeTitle(item.title) ? item.title?.replace(/\s*\((English|Spanish|EN|ES)\)/i, '').trim() : '') || derived;
      return { baseCode: derived, baseName: candidateName, category: cat };
    }
  }

  // 5. Derive from title slug
  const titleSlug = (item.title && !isCodeLikeTitle(item.title) ? item.title : 'ITEM')
    .toUpperCase()
    .replace(/\s*\((ENGLISH|SPANISH|EN|ES)\)/i, '')
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
  
  const catStr = String(cat);
  const prefix = catStr === 'Bible' ? 'BIB' : catStr === 'Booklet' ? 'BKL' : 'TR';
  const fallbackCode = `${prefix}-${titleSlug || 'ITEM'}`;
  const baseName = item.baseName || (!isCodeLikeTitle(item.title) ? item.title : fallbackCode);
  
  return { baseCode: fallbackCode, baseName, category: cat };
}

/**
 * Programmatically generates the next available base Code for a title based on its category
 * and existing titles/items (e.g. TR-014, BIB-003, BKL-005).
 * The user does NOT have to come up with codes manually.
 */
export function generateProgrammaticCode(
  category: Category | string,
  existingList: Array<{ code?: string; sku?: string; [key: string]: any }> = []
): string {
  const normCat = (category || 'Tract').toString().toLowerCase();
  const prefix = normCat.includes('bible') ? 'BIB' : normCat.includes('booklet') ? 'BKL' : 'TR';
  
  const regex = new RegExp(`^${prefix}-(\\d+)`, 'i');
  let maxNum = 0;

  // Check Catalog Registry items for baseline maximum sequence
  CATALOG_REGISTRY.forEach(c => {
    if (c.baseCode.startsWith(prefix)) {
      const match = c.baseCode.match(regex);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    }
  });

  // Check existing titles/items in the database/workspace
  existingList.forEach(item => {
    const codeStr = item.code || item.sku || item.baseCode || '';
    const match = codeStr.match(regex);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  });

  const nextNum = maxNum + 1;
  const padded = String(nextNum).padStart(3, '0');
  return `${prefix}-${padded}`;
}

/**
 * Programmatically generates a full edition SKU in the standard format:
 * [Category]-[Sequence]-[ItemNumber]-[Language] (e.g. TR-009-001-EN, TR-009-002-ES)
 * where 001 is English and 002 is Spanish.
 */
export function generateEditionSku(
  baseCode: string,
  language: string = 'EN'
): string {
  const langUpper = (language || 'EN').toUpperCase().slice(0, 2);
  const itemNum = langUpper === 'ES' ? '002' : '001';

  // Strip any existing edition suffix or language code to obtain the pure base code (e.g. TR-009)
  const cleanBase = baseCode
    .replace(/-(001|002)?-(EN|ES)$/i, '')
    .replace(/-(001|002)$/i, '')
    .replace(/-(EN|ES)$/i, '');

  return `${cleanBase}-${itemNum}-${langUpper}`;
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

      const canonicalSku = generateEditionSku(baseCode, lang);
      
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

      const titleName = resolveHumanTitle(primaryDoc.title, lang, group.baseName, baseCode);

      // Check if primary doc needs updating
      const needsUpdate = 
        primaryDoc.sku !== canonicalSku ||
        primaryDoc.baseCode !== baseCode ||
        primaryDoc.baseName !== group.baseName ||
        isCodeLikeTitle(primaryDoc.title) ||
        Number(primaryDoc.stockLevel) !== effectiveStock ||
        primaryDoc.language !== (lang === 'ES' ? 'Spanish' : 'English');

      if (needsUpdate || redundantDocs.length > 0) {
        const catStr = group.category === 'Bible' ? 'Bibles' : group.category === 'Booklet' ? 'Booklets' : 'Tracts';

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
        title: resolveHumanTitle(d.title, lang, group.baseName, baseCode),
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
        title: titleName,
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

export interface CodeMigrationItemPlan {
  id: string;
  currentSku: string;
  targetSku: string;
  currentTitle: string;
  targetTitle: string;
  currentBaseCode?: string;
  targetBaseCode: string;
  targetBaseName: string;
  category: string;
  language: string;
  needsUpdate: boolean;
  reason: string;
}

export interface CodeMigrationPlan {
  totalDocs: number;
  itemsToUpdate: CodeMigrationItemPlan[];
  itemsUnchanged: CodeMigrationItemPlan[];
  hasChanges: boolean;
}

/**
 * Analyzes existing inventory documents to identify items that need programmatic item code
 * formatting ([Category]-[Sequence]-[ItemNumber]-[Language]) or title cleanup
 * (e.g. replacing raw codes like TR-009-001-EN with "The Third Part").
 */
export function analyzeExistingInventoryCodes(rawInventory: any[]): CodeMigrationPlan {
  const itemsToUpdate: CodeMigrationItemPlan[] = [];
  const itemsUnchanged: CodeMigrationItemPlan[] = [];

  rawInventory.forEach(doc => {
    const lang = normalizeLang(doc);
    const cat = normalizeCategory(doc.category || doc.cat);
    const { baseCode, baseName } = extractBaseCode(doc);
    const targetSku = generateEditionSku(baseCode, lang);
    const targetTitle = resolveHumanTitle(doc.title, lang, baseName, baseCode);
    const targetBaseCode = baseCode;
    const targetBaseName = baseName;

    const currentSku = String(doc.sku || '').trim();
    const currentTitle = String(doc.title || '').trim();
    const currentBaseCode = String(doc.baseCode || '').trim();
    const currentBaseName = String(doc.baseName || '').trim();

    const skuChanged = currentSku !== targetSku;
    const titleChanged = currentTitle !== targetTitle;
    const baseCodeChanged = currentBaseCode !== targetBaseCode;
    const baseNameChanged = currentBaseName !== targetBaseName;

    const needsUpdate = skuChanged || titleChanged || baseCodeChanged || baseNameChanged;
    const reasons: string[] = [];
    if (titleChanged) {
      reasons.push(isCodeLikeTitle(currentTitle) ? `Fixed code title (${currentTitle} → ${targetTitle})` : `Updated title to canonical name`);
    }
    if (skuChanged) {
      reasons.push(`Standardized SKU (${currentSku || 'none'} → ${targetSku})`);
    }
    if (baseCodeChanged) {
      reasons.push(`Assigned base code (${targetBaseCode})`);
    }

    const itemPlan: CodeMigrationItemPlan = {
      id: doc.id,
      currentSku,
      targetSku,
      currentTitle,
      targetTitle,
      currentBaseCode,
      targetBaseCode,
      targetBaseName,
      category: cat === 'Bible' ? 'Bibles' : cat === 'Booklet' ? 'Booklets' : 'Tracts',
      language: lang === 'ES' ? 'Spanish' : 'English',
      needsUpdate,
      reason: reasons.join(' • ') || 'Already standardized'
    };

    if (needsUpdate) {
      itemsToUpdate.push(itemPlan);
    } else {
      itemsUnchanged.push(itemPlan);
    }
  });

  return {
    totalDocs: rawInventory.length,
    itemsToUpdate,
    itemsUnchanged,
    hasChanges: itemsToUpdate.length > 0
  };
}

/**
 * Executes migration of existing inventory items to standard programmatic code and title formatting in Firestore
 */
export async function executeInventoryCodeMigration(plan: CodeMigrationPlan): Promise<{
  success: boolean;
  updatedCount: number;
}> {
  if (!plan.hasChanges || plan.itemsToUpdate.length === 0) {
    return { success: true, updatedCount: 0 };
  }

  const BATCH_SIZE = 400;
  for (let i = 0; i < plan.itemsToUpdate.length; i += BATCH_SIZE) {
    const chunk = plan.itemsToUpdate.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    for (const item of chunk) {
      const docRef = doc(db, 'inventory', item.id);
      batch.update(docRef, {
        sku: item.targetSku,
        title: item.targetTitle,
        baseCode: item.targetBaseCode,
        baseName: item.targetBaseName,
        category: item.category,
        language: item.language,
        updatedAt: serverTimestamp()
      });
    }
    await batch.commit();
  }

  try {
    await createAuditLog(
      'STOCK_UPDATE',
      'inventory_system',
      'inventory',
      `Migrated ${plan.itemsToUpdate.length} existing inventory records to programmatic item code format [Category]-[Seq]-[ItemNumber]-[Lang] and resolved human titles (e.g. TR-009-001-EN → The Third Part).`,
      {
        migratedCount: plan.itemsToUpdate.length,
        items: plan.itemsToUpdate.map(i => ({ id: i.id, oldSku: i.currentSku, newSku: i.targetSku, newTitle: i.targetTitle }))
      }
    );
  } catch (err) {
    console.warn('Audit log write after code migration encountered non-blocking warning:', err);
  }

  return {
    success: true,
    updatedCount: plan.itemsToUpdate.length
  };
}

/**
 * Resolves a raw inventory item document across varying SKU formats, base codes,
 * language suffixes, programmatic codes (e.g. BIB-001-002-ES vs BIB-001-ES),
 * legacy codes (e.g. BIB-NTRV-ES, BKL-BE1-ES), and titles.
 */
export function findMatchingInventoryItem(
  items: any[],
  codeOrKey: string,
  langHint?: string,
  titleHint?: string
): any | undefined {
  if (!items || items.length === 0 || !codeOrKey) return undefined;

  const targetKey = String(codeOrKey).trim();
  const targetKeyUpper = targetKey.toUpperCase();

  // 1. Direct match on id or exact sku (case-insensitive)
  const directMatch = items.find(i => 
    i.id === targetKey || 
    (i.sku && i.sku.toUpperCase() === targetKeyUpper)
  );
  if (directMatch) return directMatch;

  // 2. Detect language:
  let detectedLang: 'EN' | 'ES' | undefined = langHint ? (langHint.toUpperCase().includes('ES') ? 'ES' : 'EN') : undefined;
  if (!detectedLang) {
    if (
      targetKeyUpper.endsWith('-ES') || 
      targetKeyUpper.endsWith('_ES') || 
      targetKeyUpper.includes('-002-') || 
      targetKeyUpper.includes('_002_') ||
      targetKeyUpper.includes('-SPANISH')
    ) {
      detectedLang = 'ES';
    } else if (
      targetKeyUpper.endsWith('-EN') || 
      targetKeyUpper.endsWith('_EN') || 
      targetKeyUpper.includes('-001-') || 
      targetKeyUpper.includes('_001_') ||
      targetKeyUpper.includes('-ENGLISH')
    ) {
      detectedLang = 'EN';
    }
  }

  // 3. Extract clean base code:
  const cleanBase = targetKeyUpper
    .replace(/-(001|002)?-(EN|ES)$/i, '')
    .replace(/-(EN|ES)$/i, '')
    .replace(/-(001|002)$/i, '')
    .replace(/_(EN|ES)$/i, '')
    .trim();

  // 4. Match using extractBaseCode & normalizeLang:
  const baseAndLangMatch = items.find(i => {
    const { baseCode } = extractBaseCode(i);
    const iLang = normalizeLang(i);
    const itemCleanBase = (baseCode || i.baseCode || i.sku || '')
      .toUpperCase()
      .replace(/-(001|002)?-(EN|ES)$/i, '')
      .replace(/-(EN|ES)$/i, '')
      .replace(/-(001|002)$/i, '')
      .replace(/_(EN|ES)$/i, '')
      .trim();

    const matchesBase = itemCleanBase === cleanBase || 
      (i.sku && i.sku.toUpperCase().includes(cleanBase)) ||
      (i.baseCode && i.baseCode.toUpperCase() === cleanBase);

    if (matchesBase) {
      if (detectedLang) return iLang === detectedLang;
      return true;
    }
    return false;
  });
  if (baseAndLangMatch) return baseAndLangMatch;

  // 5. Match using CATALOG_REGISTRY legacyCodes and aliases
  const registryEntry = CATALOG_REGISTRY.find(reg => 
    reg.baseCode.toUpperCase() === cleanBase ||
    reg.legacyCodes.some(lc => lc.toUpperCase() === cleanBase) ||
    reg.aliases.some(al => al.toUpperCase() === cleanBase)
  );

  if (registryEntry) {
    const allKnownCodes = [registryEntry.baseCode, ...registryEntry.legacyCodes].map(c => c.toUpperCase());
    const regMatch = items.find(i => {
      const { baseCode } = extractBaseCode(i);
      const iLang = normalizeLang(i);
      const itemClean = (baseCode || i.baseCode || i.sku || '')
        .toUpperCase()
        .replace(/-(001|002)?-(EN|ES)$/i, '')
        .replace(/-(EN|ES)$/i, '')
        .replace(/-(001|002)$/i, '')
        .replace(/_(EN|ES)$/i, '')
        .trim();

      const codeMatches = allKnownCodes.includes(itemClean) || allKnownCodes.some(c => (i.sku || '').toUpperCase().includes(c));
      if (codeMatches) {
        if (detectedLang) return iLang === detectedLang;
        return true;
      }
      return false;
    });
    if (regMatch) return regMatch;
  }

  // 6. Match by title if titleHint is present
  if (titleHint) {
    const hintLower = titleHint.trim().toLowerCase();
    const titleMatch = items.find(i => {
      const iTitle = (i.title || i.name || '').trim().toLowerCase();
      const iLang = normalizeLang(i);
      if (iTitle === hintLower || (hintLower.length > 5 && iTitle.includes(hintLower))) {
        if (detectedLang) return iLang === detectedLang;
        return true;
      }
      return false;
    });
    if (titleMatch) return titleMatch;
  }

  return undefined;
}

/**
 * Accurately determines category ('Bible' | 'Booklet' | 'Tract') and language ('EN' | 'ES')
 * for an event line or order item, ensuring Spanish Bibles and Spanish Booklets
 * (Basic Elements) are never erroneously misclassified as tracts.
 */
export function resolveItemCategoryAndLang(
  code: string,
  title?: string,
  langHint?: string,
  item?: any
): { category: Category; lang: Language } {
  const codeUpper = (code || item?.sku || '').toUpperCase();
  const titleLower = (title || item?.title || item?.name || '').toLowerCase();
  
  // 1. Language determination
  let lang: Language = (langHint?.toUpperCase().includes('ES') || codeUpper.endsWith('-ES') || codeUpper.includes('-002-') || codeUpper.includes('_ES')) ? 'ES' : 'EN';
  if (item) {
    lang = normalizeLang(item);
  } else if (titleLower.includes('español') || titleLower.includes('versión recobro') || titleLower.includes('elementos básicos') || titleLower.includes('tomo')) {
    lang = 'ES';
  }

  // 2. Category determination
  let category: Category | null = null;
  if (item?.category) {
    const rawCat = (item.category || '').toLowerCase();
    if (rawCat.includes('bible')) category = 'Bible';
    else if (rawCat.includes('booklet')) category = 'Booklet';
    else if (rawCat.includes('tract')) category = 'Tract';
  }

  if (!category) {
    if (
      codeUpper.startsWith('BIB') ||
      titleLower.includes('bible') ||
      titleLower.includes('biblia') ||
      titleLower.includes('recobro') ||
      titleLower.includes('recovery version') ||
      titleLower.includes('testament') ||
      titleLower.includes('testamento')
    ) {
      category = 'Bible';
    } else if (
      codeUpper.startsWith('BKL') ||
      titleLower.includes('booklet') ||
      titleLower.includes('basic elements') ||
      titleLower.includes('elementos básicos') ||
      titleLower.includes('tomo')
    ) {
      category = 'Booklet';
    } else {
      category = 'Tract';
    }
  }

  return { category, lang };
}

/**
 * Accurately computes the category statistics breakdown from a list of event lines,
 * guaranteeing that Spanish Bibles (Versión Recobro) and Spanish Basic Elements (vol 1-3)
 * properly increment Bible and Booklet counts instead of being misassigned to Tracts.
 */
export function calculateCategoryStatsFromLines(
  lines: EventLine[],
  inventoryItems?: any[]
) {
  const stats = {
    bibles: 0,
    bibles_en: 0,
    bibles_es: 0,
    tracts: 0,
    tracts_en: 0,
    tracts_es: 0,
    booklets: 0,
    booklets_en: 0,
    booklets_es: 0,
    total: 0
  };

  if (!lines || lines.length === 0) return stats;

  for (const line of lines) {
    const passed = Math.max(0, line.took - line.back);
    if (passed <= 0) continue;
    stats.total += passed;

    const item = inventoryItems ? findMatchingInventoryItem(inventoryItems, line.code, line.lang, line.title) : undefined;
    const { category, lang } = resolveItemCategoryAndLang(line.code, line.title, line.lang, item);

    if (category === 'Bible') {
      stats.bibles += passed;
      if (lang === 'ES') stats.bibles_es += passed;
      else stats.bibles_en += passed;
    } else if (category === 'Booklet') {
      stats.booklets += passed;
      if (lang === 'ES') stats.booklets_es += passed;
      else stats.booklets_en += passed;
    } else {
      stats.tracts += passed;
      if (lang === 'ES') stats.tracts_es += passed;
      else stats.tracts_en += passed;
    }
  }

  return stats;
}
