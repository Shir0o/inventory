import React, { useState, useEffect } from 'react';
import { 
  Title, 
  EventItem, 
  Movement, 
  OrderItem, 
  SettingsData, 
  ActiveTab, 
  EventLine,
  Category
} from './types';
import { 
  INITIAL_TITLES, 
  INITIAL_EVENTS, 
  INITIAL_MOVEMENTS, 
  INITIAL_ORDERS, 
  INITIAL_SETTINGS 
} from './data/initialData';
import { Sidebar } from './components/Sidebar';
import { TopNav } from './components/TopNav';
import { OverviewView } from './components/OverviewView';
import { InventoryView } from './components/InventoryView';
import { EventsView } from './components/EventsView';
import { OrderListView } from './components/OrderListView';
import { HistoryView } from './components/HistoryView';
import { SettingsView } from './components/SettingsView';
import { CountEventFlow } from './components/CountEventFlow';

export function App() {
  // Application Data States with LocalStorage Persistence
  const [titles, setTitles] = useState<Title[]>(() => {
    const saved = localStorage.getItem('lit_titles');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* fallback */ }
    }
    return INITIAL_TITLES;
  });

  const [events, setEvents] = useState<EventItem[]>(() => {
    const saved = localStorage.getItem('lit_events');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* fallback */ }
    }
    return INITIAL_EVENTS;
  });

  const [movements, setMovements] = useState<Movement[]>(() => {
    const saved = localStorage.getItem('lit_movements');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* fallback */ }
    }
    return INITIAL_MOVEMENTS;
  });

  const [orders, setOrders] = useState<OrderItem[]>(() => {
    const saved = localStorage.getItem('lit_orders');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* fallback */ }
    }
    return INITIAL_ORDERS;
  });

  const [settings, setSettings] = useState<SettingsData>(() => {
    const saved = localStorage.getItem('lit_settings');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* fallback */ }
    }
    return INITIAL_SETTINGS;
  });

  // Navigation State
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Active Count Flow State
  const [isCounting, setIsCounting] = useState(false);
  const [activeCountEvent, setActiveCountEvent] = useState<{ name: string; date: string; id?: string } | null>(null);
  const [selectedEventIdForRecord, setSelectedEventIdForRecord] = useState<string | null>(null);

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem('lit_titles', JSON.stringify(titles));
  }, [titles]);

  useEffect(() => {
    localStorage.setItem('lit_events', JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    localStorage.setItem('lit_movements', JSON.stringify(movements));
  }, [movements]);

  useEffect(() => {
    localStorage.setItem('lit_orders', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem('lit_settings', JSON.stringify(settings));
  }, [settings]);

  // Helper date formatter
  const getTodayFormatted = () => {
    const d = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()} ${months[d.getMonth()]}`;
  };

  const getTodayIso = () => new Date().toISOString().slice(0, 10);

  // Calculate flagged items count for Sidebar badge
  const flaggedOrderCount = titles.reduce((acc, t) => {
    const threshold = settings.reorder[t.cat] || t.reorder;
    const lowEds = t.editions.filter(ed => ed.stock < threshold);
    return acc + lowEds.length;
  }, 0);

  // Handlers for Stock Adjustments
  const handleAdjustStock = (codeKey: string, newStock: number, note: string) => {
    let diff = 0;
    let titleName = '';
    let lang = '';

    setTitles(prev => prev.map(t => {
      let matched = false;
      const updatedEditions = t.editions.map(ed => {
        if (`${t.code}-${ed.lang}` === codeKey) {
          matched = true;
          diff = newStock - ed.stock;
          titleName = ed.title;
          lang = ed.lang;
          return { ...ed, stock: newStock };
        }
        return ed;
      });
      return matched ? { ...t, editions: updatedEditions } : t;
    }));

    if (diff !== 0) {
      const newMovement: Movement = {
        id: `mov-${Date.now()}`,
        iso: getTodayIso(),
        date: getTodayFormatted(),
        kind: 'adjust',
        what: `Adjusted — ${titleName} (${lang})`,
        detail: note || 'Shelf recount adjustment',
        delta: diff
      };
      setMovements(prev => [newMovement, ...prev]);
    }
  };

  // Handlers for Saving Titles (Add / Edit)
  const handleSaveTitle = (originalCode: string | null, nextTitle: Title) => {
    if (!originalCode) {
      // New title
      setTitles(prev => [...prev, nextTitle]);
      // Log starting stocks if > 0
      nextTitle.editions.forEach(ed => {
        if (ed.stock > 0) {
          const newMovement: Movement = {
            id: `mov-${Date.now()}-${ed.lang}`,
            iso: getTodayIso(),
            date: getTodayFormatted(),
            kind: 'adjust',
            what: `Starting stock — ${ed.title} (${ed.lang})`,
            detail: 'Initial shelf count upon catalog creation',
            delta: ed.stock
          };
          setMovements(prev => [newMovement, ...prev]);
        }
      });
    } else {
      // Existing title update
      setTitles(prev => prev.map(t => (t.code === originalCode ? nextTitle : t)));
    }
  };

  // Handlers for Count Flow
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
          name: 'Riverside outreach distribution',
          date: getTodayIso(),
          id: undefined
        });
      }
    }
    setIsCounting(true);
  };

  const handlePostCount = (lines: EventLine[]) => {
    let totalPassed = 0;

    // 1. Update shelf stocks
    setTitles(prev => prev.map(t => {
      const updatedEds = t.editions.map(ed => {
        const line = lines.find(l => l.key === `${t.code}-${ed.lang}` || l.code === `${t.code}-${ed.lang}`);
        if (line) {
          const passed = line.took - line.back;
          totalPassed += passed;
          return {
            ...ed,
            stock: Math.max(0, ed.stock - passed)
          };
        }
        return ed;
      });
      return { ...t, editions: updatedEds };
    }));

    const eventName = activeCountEvent?.name || 'Outreach event';
    const eventDate = activeCountEvent?.date || getTodayIso();
    const eventId = activeCountEvent?.id || `ev-${Date.now()}`;

    // 2. Log Movement to ledger
    const newMovement: Movement = {
      id: `mov-${Date.now()}`,
      iso: eventDate,
      date: getTodayFormatted(),
      kind: 'count',
      what: `Count posted — ${eventName}`,
      detail: `${lines.length} editions counted back`,
      delta: -totalPassed
    };
    setMovements(prev => [newMovement, ...prev]);

    // 3. Save or update event record
    setEvents(prev => {
      const existing = prev.find(e => e.id === eventId);
      if (existing) {
        return prev.map(e => e.id === eventId ? { ...e, planned: false, lines } : e);
      } else {
        const newEv: EventItem = {
          id: eventId,
          date: eventDate,
          location: eventName,
          planned: false,
          lines
        };
        return [newEv, ...prev];
      }
    });
  };

  // Handlers for Additive Corrections
  const handlePostCorrection = (
    eventId: string,
    note: string,
    changes: { key: string; from: number; to: number }[]
  ) => {
    let netDelta = 0;

    // Update lines in event
    setEvents(prev => prev.map(ev => {
      if (ev.id !== eventId) return ev;
      const updatedLines = ev.lines.map(l => {
        const change = changes.find(c => c.key === l.key);
        if (change) {
          return { ...l, back: change.to };
        }
        return l;
      });

      const newCorrection = {
        id: `c-${Date.now()}`,
        when: getTodayFormatted(),
        by: 'Admin',
        note,
        changes
      };

      return {
        ...ev,
        lines: updatedLines,
        corrections: [...(ev.corrections || []), newCorrection]
      };
    }));

    // Adjust shelf stocks by delta (if came back increases, inStore increases)
    changes.forEach(ch => {
      const delta = ch.to - ch.from;
      netDelta += delta;

      setTitles(prev => prev.map(t => {
        const updatedEds = t.editions.map(ed => {
          if (`${t.code}-${ed.lang}` === ch.key) {
            return { ...ed, stock: Math.max(0, ed.stock + delta) };
          }
          return ed;
        });
        return { ...t, editions: updatedEds };
      }));
    });

    const targetEvent = events.find(e => e.id === eventId);
    const newMovement: Movement = {
      id: `mov-corr-${Date.now()}`,
      iso: getTodayIso(),
      date: getTodayFormatted(),
      kind: 'count',
      what: `Correction filed — ${targetEvent ? targetEvent.location : 'Event'}`,
      detail: changes.map(ch => `${ch.key}: came back ${ch.from} → ${ch.to}`).join(', '),
      delta: netDelta
    };
    setMovements(prev => [newMovement, ...prev]);
  };

  // Handlers for Ordering & Receiving Deliveries
  const handleMarkOrdered = (
    toOrder: { code: string; title: string; lang?: string; qty: number; packs?: number; bundle?: string }[]
  ) => {
    const newOrders: OrderItem[] = toOrder.map(item => ({
      key: item.bundle ? `BND-${item.bundle}` : item.code,
      bundle: item.bundle,
      title: item.title,
      code: item.code,
      lang: item.lang,
      qty: item.qty,
      packs: item.packs,
      orderedDate: getTodayFormatted()
    }));

    setOrders(prev => [...prev.filter(o => !newOrders.some(n => n.key === o.key)), ...newOrders]);
    setActiveTab('order');
  };

  const handleReceiveDelivery = (
    receipts: { code: string; title: string; lang: 'EN' | 'ES'; qty: number }[],
    remainingOrders: OrderItem[]
  ) => {
    let totalReceived = 0;

    // Increment stocks
    receipts.forEach(r => {
      totalReceived += r.qty;
      setTitles(prev => prev.map(t => {
        const updatedEds = t.editions.map(ed => {
          if (`${t.code}-${ed.lang}` === r.code) {
            return { ...ed, stock: ed.stock + r.qty };
          }
          return ed;
        });
        return { ...t, editions: updatedEds };
      }));
    });

    // Write movement to ledger
    const newMovement: Movement = {
      id: `mov-rec-${Date.now()}`,
      iso: getTodayIso(),
      date: getTodayFormatted(),
      kind: 'receipt',
      what: `Stock received — delivery check-in`,
      detail: `${receipts.length} editions received into inventory`,
      delta: totalReceived
    };
    setMovements(prev => [newMovement, ...prev]);

    // Update remaining orders
    setOrders(remainingOrders);
  };

  const handleCancelOrder = (orderKey: string) => {
    setOrders(prev => prev.filter(o => o.key !== orderKey));
  };

  const handleSaveSettings = (nextSettings: SettingsData) => {
    setSettings(nextSettings);
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
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64 min-h-0 bg-white">
        {/* Mobile Top Navigation */}
        <TopNav
          onOpenMobileNav={() => setMobileNavOpen(true)}
          hallName={settings.hallName}
        />

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
            onAdjustStock={handleAdjustStock}
            onSaveTitle={handleSaveTitle}
          />
        )}

        {activeTab === 'events' && (
          <EventsView
            events={events}
            onStartCountForEvent={(ev) => handleStartCount(ev)}
            onSavePlannedEvent={(date, location) => {
              const newEv: EventItem = {
                id: `ev-${Date.now()}`,
                date,
                location,
                planned: true,
                lines: []
              };
              setEvents(prev => [newEv, ...prev]);
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
            settings={settings}
            onSaveSettings={handleSaveSettings}
          />
        )}
      </div>

      {/* Count Event Full Screen Takeover Flow */}
      {isCounting && (
        <CountEventFlow
          titles={titles}
          eventName={activeCountEvent?.name || 'Riverside outreach distribution'}
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
