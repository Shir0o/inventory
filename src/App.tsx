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
import { extractBaseCode, normalizeLang, normalizeCategory } from './services/inventoryCleanupService';
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

  // Active Count Flow State
  const [isCounting, setIsCounting] = useState(false);
  const [activeCountEvent, setActiveCountEvent] = useState<{ name: string; date: string; id?: string } | null>(null);
  const [selectedEventIdForRecord, setSelectedEventIdForRecord] = useState<string | null>(null);

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
        return {
          code: i.code || i.sku || i.id,
          name: i.name || i.title,
          cat: (catNorm === 'Bible' || catNorm === 'Booklet' || catNorm === 'Tract') ? catNorm : 'Tract',
          reorder: Number(i.reorder) || (settings.reorder[catNorm] || 100),
          pack: Number(i.pack) || (settings.pack[catNorm] || 50),
          aliases: i.aliases || [],
          editions: (i.editions || []).map((ed: any) => ({
            lang: ((ed.lang || 'EN').toUpperCase().includes('ES') ? 'ES' : 'EN') as Language,
            title: ed.title || i.title,
            stock: Number(ed.stock ?? ed.stockLevel ?? 0),
            code: ed.code || `${i.code || i.sku}-${ed.lang}`
          }))
        };
      });
    }

    // Group individual inventory item documents by baseCode / title
    const groups: Record<string, Title> = {};

    rawInventory.forEach(item => {
      const { baseCode, baseName, category } = extractBaseCode(item);
      const lang = normalizeLang(item);
      const cleanCat = category;

      if (!groups[baseCode]) {
        groups[baseCode] = {
          code: baseCode,
          name: baseName,
          cat: cleanCat,
          reorder: Number(item.reorder) || (settings.reorder[cleanCat] || 100),
          pack: Number(item.pack) || (settings.pack[cleanCat] || 50),
          aliases: item.aliases || [],
          editions: []
        };
      }

      const editionTitle = item.title || groups[baseCode].name;
      const stock = Number(item.stockLevel ?? item.stock ?? 0);
      const existingEdIndex = groups[baseCode].editions.findIndex(e => e.lang === lang);

      if (existingEdIndex >= 0) {
        // Consolidate stock from duplicate documents in UI mapping
        groups[baseCode].editions[existingEdIndex].stock += stock;
        if (!groups[baseCode].editions[existingEdIndex].title && editionTitle) {
          groups[baseCode].editions[existingEdIndex].title = editionTitle;
        }
      } else {
        groups[baseCode].editions.push({
          lang,
          title: editionTitle,
          stock,
          code: item.sku || `${baseCode}-${lang}`
        });
      }
    });

    // Ensure balanced EN & ES pairs where appropriate
    return Object.values(groups).map(g => {
      if (g.editions.length === 1 && g.editions[0].lang === 'EN') {
        g.editions.push({
          lang: 'ES',
          title: g.name,
          stock: 0,
          code: `${g.code}-ES`
        });
      } else if (g.editions.length === 1 && g.editions[0].lang === 'ES') {
        g.editions.unshift({
          lang: 'EN',
          title: g.name,
          stock: 0,
          code: `${g.code}-EN`
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
      const distributed = typeof ev.materialsDistributed === 'number' 
        ? ev.materialsDistributed 
        : (typeof ev.totalPassed === 'number' ? ev.totalPassed : 0);

      return {
        id: ev.id,
        date: dateStr,
        location: ev.location || ev.name || 'Outreach Event',
        planned: ev.planned !== undefined ? ev.planned : (ev.status === 'Scheduled' || ev.status === 'Drafting'),
        lines,
        materialsDistributed: distributed,
        totalPassed: distributed,
        corrections: Array.isArray(ev.corrections) ? ev.corrections : []
      };
    });
  }, [rawEvents]);

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
      // Find matching item in Firestore inventory
      const [titleCode, lang] = codeKey.split('-');
      const item = rawInventory.find(i => 
        i.sku === codeKey || 
        i.id === codeKey || 
        (i.baseCode === titleCode && (i.language?.toLowerCase().includes(lang?.toLowerCase()) || i.sku?.endsWith(`-${lang}`)))
      );

      if (item) {
        const prevStock = Number(item.stockLevel || 0);
        const diff = newStock - prevStock;
        await updateInventoryItem(item.id, { stockLevel: newStock }, undefined, note, occurredAt);
        await createAuditLog('STOCK_ADJUSTED', item.id, 'inventory', note || `Stock adjusted from ${prevStock} to ${newStock}`, {
          delta: diff,
          previousStock: prevStock,
          newStock,
          sku: item.sku,
          occurredAt,
          note: note?.trim() || undefined
        });
      } else {
        // Create new item in Firestore if not existing
        const targetTitle = titles.find(t => t.code === titleCode);
        const titleName = targetTitle ? `${targetTitle.name} (${lang})` : codeKey;
        const cat = targetTitle?.cat || 'Tract';
        const docRef = await addInventoryItem({
          sku: codeKey,
          title: titleName,
          category: cat === 'Bible' ? 'Bibles' : cat === 'Booklet' ? 'Booklets' : 'Tracts',
          language: lang === 'ES' ? 'Spanish' : 'English',
          stockLevel: newStock,
          status: newStock === 0 ? 'Out' : newStock < 100 ? 'Low' : 'Healthy',
          unitPrice: 0,
          baseCode: titleCode,
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
      for (const ed of nextTitle.editions) {
        const sku = `${nextTitle.code}-${ed.lang}`;
        const existing = rawInventory.find(i => i.sku === sku || (originalCode && i.baseCode === originalCode && i.sku?.endsWith(`-${ed.lang}`)));
        
        const catStr = nextTitle.cat === 'Bible' ? 'Bibles' : nextTitle.cat === 'Booklet' ? 'Booklets' : 'Tracts';
        const payload = {
          sku,
          title: ed.title || nextTitle.name,
          category: catStr,
          language: ed.lang === 'ES' ? 'Spanish' : 'English',
          stockLevel: ed.stock,
          status: ed.stock === 0 ? 'Out' : ed.stock < nextTitle.reorder ? 'Low' : 'Healthy',
          unitPrice: 0,
          pack: nextTitle.pack,
          reorder: nextTitle.reorder,
          baseCode: nextTitle.code,
          baseName: nextTitle.name,
          aliases: nextTitle.aliases || []
        };

        if (existing) {
          await updateInventoryItem(existing.id, payload);
        } else {
          const docRef = await addInventoryItem(payload);
          if (docRef && ed.stock > 0) {
            await createAuditLog('STARTING_STOCK', docRef.id, 'inventory', `Starting stock of ${ed.stock} units for ${ed.title}`, {
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
    if (eventItem) {
      setActiveCountEvent({
        name: eventItem.location,
        date: eventItem.date,
        id: eventItem.id
      });
    } else {
      const nextPlanned = events.find(e => e.planned);
      if (nextPlanned) {
        setActiveCountEvent({
          name: nextPlanned.location,
          date: nextPlanned.date,
          id: nextPlanned.id
        });
      } else {
        setActiveCountEvent({
          name: 'CISA outreach distribution',
          date: getTodayIso(),
          id: undefined
        });
      }
    }
    setIsCounting(true);
  };

  const handlePostCount = async (lines: EventLine[]) => {
    try {
      let totalPassed = 0;

      // 1. Update shelf stocks in Firestore
      for (const line of lines) {
        const passed = Math.max(0, line.took - line.back);
        totalPassed += passed;

        const item = rawInventory.find(i => i.sku === line.code || i.sku === line.key || i.id === line.key);
        if (item) {
          const currentStock = Number(item.stockLevel || 0);
          const newStock = Math.max(0, currentStock - passed);
          await updateInventoryItem(item.id, { stockLevel: newStock });
        }
      }

      const eventName = activeCountEvent?.name || 'Outreach event';
      const eventDate = activeCountEvent?.date || getTodayIso();
      const eventId = activeCountEvent?.id;

      // 2. Save / update event in Firestore
      if (eventId) {
        const eventRef = doc(db, 'events', eventId);
        await updateDoc(eventRef, {
          planned: false,
          status: 'Completed',
          materialsDistributed: totalPassed,
          lines,
          updatedAt: serverTimestamp()
        });
      } else {
        await addEvent({
          name: eventName,
          location: eventName,
          date: Timestamp.fromDate(new Date(eventDate)),
          planned: false,
          status: 'Completed',
          materialsDistributed: totalPassed,
          lines
        });
      }

      // 3. Log movement in Firestore audit logs
      await createAuditLog('COUNT_POSTED', eventId || 'event', 'event', `Count posted — ${eventName}. ${totalPassed} items passed out.`, {
        delta: -totalPassed,
        linesCount: lines.length
      });
    } catch (err) {
      console.error('Failed to post count to database:', err);
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

        const item = rawInventory.find(i => i.sku === ch.key || i.id === ch.key);
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
        const item = rawInventory.find(i => i.sku === r.code || i.id === r.code);
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
          eventDate={activeCountEvent?.date || getTodayFormatted()}
          onPostCount={handlePostCount}
          onLeave={() => {
            setIsCounting(false);
            setActiveCountEvent(null);
          }}
          onViewRecord={() => {
            setIsCounting(false);
            setActiveCountEvent(null);
            setActiveTab('events');
          }}
          onGoOrderList={() => {
            setIsCounting(false);
            setActiveCountEvent(null);
            setActiveTab('order');
          }}
        />
      )}
    </div>
  );
}

export default App;
