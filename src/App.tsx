import React, { useState, useMemo } from 'react';
import { 
  Title, 
  EventItem, 
  Movement, 
  OrderItem, 
  SettingsData, 
  ActiveTab, 
  EventLine,
  Category,
  Language,
  Edition
} from './types';
import { useFirebase } from './context/FirebaseContext';
import { 
  updateInventoryItem, 
  addInventoryItem, 
  addEvent, 
  updateSettings as saveSystemSettings,
  addOrderItem,
  updateOrderItem,
  deleteOrderItem,
  createAuditLog
} from './services/firestoreService';
import { 
  extractBaseCode, 
  normalizeLang, 
  normalizeCategory, 
  generateProgrammaticCode, 
  generateEditionSku, 
  resolveHumanTitle,
  isCodeLikeTitle,
  findMatchingInventoryItem,
  calculateCategoryStatsFromLines
} from './services/inventoryCleanupService';
import { doc, updateDoc, Timestamp, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Sidebar } from './components/Sidebar';
import { TopNav } from './components/TopNav';
import { OverviewView } from './components/OverviewView';
import { InventoryView } from './components/InventoryView';
import { EventsView } from './components/EventsView';
import { OrderListView } from './components/OrderListView';
import { HistoryView } from './components/HistoryView';
import { SettingsView } from './components/SettingsView';
import { CountEventFlow } from './components/CountEventFlow';
import { humanizeAuditLog } from './lib/humanizeHistory';
import { AlertTriangle, Database, RefreshCw, ShieldAlert, PlusCircle } from 'lucide-react';

export function App() {
  const { 
    user, 
    inventory: rawInventory, 
    events: rawEvents, 
    orders: rawOrders, 
    auditLogs: rawLogs, 
    settings: rawSettings,
    login, 
    logout, 
    isAdmin, 
    isAuthorized,
    loading 
  } = useFirebase();

  // Navigation State
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Active Count Flow State - loads saved count session if one was in progress
  const [isCounting, setIsCounting] = useState<boolean>(() => {
    try {
      return localStorage.getItem('lit_ledger_is_counting') === 'true';
    } catch {
      return false;
    }
  });
  const [activeCountEvent, setActiveCountEvent] = useState<{ name: string; date: string; id?: string } | null>(() => {
    try {
      const saved = localStorage.getItem('lit_ledger_active_count_event');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [selectedEventIdForRecord, setSelectedEventIdForRecord] = useState<string | null>(null);

  // Check whether an in-progress count draft exists in localStorage
  const hasActiveCountDraft = useMemo(() => {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('lit_ledger_count_draft_')) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.itemsData && Object.values(parsed.itemsData).some((v: any) => v.took > 0)) {
              return true;
            }
          }
        }
      }
    } catch {}
    return false;
  }, [isCounting]);

  // Map real Firestore settings
  const settings: SettingsData = useMemo(() => {
    const defaultReorder = { Bible: 20, Booklet: 60, Tract: 200 };
    const defaultPack = { Bible: 20, Booklet: 50, Tract: 100 };
    return {
      hallName: rawSettings?.hallName || rawSettings?.orgName || 'CISA Inventory',
      reorder: rawSettings?.reorder || defaultReorder,
      pack: rawSettings?.pack || defaultPack,
      people: rawSettings?.people || [
        { id: 'p1', name: user?.displayName || 'Yilong Wang', email: user?.email || 'YilongWang05@gmail.com', role: 'Admin', self: true }
      ]
    };
  }, [rawSettings, user]);

  // Map real Firestore inventory into structured Titles with EN/ES Editions
  const titles: Title[] = useMemo(() => {
    if (!rawInventory || rawInventory.length === 0) {
      return [];
    }

    // Check if items are already full title documents with an `editions` array
    const hasCompositeEditions = rawInventory.some(i => Array.isArray(i.editions) && i.editions.length > 0);
    if (hasCompositeEditions) {
      return rawInventory.map(i => {
        const catNorm = (i.cat || i.category || 'Tract').replace(/s$/, '') as Category;
        const { baseCode, baseName } = extractBaseCode(i);
        const resolvedName = resolveHumanTitle(i.name || i.title, 'EN', baseName, baseCode);
        return {
          code: baseCode || i.code || i.sku || i.id,
          name: resolvedName,
          cat: (catNorm === 'Bible' || catNorm === 'Booklet' || catNorm === 'Tract') ? catNorm : 'Tract',
          reorder: Number(i.reorder) || (settings.reorder[catNorm] || 100),
          pack: Number(i.pack) || (settings.pack[catNorm] || 50),
          aliases: i.aliases || [],
          editions: (i.editions || []).map((ed: any) => {
            const edLang = ((ed.lang || 'EN').toUpperCase().includes('ES') ? 'ES' : 'EN') as Language;
            const edTitle = resolveHumanTitle(ed.title || i.title, edLang, resolvedName, baseCode);
            const edCode = generateEditionSku(baseCode || i.code || i.sku, edLang);
            return {
              lang: edLang,
              title: edTitle,
              stock: Number(ed.stock ?? ed.stockLevel ?? 0),
              code: edCode
            };
          })
        };
      });
    }

    // Group individual inventory item documents by baseCode / title
    const groups: Record<string, Title> = {};

    rawInventory.forEach(item => {
      const { baseCode, baseName, category } = extractBaseCode(item);
      const lang = normalizeLang(item);
      const cleanCat = category;
      const resolvedBaseName = (cleanCat === 'Bible' && (baseName.toLowerCase().includes('bible') || baseName.toLowerCase().includes('biblia')))
        ? 'Bible'
        : resolveHumanTitle(baseName, 'EN', baseName, baseCode);

      if (!groups[baseCode]) {
        groups[baseCode] = {
          code: baseCode,
          name: resolvedBaseName,
          cat: cleanCat,
          reorder: Number(item.reorder) || (settings.reorder[cleanCat] || 100),
          pack: Number(item.pack) || (settings.pack[cleanCat] || 50),
          aliases: Array.isArray(item.aliases) ? [...item.aliases] : (item.alias ? [item.alias] : []),
          editions: []
        };
      } else if (item.aliases && Array.isArray(item.aliases)) {
        const mergedAliases = Array.from(new Set([...(groups[baseCode].aliases || []), ...item.aliases]));
        groups[baseCode].aliases = mergedAliases;
      }

      const editionTitle = resolveHumanTitle(item.title, lang, resolvedBaseName, baseCode);
      const editionCode = generateEditionSku(item.sku || baseCode, lang);
      const stock = Number(item.stockLevel ?? item.stock ?? 0);
      const existingEdIndex = groups[baseCode].editions.findIndex(e => e.lang === lang);

      if (existingEdIndex >= 0) {
        // Consolidate stock from duplicate documents in UI mapping
        groups[baseCode].editions[existingEdIndex].stock += stock;
        const currentTitle = groups[baseCode].editions[existingEdIndex].title || '';
        const isBadTitle = !currentTitle || 
          isCodeLikeTitle(currentTitle) || 
          currentTitle.toLowerCase().includes('(spanish)') || 
          currentTitle.toLowerCase().includes('(english)');
        if (isBadTitle && editionTitle && !editionTitle.toLowerCase().includes('(spanish)') && !editionTitle.toLowerCase().includes('(english)')) {
          groups[baseCode].editions[existingEdIndex].title = editionTitle;
        }
      } else {
        groups[baseCode].editions.push({
          lang,
          title: editionTitle,
          stock,
          code: editionCode
        });
      }
    });

    // Ensure balanced EN & ES pairs where appropriate
    return Object.values(groups).map(g => {
      if (g.editions.length === 1 && g.editions[0].lang === 'EN') {
        g.editions.push({
          lang: 'ES',
          title: resolveHumanTitle('', 'ES', g.name, g.code),
          stock: 0,
          code: generateEditionSku(g.code, 'ES')
        });
      } else if (g.editions.length === 1 && g.editions[0].lang === 'ES') {
        g.editions.unshift({
          lang: 'EN',
          title: resolveHumanTitle('', 'EN', g.name, g.code),
          stock: 0,
          code: generateEditionSku(g.code, 'EN')
        });
      }
      g.editions.sort((a, b) => (a.lang === 'EN' ? -1 : 1));
      return g;
    });
  }, [rawInventory, settings]);

  // Map real Firestore events
  const events: EventItem[] = useMemo(() => {
    if (!rawEvents || rawEvents.length === 0) return [];
    return rawEvents.map(ev => {
      let dateStr = '';
      if (ev.date && typeof ev.date.toDate === 'function') {
        dateStr = ev.date.toDate().toISOString().slice(0, 10);
      } else if (ev.date && ev.date.seconds) {
        dateStr = new Date(ev.date.seconds * 1000).toISOString().slice(0, 10);
      } else if (typeof ev.date === 'string') {
        dateStr = ev.date.slice(0, 10);
      } else {
        dateStr = new Date().toISOString().slice(0, 10);
      }

      const lines = Array.isArray(ev.lines) ? ev.lines : [];
      const computedStats = calculateCategoryStatsFromLines(lines, rawInventory);
      const distributed = typeof ev.materialsDistributed === 'number' 
        ? ev.materialsDistributed 
        : (typeof ev.totalPassed === 'number' ? ev.totalPassed : computedStats.total);

      const isCompleted = ev.status === 'Completed' || ev.planned === false;
      const isPlanned = !isCompleted && (ev.planned === true || ev.status === 'Scheduled' || ev.status === 'Drafting');

      // Use stored categoryStats if valid and detailed, or fallback to accurately computed stats from lines
      const categoryStats = (ev.categoryStats && (ev.categoryStats.bibles > 0 || ev.categoryStats.booklets > 0 || lines.length === 0))
        ? ev.categoryStats
        : (lines.length > 0 ? computedStats : ev.categoryStats);

      return {
        id: ev.id,
        date: dateStr,
        location: ev.location || ev.name || 'Outreach Event',
        planned: isPlanned,
        lines,
        materialsDistributed: distributed,
        totalPassed: distributed,
        corrections: Array.isArray(ev.corrections) ? ev.corrections : [],
        categoryStats
      };
    });
  }, [rawEvents, rawInventory]);

  // Map real Firestore orders
  const orders: OrderItem[] = useMemo(() => {
    if (!rawOrders || rawOrders.length === 0) return [];
    return rawOrders.map(o => ({
      key: o.key || o.id || `${o.code}-${o.lang || 'EN'}`,
      bundle: o.bundle,
      lang: o.lang,
      title: o.title,
      code: o.code,
      qty: Number(o.qty) || 0,
      packs: o.packs ? Number(o.packs) : undefined,
      orderedDate: o.orderedDate || new Date().toISOString().slice(0, 10),
      shortOf: o.shortOf,
      received: o.received
    }));
  }, [rawOrders]);

  // Map real Firestore audit logs to Movements ledger
  const movements: Movement[] = useMemo(() => {
    if (!rawLogs || rawLogs.length === 0) return [];

    const humanizeOptions = {
      inventoryItems: rawInventory || [],
      events: rawEvents || [],
      orders: rawOrders || []
    };

    return rawLogs.map(log => {
      let dateStr = '';
      let isoStr = '';
      const effectiveDate = log.metadata?.occurredAt;
      if (effectiveDate && typeof effectiveDate === 'string' && effectiveDate.length >= 10) {
        isoStr = effectiveDate.slice(0, 10);
        try {
          const [y, m, d] = isoStr.split('-').map(Number);
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          dateStr = (d && m) ? `${d} ${months[m - 1]}` : isoStr;
        } catch {
          dateStr = isoStr;
        }
      } else if (log.timestamp && typeof log.timestamp.toDate === 'function') {
        const d = log.timestamp.toDate();
        isoStr = d.toISOString().slice(0, 10);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        dateStr = `${d.getDate()} ${months[d.getMonth()]}`;
      } else {
        const d = new Date();
        isoStr = d.toISOString().slice(0, 10);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        dateStr = `${d.getDate()} ${months[d.getMonth()]}`;
      }

      const humanized = humanizeAuditLog(log, humanizeOptions);

      return {
        id: log.id,
        iso: isoStr,
        date: dateStr,
        kind: humanized.kind,
        what: humanized.what,
        detail: humanized.detail,
        delta: humanized.delta
      };
    });
  }, [rawLogs, rawInventory, rawEvents, rawOrders]);

  // Helper date formatter
  const getTodayFormatted = () => {
    const d = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()} ${months[d.getMonth()]}`;
  };

  const getTodayIso = () => new Date().toISOString().slice(0, 10);

  // Calculate flagged items count for Sidebar badge
  const flaggedOrderCount = useMemo(() => {
    return titles.reduce((acc, t) => {
      const threshold = settings.reorder[t.cat] || t.reorder;
      const lowEds = t.editions.filter(ed => ed.stock < threshold);
      return acc + lowEds.length;
    }, 0);
  }, [titles, settings]);

  // Handlers for Stock Adjustments - writes directly to Firestore
  const handleAdjustStock = async (codeKey: string, newStock: number, note: string, date?: string) => {
    try {
      const occurredAt = date || getTodayIso();
      // Derive language and baseCode reliably from 4-segment SKU (e.g. TR-009-001-EN) or legacy (TR-009-EN)
      const isSpanish = codeKey.endsWith('-ES') || codeKey.includes('-002-');
      const lang = isSpanish ? 'ES' : 'EN';
      const cleanBaseCode = codeKey
        .replace(/-(001|002)-(EN|ES)$/i, '')
        .replace(/-(EN|ES)$/i, '')
        .trim();

      const item = findMatchingInventoryItem(rawInventory, codeKey);

      if (item) {
        const prevStock = Number(item.stockLevel || 0);
        const diff = newStock - prevStock;
        await updateInventoryItem(item.id, { stockLevel: newStock }, undefined, note, occurredAt);
        await createAuditLog('STOCK_ADJUSTED', item.id, 'inventory', note || `Stock adjusted from ${prevStock} to ${newStock}`, {
          delta: diff,
          previousStock: prevStock,
          newStock,
          sku: item.sku || codeKey,
          occurredAt,
          note: note?.trim() || undefined
        });
      } else {
        // Create new item in Firestore if not existing
        const targetTitle = titles.find(t => t.code === cleanBaseCode);
        const titleName = targetTitle 
          ? (lang === 'ES' 
              ? (targetTitle.editions.find(e => e.lang === 'ES')?.title || resolveHumanTitle('', 'ES', targetTitle.name, cleanBaseCode))
              : (targetTitle.editions.find(e => e.lang === 'EN')?.title || targetTitle.name))
          : resolveHumanTitle(codeKey, lang, undefined, cleanBaseCode);
        const cat = targetTitle?.cat || 'Tract';
        const docRef = await addInventoryItem({
          sku: codeKey,
          title: titleName,
          category: cat === 'Bible' ? 'Bibles' : cat === 'Booklet' ? 'Booklets' : 'Tracts',
          language: lang === 'ES' ? 'Spanish' : 'English',
          stockLevel: newStock,
          status: newStock === 0 ? 'Out' : newStock < 100 ? 'Low' : 'Healthy',
          unitPrice: 0,
          baseCode: cleanBaseCode,
          baseName: targetTitle?.name || titleName
        });
        if (docRef) {
          await createAuditLog('STOCK_ADJUSTED', docRef.id, 'inventory', `Initial stock set to ${newStock}`, {
            delta: newStock,
            newStock,
            sku: codeKey,
            occurredAt,
            note: note?.trim() || undefined
          });
        }
      }
    } catch (err) {
      console.error('Failed to adjust stock in database:', err);
    }
  };

  // Handlers for Saving Titles (Add / Edit) - writes directly to Firestore
  const handleSaveTitle = async (originalCode: string | null, nextTitle: Title) => {
    try {
      let codeToUse = nextTitle.code?.trim();
      if (!codeToUse || codeToUse.endsWith('-') || codeToUse === 'TR' || codeToUse === 'BIB' || codeToUse === 'BKL') {
        codeToUse = generateProgrammaticCode(nextTitle.cat, titles);
      }
      for (const ed of nextTitle.editions) {
        const sku = generateEditionSku(codeToUse, ed.lang);
        const humanTitle = resolveHumanTitle(ed.title || nextTitle.name, ed.lang, nextTitle.name, codeToUse);
        const existing = rawInventory.find(i => 
          i.sku === sku || 
          i.sku === `${codeToUse}-${ed.lang}` || 
          (originalCode && (i.baseCode === originalCode || i.sku?.startsWith(`${originalCode}-`)) && normalizeLang(i) === ed.lang)
        );
        
        const catStr = nextTitle.cat === 'Bible' ? 'Bibles' : nextTitle.cat === 'Booklet' ? 'Booklets' : 'Tracts';
        const payload = {
          sku,
          title: humanTitle,
          category: catStr,
          language: ed.lang === 'ES' ? 'Spanish' : 'English',
          stockLevel: ed.stock,
          status: ed.stock === 0 ? 'Out' : ed.stock < nextTitle.reorder ? 'Low' : 'Healthy',
          unitPrice: 0,
          pack: nextTitle.pack,
          reorder: nextTitle.reorder,
          baseCode: codeToUse,
          baseName: nextTitle.name,
          aliases: nextTitle.aliases || []
        };

        if (existing) {
          await updateInventoryItem(existing.id, payload);
        } else {
          const docRef = await addInventoryItem(payload);
          if (docRef && ed.stock > 0) {
            await createAuditLog('STARTING_STOCK', docRef.id, 'inventory', `Starting stock of ${ed.stock} units for ${humanTitle}`, {
              delta: ed.stock,
              sku
            });
          }
        }
      }
    } catch (err) {
      console.error('Failed to save title in database:', err);
    }
  };

  // Handlers for Count Flow - updates Firestore stock atomically & logs event
  const handleStartCount = (eventItem?: EventItem) => {
    let nextEvent: { name: string; date: string; id?: string };
    if (eventItem) {
      nextEvent = {
        name: eventItem.location,
        date: eventItem.date,
        id: eventItem.id
      };
    } else {
      // If we already have an activeCountEvent saved from a draft, prioritize restoring it
      const savedEventRaw = localStorage.getItem('lit_ledger_active_count_event');
      let restoredFromSaved = false;
      if (savedEventRaw) {
        try {
          const parsed = JSON.parse(savedEventRaw);
          if (parsed && parsed.name) {
            nextEvent = parsed;
            restoredFromSaved = true;
          }
        } catch {}
      }

      if (!restoredFromSaved) {
        const nextPlanned = events.find(e => e.planned);
        if (nextPlanned) {
          nextEvent = {
            name: nextPlanned.location,
            date: nextPlanned.date,
            id: nextPlanned.id
          };
        } else {
          nextEvent = {
            name: 'CISA outreach distribution',
            date: getTodayIso(),
            id: undefined
          };
        }
      }
    }
    setActiveCountEvent(nextEvent!);
    setIsCounting(true);
    try {
      localStorage.setItem('lit_ledger_is_counting', 'true');
      localStorage.setItem('lit_ledger_active_count_event', JSON.stringify(nextEvent!));
    } catch {}
  };

  const handlePostCount = async (lines: EventLine[]) => {
    try {
      let totalPassed = 0;

      // 1. Update shelf stocks in Firestore
      for (const line of lines) {
        const passed = Math.max(0, line.took - line.back);
        totalPassed += passed;

        const item = findMatchingInventoryItem(rawInventory, line.code, line.lang, line.title);
        if (item) {
          const currentStock = Number(item.stockLevel || 0);
          const newStock = Math.max(0, currentStock - passed);
          await updateInventoryItem(item.id, { stockLevel: newStock });
        }
      }

      const eventName = activeCountEvent?.name || 'Outreach event';
      const eventDate = activeCountEvent?.date || getTodayIso();
      const eventId = activeCountEvent?.id;

      // Safely parse date
      let eventDateTimestamp: Timestamp;
      try {
        const parsed = new Date(eventDate);
        if (isNaN(parsed.getTime())) {
          eventDateTimestamp = Timestamp.fromDate(new Date());
        } else {
          eventDateTimestamp = Timestamp.fromDate(parsed);
        }
      } catch {
        eventDateTimestamp = Timestamp.fromDate(new Date());
      }

      // Calculate category breakdown accurately
      const categoryStats = calculateCategoryStatsFromLines(lines, rawInventory);
      if (totalPassed > 0 && categoryStats.total === 0) {
        categoryStats.total = totalPassed;
      }

      // 2. Save / update event in Firestore
      let savedEventId = eventId;
      if (eventId) {
        const eventRef = doc(db, 'events', eventId);
        await updateDoc(eventRef, {
          planned: false,
          status: 'Completed',
          materialsDistributed: totalPassed,
          lines,
          categoryStats,
          updatedAt: serverTimestamp()
        });
      } else {
        const docRef = await addEvent({
          name: eventName,
          location: eventName,
          date: eventDateTimestamp,
          planned: false,
          status: 'Completed',
          materialsDistributed: totalPassed,
          lines,
          categoryStats
        });
        if (docRef?.id) {
          savedEventId = docRef.id;
        }
      }

      // 3. Log movement in Firestore audit logs
      await createAuditLog('COUNT_POSTED', savedEventId || 'event', 'event', `Count posted — ${eventName}. ${totalPassed} items passed out.`, {
        delta: -totalPassed,
        linesCount: lines.length,
        materialsDistributed: totalPassed
      });

      if (savedEventId) {
        setSelectedEventIdForRecord(savedEventId);
      }

      // 4. Clean up active count session storage
      try {
        localStorage.removeItem('lit_ledger_is_counting');
        localStorage.removeItem('lit_ledger_active_count_event');
      } catch {}
    } catch (err) {
      console.error('Failed to post count to database:', err);
      throw err;
    }
  };

  const handleCompleteEvent = async (eventId: string) => {
    try {
      const eventRef = doc(db, 'events', eventId);
      await updateDoc(eventRef, {
        planned: false,
        status: 'Completed',
        updatedAt: serverTimestamp()
      });
      await createAuditLog('EVENT_UPDATED', eventId, 'event', `Completed event`);
    } catch (err) {
      console.error('Failed to complete event:', err);
    }
  };

  // Handlers for Additive Corrections
  const handlePostCorrection = async (
    eventId: string,
    note: string,
    changes: { key: string; from: number; to: number }[]
  ) => {
    try {
      let netDelta = 0;

      // Update lines and corrections in Firestore event
      const targetEvent = events.find(e => e.id === eventId);
      if (targetEvent) {
        const updatedLines = targetEvent.lines.map(l => {
          const ch = changes.find(c => c.key === l.key);
          return ch ? { ...l, back: ch.to } : l;
        });

        const newCorrection = {
          id: `c-${Date.now()}`,
          when: getTodayFormatted(),
          by: user?.displayName || 'Admin',
          note,
          changes
        };

        const eventRef = doc(db, 'events', eventId);
        await updateDoc(eventRef, {
          lines: updatedLines,
          corrections: [...(targetEvent.corrections || []), newCorrection],
          updatedAt: serverTimestamp()
        });
      }

      // Adjust shelf stocks in Firestore
      for (const ch of changes) {
        const delta = ch.to - ch.from;
        netDelta += delta;

        const item = findMatchingInventoryItem(rawInventory, ch.key);
        if (item) {
          const currentStock = Number(item.stockLevel || 0);
          const newStock = Math.max(0, currentStock + delta);
          await updateInventoryItem(item.id, { stockLevel: newStock });
        }
      }

      await createAuditLog('CORRECTION_FILED', eventId, 'event', `Correction filed: ${note}`, {
        delta: netDelta,
        changes
      });
    } catch (err) {
      console.error('Failed to post correction to database:', err);
    }
  };

  // Handlers for Ordering & Receiving Deliveries - writes directly to Firestore
  const handleMarkOrdered = async (
    toOrder: { code: string; title: string; lang?: string; qty: number; packs?: number; bundle?: string }[]
  ) => {
    try {
      for (const item of toOrder) {
        const key = item.bundle ? `BND-${item.bundle}` : item.code;
        await addOrderItem({
          key,
          bundle: item.bundle || '',
          title: item.title,
          code: item.code,
          lang: item.lang || 'EN',
          qty: item.qty,
          packs: item.packs || 1,
          orderedDate: getTodayFormatted(),
          status: 'ordered'
        });
      }
      setActiveTab('order');
    } catch (err) {
      console.error('Failed to mark orders in database:', err);
    }
  };

  const handleReceiveDelivery = async (
    receipts: { code: string; title: string; lang: 'EN' | 'ES'; qty: number }[],
    remainingOrders: OrderItem[]
  ) => {
    try {
      let totalReceived = 0;

      // Increment stocks in Firestore
      for (const r of receipts) {
        totalReceived += r.qty;
        const item = findMatchingInventoryItem(rawInventory, r.code, r.lang, r.title);
        if (item) {
          const currentStock = Number(item.stockLevel || 0);
          await updateInventoryItem(item.id, { stockLevel: currentStock + r.qty });
        }
      }

      // Update remaining orders in Firestore
      for (const r of receipts) {
        const orderDoc = rawOrders.find(o => o.code === r.code || o.key === r.code);
        if (orderDoc) {
          const remaining = remainingOrders.find(o => o.code === r.code || o.key === orderDoc.key);
          if (!remaining) {
            await deleteOrderItem(orderDoc.id);
          } else {
            await updateOrderItem(orderDoc.id, { qty: remaining.qty });
          }
        }
      }

      await createAuditLog('DELIVERY_RECEIVED', 'delivery', 'inventory', `Delivery check-in: ${totalReceived} units received into inventory`, {
        delta: totalReceived,
        receiptsCount: receipts.length
      });
    } catch (err) {
      console.error('Failed to receive delivery in database:', err);
    }
  };

  const handleCancelOrder = async (orderKey: string) => {
    try {
      const orderDoc = rawOrders.find(o => o.key === orderKey || o.id === orderKey);
      if (orderDoc) {
        await deleteOrderItem(orderDoc.id);
      }
    } catch (err) {
      console.error('Failed to cancel order in database:', err);
    }
  };

  const handleSaveSettings = async (nextSettings: SettingsData) => {
    try {
      await saveSystemSettings({
        hallName: nextSettings.hallName,
        reorder: nextSettings.reorder,
        pack: nextSettings.pack,
        people: nextSettings.people
      });
    } catch (err) {
      console.error('Failed to save settings in database:', err);
    }
  };

  const handleAddAllToOrderList = () => {
    setActiveTab('order');
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-[#191c20] font-sans antialiased">
      {/* Navigation Rail */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setSelectedEventIdForRecord(null);
        }}
        hallName={settings.hallName}
        flaggedOrderCount={flaggedOrderCount}
        onStartCount={() => handleStartCount()}
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        user={user}
        onLogin={login}
        onLogout={logout}
        isAdmin={isAdmin}
        hasActiveCountDraft={hasActiveCountDraft}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64 min-h-0 bg-white">
        {/* Mobile Top Navigation */}
        <TopNav
          onOpenMobileNav={() => setMobileNavOpen(true)}
          hallName={settings.hallName}
          user={user}
          onLogin={login}
          onLogout={logout}
        />

        {/* Database Authorization & Connection State Banner */}
        {!isAuthorized && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-3 text-[12.5px] text-amber-800">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 flex-none" />
              <span>
                You are signed in as <strong>{user?.email}</strong>, awaiting administrator authorization to access live inventory records.
              </span>
            </div>
          </div>
        )}

        {/* Empty Database Helper Banner */}
        {isAuthorized && !loading && titles.length === 0 && (
          <div className="bg-[#f6f7f9] border-b border-[#dcdee3] px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[13px]">
            <div className="flex items-center gap-2 text-[#44474e]">
              <Database className="w-4 h-4 text-[#1f5f8b]" />
              <span>
                Connected to live database. Ready for inventory records.
              </span>
            </div>
            <button
              onClick={() => setActiveTab('inventory')}
              className="px-3 py-1 bg-[#1f5f8b] hover:bg-[#17496c] text-white text-[12px] font-semibold rounded flex items-center gap-1.5 cursor-pointer shadow-xs self-start sm:self-auto"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Add First Inventory Item</span>
            </button>
          </div>
        )}

        {/* View Switcher */}
        {activeTab === 'overview' && (
          <OverviewView
            titles={titles}
            events={events}
            movements={movements}
            orders={orders}
            onNavigate={(tab) => {
              setActiveTab(tab);
              setSelectedEventIdForRecord(null);
            }}
            onStartCount={() => handleStartCount()}
            onAddAllToOrderList={handleAddAllToOrderList}
            hasActiveCountDraft={hasActiveCountDraft}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryView
            titles={titles}
            rawInventory={rawInventory}
            onAdjustStock={handleAdjustStock}
            onSaveTitle={handleSaveTitle}
          />
        )}

        {activeTab === 'events' && (
          <EventsView
            events={events}
            onStartCountForEvent={(ev) => handleStartCount(ev)}
            onSavePlannedEvent={async (date, location) => {
              try {
                await addEvent({
                  name: location,
                  location,
                  date: Timestamp.fromDate(new Date(date)),
                  planned: true,
                  status: 'Scheduled',
                  materialsDistributed: 0,
                  lines: []
                });
              } catch (err) {
                console.error('Failed to create planned event:', err);
              }
            }}
            onPostCorrection={handlePostCorrection}
            onCompleteEvent={handleCompleteEvent}
            selectedEventId={selectedEventIdForRecord}
            onClearSelectedEvent={() => setSelectedEventIdForRecord(null)}
          />
        )}

        {activeTab === 'order' && (
          <OrderListView
            titles={titles}
            orders={orders}
            onMarkOrdered={handleMarkOrdered}
            onReceiveDelivery={handleReceiveDelivery}
            onCancelOrder={handleCancelOrder}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView
            movements={movements}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            titles={titles}
            rawInventory={rawInventory}
            settings={settings}
            onSaveSettings={handleSaveSettings}
          />
        )}
      </div>

      {/* Count Event Full Screen Takeover Flow */}
      {isCounting && (
        <CountEventFlow
          titles={titles}
          eventName={activeCountEvent?.name || 'CISA outreach distribution'}
          eventDate={activeCountEvent?.date || getTodayIso()}
          eventId={activeCountEvent?.id}
          onPostCount={handlePostCount}
          onLeave={() => {
            setIsCounting(false);
            try {
              localStorage.setItem('lit_ledger_is_counting', 'false');
            } catch {}
          }}
          onViewRecord={() => {
            setIsCounting(false);
            setActiveCountEvent(null);
            try {
              localStorage.setItem('lit_ledger_is_counting', 'false');
              localStorage.removeItem('lit_ledger_active_count_event');
            } catch {}
            setActiveTab('events');
          }}
          onGoOrderList={() => {
            setIsCounting(false);
            setActiveCountEvent(null);
            try {
              localStorage.setItem('lit_ledger_is_counting', 'false');
              localStorage.removeItem('lit_ledger_active_count_event');
            } catch {}
            setActiveTab('order');
          }}
        />
      )}
    </div>
  );
}

export default App;
