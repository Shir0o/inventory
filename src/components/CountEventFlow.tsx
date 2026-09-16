import React, { useState, useEffect } from 'react';
import { Title, EventLine, Category } from '../types';
import { ArrowLeft, Check, ArrowRight, RotateCcw, AlertTriangle } from 'lucide-react';

interface CountEventFlowProps {
  titles: Title[];
  eventName: string;
  eventDate: string;
  eventId?: string;
  onPostCount: (lines: EventLine[]) => void;
  onLeave: () => void;
  onViewRecord: () => void;
  onGoOrderList: () => void;
  reorderSensitivity?: number;
  autoAdvanceOnEnter?: boolean;
}

interface WorkingItem {
  code: string;
  title: string;
  lang: 'EN' | 'ES';
  cat: Category;
  inStore: number;
  reorder: number;
  alias?: string;
  took: number;
  returned: number | null;
}

interface SavedCountDraft {
  eventId?: string;
  eventName: string;
  eventDate: string;
  step: 1 | 2 | 3 | 4;
  currentIndex: number;
  searchQuery?: string;
  itemsData: {
    [code: string]: {
      took: number;
      returned: number | null;
    };
  };
  lastSavedAt: number;
}

const getStorageKey = (id?: string, name?: string, date?: string) => {
  if (id) return `lit_ledger_count_draft_event_${id}`;
  const safeName = (name || 'outreach').trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
  const safeDate = (date || 'today').trim().replace(/[^a-z0-9]/g, '_');
  return `lit_ledger_count_draft_${safeName}_${safeDate}`;
};

export const CountEventFlow: React.FC<CountEventFlowProps> = ({
  titles,
  eventName,
  eventDate,
  eventId,
  onPostCount,
  onLeave,
  onViewRecord,
  onGoOrderList,
  reorderSensitivity = 1,
  autoAdvanceOnEnter = true
}) => {
  const reorderAt = (reorder: number) => Math.round(reorder * reorderSensitivity);
  const storageKey = getStorageKey(eventId, eventName, eventDate);

  // Helper to load saved draft from localStorage
  const loadSavedDraft = (): SavedCountDraft | null => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.itemsData) {
        return parsed;
      }
    } catch (err) {
      console.warn('Failed to parse saved count draft:', err);
    }
    return null;
  };

  // Initialize items from titles, restoring any saved take out or return numbers
  const buildInitialItems = (): WorkingItem[] => {
    const draft = loadSavedDraft();
    const savedCounts = draft?.itemsData || {};

    const list: WorkingItem[] = [];
    titles.forEach(t => {
      const aliases = t.aliases || (t.alias ? [t.alias] : []);
      t.editions.forEach(ed => {
        const code = `${t.code}-${ed.lang}`;
        const saved = savedCounts[code];
        list.push({
          code,
          title: ed.title,
          lang: ed.lang,
          cat: t.cat,
          inStore: ed.stock,
          reorder: t.reorder,
          alias: aliases.join(', '),
          took: saved && typeof saved.took === 'number' ? saved.took : 0,
          returned: saved ? saved.returned : null
        });
      });
    });
    return list;
  };

  const [step, setStep] = useState<1 | 2 | 3 | 4>(() => {
    const draft = loadSavedDraft();
    if (draft && draft.step >= 1 && draft.step <= 3) {
      return draft.step;
    }
    return 1;
  });

  const [items, setItems] = useState<WorkingItem[]>(buildInitialItems);

  const [currentIndex, setCurrentIndex] = useState<number>(() => {
    const draft = loadSavedDraft();
    return typeof draft?.currentIndex === 'number' ? draft.currentIndex : 0;
  });

  const [searchQuery, setSearchQuery] = useState<string>(() => {
    const draft = loadSavedDraft();
    return draft?.searchQuery || '';
  });

  const [lastSavedTime, setLastSavedTime] = useState<string | null>(() => {
    const draft = loadSavedDraft();
    if (draft?.lastSavedAt) {
      const d = new Date(draft.lastSavedAt);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return null;
  });

  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Auto-save draft on every change so user never loses progress
  useEffect(() => {
    if (step === 4) {
      return;
    }

    const itemsData: { [code: string]: { took: number; returned: number | null } } = {};
    let hasAnyData = false;

    items.forEach(i => {
      if (i.took > 0 || i.returned !== null) {
        hasAnyData = true;
        itemsData[i.code] = {
          took: i.took,
          returned: i.returned
        };
      }
    });

    if (hasAnyData || step > 1) {
      try {
        const payload: SavedCountDraft = {
          eventId,
          eventName,
          eventDate,
          step,
          currentIndex,
          searchQuery,
          itemsData,
          lastSavedAt: Date.now()
        };
        localStorage.setItem(storageKey, JSON.stringify(payload));
        localStorage.setItem('lit_ledger_active_count_event', JSON.stringify({
          name: eventName,
          date: eventDate,
          id: eventId
        }));
        localStorage.setItem('lit_ledger_is_counting', 'true');
        const d = new Date();
        setLastSavedTime(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      } catch (err) {
        console.warn('Failed to save count draft to localStorage:', err);
      }
    } else {
      try {
        localStorage.removeItem(storageKey);
      } catch (err) {}
    }
  }, [items, step, currentIndex, searchQuery, storageKey, eventId, eventName, eventDate]);

  // Keyboard navigation for step 2
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (step !== 2) return;
      if (e.key === 'Enter' && autoAdvanceOnEnter) {
        e.preventDefault();
        handleNextItem();
      } else if (e.key === 'ArrowLeft' && (e.target as HTMLElement)?.tagName !== 'INPUT') {
        handlePrevItem();
      } else if (e.key === 'ArrowRight' && (e.target as HTMLElement)?.tagName !== 'INPUT') {
        handleNextItem();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const takenItems = items.filter(i => i.took > 0);
  const countedItems = takenItems.filter(i => i.returned !== null);
  const allCounted = takenItems.length > 0 && countedItems.length === takenItems.length;

  const activeIndex = Math.min(currentIndex, Math.max(0, takenItems.length - 1));
  const currentItem = takenItems[activeIndex];

  const totalLoadoutPieces = items.reduce((sum, i) => sum + (i.took || 0), 0);
  const totalTook = takenItems.reduce((sum, i) => sum + i.took, 0);
  const totalReturned = countedItems.reduce((sum, i) => sum + (i.returned || 0), 0);
  const totalPassed = countedItems.reduce((sum, i) => sum + (i.took - (i.returned || 0)), 0);

  const updateItem = (code: string, patch: Partial<WorkingItem>) => {
    setItems(prev => prev.map(i => i.code === code ? { ...i, ...patch } : i));
  };

  const handlePrevItem = () => {
    setCurrentIndex(prev => Math.max(0, prev - 1));
  };

  const handleNextItem = () => {
    if (activeIndex >= takenItems.length - 1) {
      setStep(3);
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePostSubmit = () => {
    if (!allCounted) return;
    const lines: EventLine[] = takenItems.map(i => ({
      key: i.code,
      code: i.code,
      lang: i.lang,
      title: i.title,
      before: i.inStore,
      took: i.took,
      back: i.returned || 0
    }));

    // Post to backend
    onPostCount(lines);

    // Clean up draft from storage
    try {
      localStorage.removeItem(storageKey);
      localStorage.removeItem('lit_ledger_is_counting');
      localStorage.removeItem('lit_ledger_active_count_event');
    } catch (err) {}

    setStep(4);
  };

  const handleDiscardDraft = () => {
    try {
      localStorage.removeItem(storageKey);
      localStorage.removeItem('lit_ledger_is_counting');
      localStorage.removeItem('lit_ledger_active_count_event');
    } catch (err) {}

    const fresh: WorkingItem[] = [];
    titles.forEach(t => {
      const aliases = t.aliases || (t.alias ? [t.alias] : []);
      t.editions.forEach(ed => {
        fresh.push({
          code: `${t.code}-${ed.lang}`,
          title: ed.title,
          lang: ed.lang,
          cat: t.cat,
          inStore: ed.stock,
          reorder: t.reorder,
          alias: aliases.join(', '),
          took: 0,
          returned: null
        });
      });
    });

    setItems(fresh);
    setCurrentIndex(0);
    setSearchQuery('');
    setStep(1);
    setLastSavedTime(null);
    setShowDiscardConfirm(false);
  };

  const handleRestart = () => {
    handleDiscardDraft();
  };

  // Find low items after count
  const lowItemsAfterCount = takenItems.filter(i => {
    const passed = i.took - (i.returned || 0);
    const after = i.inStore - passed;
    return after < reorderAt(i.reorder);
  });

  return (
    <div className="fixed inset-0 bg-white z-50 flex overflow-hidden">
      {/* Left Progress Rail */}
      <aside className="w-72 bg-[#f6f7f9] border-r border-[#dcdee3] flex flex-col flex-none min-h-0">
        {/* Header */}
        <div className="p-5 border-b border-[#dcdee3]">
          <button
            onClick={onLeave}
            className="text-[12.5px] font-semibold text-[#1f5f8b] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Leave count</span>
          </button>
          <div className="mt-3 font-bold text-[15px] text-[#191c20] tracking-tight leading-snug">
            {eventName}
          </div>
          <div className="text-[12px] text-[#6c6f77] mt-0.5">{eventDate}</div>

          {/* Auto-save status and draft reset */}
          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[#dcdee3]">
            <div className="flex items-center gap-1.5 text-[11px] text-[#1f5f8b] font-medium">
              <Check className="w-3.5 h-3.5 flex-none" />
              <span>{lastSavedTime ? `Saved at ${lastSavedTime}` : 'Auto-saving'}</span>
            </div>
            {(takenItems.length > 0 || step > 1) && step !== 4 && (
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(true)}
                className="text-[11px] text-[#6c6f77] hover:text-[#b3261e] underline cursor-pointer"
                title="Discard saved progress and start over"
              >
                Reset draft
              </button>
            )}
          </div>
        </div>

        {/* Step Progress List */}
        <div className="py-2 border-b border-[#dcdee3] space-y-0.5">
          {[
            { num: 1, label: 'Take out', meta: takenItems.length > 0 ? `${takenItems.length} items` : '', canNav: true },
            { num: 2, label: 'Count back', meta: `${countedItems.length} / ${takenItems.length}`, canNav: takenItems.length > 0 },
            { num: 3, label: 'Review', meta: allCounted ? 'Ready' : '', canNav: takenItems.length > 0 },
            { num: 4, label: 'Posted', meta: '', canNav: false }
          ].map(s => {
            const active = step === s.num;
            const done = step > s.num;
            return (
              <div
                key={s.num}
                onClick={() => {
                  if (s.canNav && step !== 4) setStep(s.num as any);
                }}
                className={`
                  flex items-center justify-between px-5 py-2 text-[13px] transition-colors
                  ${s.canNav && step !== 4 ? 'cursor-pointer' : 'cursor-default'}
                  ${active 
                    ? 'bg-white font-bold text-[#1f5f8b] border-l-[3px] border-[#1f5f8b]' 
                    : done 
                      ? 'text-[#44474e] border-l-[3px] border-transparent hover:bg-[#eef0f3]' 
                      : 'text-[#8b8e96] border-l-[3px] border-transparent'
                  }
                `}
              >
                <div className="flex items-center gap-2.5">
                  <span className={`
                    w-4.5 h-4.5 rounded-full text-[10px] font-bold flex items-center justify-center flex-none
                    ${done 
                      ? 'bg-[#1f5f8b] text-white' 
                      : active 
                        ? 'border-2 border-[#1f5f8b] text-[#1f5f8b]' 
                        : 'border border-[#c9cbd2] text-[#8b8e96]'
                    }
                  `}>
                    {done ? '✓' : s.num}
                  </span>
                  <span>{s.label}</span>
                </div>
                {s.meta && (
                  <span className="font-mono text-[11px] text-[#8b8e96] tabular-nums">
                    {s.meta}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Step 2 item jump rail */}
        {step === 2 && takenItems.length > 0 && (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="px-5 pt-3.5 pb-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-[#dcdee3] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#1f5f8b] transition-all duration-200"
                    style={{ width: `${(countedItems.length / takenItems.length) * 100}%` }}
                  />
                </div>
                <span className="font-mono text-[11px] font-bold text-[#44474e] tabular-nums">
                  {countedItems.length} / {takenItems.length}
                </span>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar py-1 space-y-0.5">
              {takenItems.map((item, idx) => {
                const isCurrent = idx === activeIndex;
                const isDone = item.returned !== null;
                const passed = isDone ? item.took - (item.returned || 0) : null;

                return (
                  <div
                    key={item.code}
                    onClick={() => setCurrentIndex(idx)}
                    className={`
                      flex items-center justify-between px-5 py-2 text-[12.5px] cursor-pointer transition-colors
                      ${isCurrent 
                        ? 'bg-white font-bold text-[#1f5f8b] border-l-[3px] border-[#1f5f8b]' 
                        : isDone 
                          ? 'text-[#44474e] hover:bg-[#eef0f3] border-l-[3px] border-transparent' 
                          : 'text-[#8b8e96] hover:bg-[#eef0f3] border-l-[3px] border-transparent'
                      }
                    `}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span className={`
                        w-3.5 h-3.5 rounded-full text-[9px] font-bold flex items-center justify-center flex-none
                        ${isDone ? 'bg-[#1f5f8b] text-white' : isCurrent ? 'border-2 border-[#1f5f8b]' : 'border border-[#c9cbd2]'}
                      `}>
                        {isDone && '✓'}
                      </span>
                      <span className="truncate">{item.title}</span>
                    </div>
                    <span className="font-mono text-[11px] text-[#8b8e96] flex-none tabular-nums">
                      {passed !== null ? passed : ''}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="p-4 border-t border-[#dcdee3]">
              <button
                onClick={() => setStep(3)}
                className={`
                  w-full py-2 px-3 rounded-md text-[13px] font-semibold transition-colors cursor-pointer
                  ${allCounted
                    ? 'bg-[#1f5f8b] hover:bg-[#17496c] text-white'
                    : 'border border-[#c9cbd2] bg-white text-[#44474e] hover:bg-[#eef0f3]'
                  }
                `}
              >
                {allCounted ? 'Review & post →' : `Review — ${takenItems.length - countedItems.length} left`}
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Main Flow Stage */}
      <main className="flex-1 min-w-0 min-h-0 flex flex-col bg-white overflow-hidden">
        {/* STEP 1: Take Out */}
        {step === 1 && (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="px-8 pt-8 pb-5 border-b border-[#dcdee3]">
              <div className="text-[10px] font-bold tracking-widest uppercase text-[#6c6f77]">
                Step 1
              </div>
              <h1 className="text-[26px] font-bold tracking-tight text-[#191c20] mt-1">
                Take out
              </h1>
              <p className="text-[14px] text-[#44474e] mt-1 max-w-xl leading-normal">
                How many of each are you taking? Nothing leaves your stock count yet — that happens when you post the count afterwards.
              </p>

              <div className="mt-2.5 inline-flex items-center gap-1.5 text-[12px] text-[#1f5f8b] bg-[#e9f1f7] px-2.5 py-1 rounded-md border border-[#1f5f8b]/15">
                <Check className="w-3.5 h-3.5 flex-none" />
                <span>All entries auto-save immediately. You can safely leave and return at any time.</span>
              </div>

              <div className="mt-4 w-80">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search title, code, or an old name"
                  className="w-full px-3 py-1.5 border border-[#c9cbd2] rounded-md text-[13px] text-[#191c20] bg-white focus:border-[#1f5f8b] focus:ring-2 focus:ring-[#1f5f8b]/15 outline-none"
                />
              </div>
            </div>

            {/* Take out items list */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
              <div className="sticky top-0 z-10 grid grid-cols-[1fr_100px_160px] items-center px-8 py-2.5 bg-[#f6f7f9] border-b border-[#dcdee3] text-[10px] font-bold tracking-wider uppercase text-[#6c6f77]">
                <div>Item</div>
                <div className="text-right">In store</div>
                <div className="text-right">Taking</div>
              </div>

              <div className="divide-y divide-[#eef0f3]">
                {items
                  .filter(i => {
                    const q = searchQuery.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      i.title.toLowerCase().includes(q) ||
                      i.code.toLowerCase().includes(q) ||
                      (i.alias && i.alias.toLowerCase().includes(q))
                    );
                  })
                  .map(item => (
                    <div
                      key={item.code}
                      className={`
                        grid grid-cols-[1fr_100px_160px] items-center px-8 py-3 transition-colors
                        ${item.took > 0 ? 'bg-white' : 'bg-[#fcfcfd]'}
                      `}
                    >
                      {/* Title, Code, Badges */}
                      <div className="min-w-0 pr-4">
                        <div className="font-semibold text-[14px] text-[#191c20]">
                          {item.title}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`
                            text-[9px] font-bold px-1.5 py-0.5 rounded-xs
                            ${item.lang === 'EN' ? 'text-[#1f5f8b] bg-[#e9f1f7]' : 'text-[#7a4a8b] bg-[#f4edf7]'}
                          `}>
                            {item.lang}
                          </span>
                          <span className="font-mono text-[10px] text-[#8b8e96] bg-[#f1f3f5] px-1.5 py-0.5 rounded tracking-tight border border-[#dcdee3]/60">
                            {item.code}
                          </span>
                          {item.alias && (
                            <span className="text-[11.5px] text-[#8b8e96] italic">
                              also known as “{item.alias}”
                            </span>
                          )}
                        </div>
                      </div>

                      {/* In Store */}
                      <div className="text-right font-mono text-[14px] text-[#44474e] tabular-nums">
                        {item.inStore}
                      </div>

                      {/* Taking inputs with +/- */}
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateItem(item.code, { took: Math.max(0, item.took - 5) })}
                          className="w-7 h-7 border border-[#c9cbd2] bg-white hover:bg-[#f6f7f9] text-[#44474e] font-bold rounded-md flex items-center justify-center cursor-pointer transition-colors"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min="0"
                          max={item.inStore}
                          value={item.took || ''}
                          placeholder="0"
                          onChange={(e) => {
                            const val = Math.min(item.inStore, Math.max(0, parseInt(e.target.value, 10) || 0));
                            updateItem(item.code, { took: val });
                          }}
                          className="w-16 px-2 py-1.5 border border-[#c9cbd2] rounded-md font-mono text-[13.5px] font-bold text-right text-[#191c20] bg-white focus:border-[#1f5f8b] outline-none tabular-nums"
                        />
                        <button
                          type="button"
                          onClick={() => updateItem(item.code, { took: Math.min(item.inStore, item.took + 5) })}
                          className="w-7 h-7 border border-[#c9cbd2] bg-white hover:bg-[#f6f7f9] text-[#44474e] font-bold rounded-md flex items-center justify-center cursor-pointer transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-4 border-t border-[#dcdee3] bg-white flex items-center justify-between gap-4">
              <div className="text-[13px] text-[#44474e]">
                Taking <strong>{totalLoadoutPieces}</strong> pieces across <strong>{takenItems.length}</strong> items
              </div>
              <button
                onClick={() => {
                  if (takenItems.length > 0) setStep(2);
                }}
                disabled={takenItems.length === 0}
                className={`
                  px-5 py-2.5 rounded-md font-semibold text-[13.5px] transition-colors cursor-pointer shadow-xs
                  ${takenItems.length > 0 
                    ? 'bg-[#1f5f8b] hover:bg-[#17496c] text-white' 
                    : 'bg-[#f6f7f9] text-[#a3a6ad] border border-[#dcdee3] cursor-not-allowed'
                  }
                `}
              >
                Continue to count →
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Count Back (1 by 1) */}
        {step === 2 && currentItem && (
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-8 sm:p-12 flex flex-col justify-between max-w-3xl">
            <div>
              <div className="text-[10px] font-bold tracking-widest uppercase text-[#6c6f77]">
                {currentItem.cat} · item {activeIndex + 1} of {takenItems.length}
              </div>
              <h1 className="text-[30px] font-bold tracking-tight text-[#191c20] mt-1.5 leading-tight">
                {currentItem.title}
              </h1>
              <div className="flex items-center gap-2 mt-2">
                <span className={`
                  text-[10px] font-bold px-2 py-0.5 rounded-xs uppercase tracking-wider
                  ${currentItem.lang === 'EN' ? 'text-[#1f5f8b] bg-[#e9f1f7]' : 'text-[#7a4a8b] bg-[#f4edf7]'}
                `}>
                  {currentItem.lang === 'EN' ? 'ENGLISH' : 'SPANISH'}
                </span>
                <span className="font-mono text-[11px] text-[#8b8e96] bg-[#f1f3f5] px-2 py-0.5 rounded tracking-tight border border-[#dcdee3]/60 font-normal">
                  {currentItem.code}
                </span>
              </div>
              {currentItem.alias && (
                <div className="text-[13px] text-[#6c6f77] italic mt-2">
                  Your older sheets may call this “{currentItem.alias}” — same item.
                </div>
              )}

              {/* Big Equation Box */}
              <div className="mt-8 flex items-end gap-4 flex-wrap">
                {/* Took out */}
                <div>
                  <div className="text-[10px] font-bold tracking-wider uppercase text-[#6c6f77]">
                    Took out
                  </div>
                  <div className="font-mono text-[44px] font-bold text-[#44474e] leading-none mt-1 tabular-nums">
                    {currentItem.took}
                  </div>
                </div>

                <div className="text-[30px] text-[#c9cbd2] pb-2 font-light">−</div>

                {/* Came back Input */}
                <div>
                  <div className="text-[10px] font-bold tracking-wider uppercase text-[#1f5f8b]">
                    Came back
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={currentItem.took}
                    autoFocus
                    placeholder="0"
                    value={currentItem.returned !== null ? currentItem.returned : ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? null : Math.min(currentItem.took, Math.max(0, parseInt(e.target.value, 10) || 0));
                      updateItem(currentItem.code, { returned: val });
                    }}
                    className="w-36 mt-1 px-3 py-2 border-2 border-[#1f5f8b] rounded-lg font-mono text-[40px] font-bold text-center text-[#191c20] bg-white focus:ring-4 focus:ring-[#1f5f8b]/15 outline-none tabular-nums"
                  />
                </div>

                <div className="text-[30px] text-[#c9cbd2] pb-2 font-light">=</div>

                {/* Passed out Derived */}
                <div>
                  <div className="text-[10px] font-bold tracking-wider uppercase text-[#6c6f77]">
                    Passed out
                  </div>
                  <div className="font-mono text-[44px] font-bold text-[#191c20] leading-none mt-1 tabular-nums">
                    {currentItem.returned !== null ? currentItem.took - currentItem.returned : '—'}
                  </div>
                </div>
              </div>

              {/* Store impact card */}
              <div className="mt-6 p-4 bg-[#f6f7f9] border border-[#dcdee3] rounded-lg space-y-1.5">
                <div className="text-[13px] text-[#44474e]">
                  In store: <strong className="font-mono">{currentItem.inStore}</strong> before →{' '}
                  <strong className="font-mono text-[#191c20]">
                    {currentItem.returned !== null ? currentItem.inStore - (currentItem.took - currentItem.returned) : '—'}
                  </strong>{' '}
                  after posting {currentItem.returned !== null && `(−${currentItem.took - currentItem.returned})`}
                </div>
                {currentItem.returned !== null && (currentItem.inStore - (currentItem.took - currentItem.returned)) < reorderAt(currentItem.reorder) && (
                  <div className="text-[12px] font-semibold text-[#8a5a00] flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Below its reorder point of {reorderAt(currentItem.reorder)} — this will be flagged for reorder.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Shortcuts & Buttons */}
            <div className="mt-12 pt-6 border-t border-[#eef0f3] space-y-4">
              <div className="text-[12px] text-[#8b8e96]">
                Shortcut:{' '}
                <button
                  type="button"
                  onClick={() => updateItem(currentItem.code, { returned: currentItem.took })}
                  className="text-[#1f5f8b] hover:underline font-medium cursor-pointer"
                >
                  all {currentItem.took} came back
                </button>{' '}
                ·{' '}
                <button
                  type="button"
                  onClick={() => updateItem(currentItem.code, { returned: 0 })}
                  className="text-[#1f5f8b] hover:underline font-medium cursor-pointer"
                >
                  none came back
                </button>
              </div>

              <div className="flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={handlePrevItem}
                  disabled={activeIndex === 0}
                  className="px-5 py-2.5 border border-[#c9cbd2] bg-white hover:bg-[#f6f7f9] text-[#44474e] font-semibold text-[13.5px] rounded-md transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Previous
                </button>

                <button
                  type="button"
                  onClick={handleNextItem}
                  className="px-6 py-2.5 bg-[#1f5f8b] hover:bg-[#17496c] text-white font-semibold text-[13.5px] rounded-md transition-colors cursor-pointer shadow-xs"
                >
                  {activeIndex >= takenItems.length - 1 ? 'Review →' : 'Next item →'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Review & Check Over */}
        {step === 3 && (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="px-8 pt-8 pb-5 border-b border-[#dcdee3] flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-bold tracking-widest uppercase text-[#6c6f77]">
                  Step 3
                </div>
                <h1 className="text-[26px] font-bold tracking-tight text-[#191c20] mt-1">
                  Check it over
                </h1>
                <p className="text-[13.5px] text-[#44474e] mt-1 max-w-xl">
                  Click any number to fix it. Posting writes the movements and updates your shelf counts.
                </p>
              </div>
              <div className="text-right flex-none">
                <div className="text-[10px] font-bold tracking-wider uppercase text-[#6c6f77]">
                  Passed out
                </div>
                <div className="font-mono text-[32px] font-bold text-[#191c20] leading-none mt-1 tabular-nums">
                  {totalPassed}
                </div>
                <div className="text-[12px] text-[#8b8e96] mt-0.5">
                  of {totalTook} taken out
                </div>
              </div>
            </div>

            {/* Review table */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
              <div className="sticky top-0 z-10 grid grid-cols-[1fr_70px_100px_90px_120px] items-center px-8 py-2.5 bg-[#f6f7f9] border-b border-[#dcdee3] text-[10px] font-bold tracking-wider uppercase text-[#6c6f77]">
                <div>Item</div>
                <div className="text-right">Took</div>
                <div className="text-right">Came back</div>
                <div className="text-right">Passed out</div>
                <div className="text-right">In store after</div>
              </div>

              <div className="divide-y divide-[#eef0f3]">
                {takenItems.map(item => {
                  const isCounted = item.returned !== null;
                  const passed = isCounted ? item.took - (item.returned || 0) : null;
                  const after = isCounted ? item.inStore - passed! : item.inStore;
                  const isLow = isCounted && after < reorderAt(item.reorder);

                  return (
                    <div
                      key={item.code}
                      className={`
                        grid grid-cols-[1fr_70px_100px_90px_120px] items-center px-8 py-3 transition-colors
                        ${isLow ? 'bg-[#fffdf7]' : !isCounted ? 'bg-[#fffcfc]' : 'bg-white'}
                      `}
                    >
                      {/* Item Details */}
                      <div className="min-w-0 pr-3">
                        <div className="font-semibold text-[13.5px] text-[#191c20] truncate">
                          {item.title}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`
                            text-[9px] font-bold px-1.5 py-0.5 rounded-xs
                            ${item.lang === 'EN' ? 'text-[#1f5f8b] bg-[#e9f1f7]' : 'text-[#7a4a8b] bg-[#f4edf7]'}
                          `}>
                            {item.lang}
                          </span>
                          <span className="font-mono text-[10px] text-[#8b8e96] bg-[#f1f3f5] px-1.5 py-0.5 rounded tracking-tight border border-[#dcdee3]/60">{item.code}</span>
                          {isLow && (
                            <span className="text-[11px] font-semibold text-[#8a5a00]">
                              below reorder point of {reorderAt(item.reorder)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Took */}
                      <div className="text-right font-mono text-[13.5px] text-[#44474e] tabular-nums">
                        {item.took}
                      </div>

                      {/* Came Back Editable Input */}
                      <div className="flex justify-end">
                        <input
                          type="number"
                          min="0"
                          max={item.took}
                          value={item.returned !== null ? item.returned : ''}
                          placeholder="—"
                          onChange={(e) => {
                            const val = e.target.value === '' ? null : Math.min(item.took, Math.max(0, parseInt(e.target.value, 10) || 0));
                            updateItem(item.code, { returned: val });
                          }}
                          className="w-20 px-2 py-1 border border-[#c9cbd2] rounded-md font-mono text-[13px] font-bold text-right text-[#191c20] bg-white focus:border-[#1f5f8b] outline-none tabular-nums"
                        />
                      </div>

                      {/* Passed Out */}
                      <div className={`
                        text-right font-mono text-[14px] font-bold tabular-nums
                        ${isCounted ? 'text-[#1f5f8b]' : 'text-[#8b8e96]'}
                      `}>
                        {passed !== null ? passed : '—'}
                      </div>

                      {/* In Store After */}
                      <div className="text-right font-mono text-[13px] text-[#8b8e96] tabular-nums">
                        {item.inStore} → <strong className="text-[#191c20]">{isCounted ? after : '—'}</strong>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total Summary Row */}
              <div className="grid grid-cols-[1fr_70px_100px_90px_120px] items-center px-8 py-3.5 bg-[#f6f7f9] border-t border-[#dcdee3] font-bold text-[13px]">
                <div className="text-[#44474e]">Total</div>
                <div className="text-right font-mono tabular-nums">{totalTook}</div>
                <div className="text-right font-mono tabular-nums pr-2">{totalReturned}</div>
                <div className="text-right font-mono text-[#1f5f8b] tabular-nums text-[14.5px]">{totalPassed}</div>
                <div />
              </div>
            </div>

            {/* Review Bottom Bar */}
            <div className="px-8 py-4 border-t border-[#dcdee3] bg-white flex items-center justify-between gap-4">
              <div className="text-[13px] text-[#44474e]">
                {allCounted ? (
                  lowItemsAfterCount.length > 0 ? (
                    <span className="text-[#8a5a00] font-semibold">
                      {lowItemsAfterCount.length} {lowItemsAfterCount.length === 1 ? 'item lands' : 'items land'} below reorder point.
                    </span>
                  ) : (
                    'All items stay safely above their reorder points.'
                  )
                ) : (
                  <span className="text-[#b3261e] font-semibold">
                    {takenItems.length - countedItems.length} of {takenItems.length} items still need a count before posting.
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5 flex-none">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2 border border-[#c9cbd2] bg-white hover:bg-[#f6f7f9] text-[#44474e] font-semibold text-[13px] rounded-md transition-colors cursor-pointer"
                >
                  ← Back to counting
                </button>

                <button
                  type="button"
                  onClick={handlePostSubmit}
                  disabled={!allCounted}
                  className={`
                    px-5 py-2 rounded-md font-semibold text-[13.5px] transition-colors cursor-pointer shadow-xs
                    ${allCounted
                      ? 'bg-[#1f5f8b] hover:bg-[#17496c] text-white border border-[#1f5f8b]'
                      : 'bg-[#f6f7f9] text-[#a3a6ad] border border-[#dcdee3] cursor-not-allowed'
                    }
                  `}
                >
                  Post count
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Posted / Complete */}
        {step === 4 && (
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-8 flex items-center justify-center">
            <div className="max-w-xl w-full space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#1f5f8b] text-white flex items-center justify-center font-bold text-sm">
                  ✓
                </div>
                <h1 className="text-[25px] font-bold tracking-tight text-[#191c20]">
                  Count posted
                </h1>
              </div>

              <p className="text-[14.5px] text-[#44474e] leading-relaxed">
                <strong>{totalPassed.toLocaleString()}</strong> pieces were passed out at <strong>{eventName}</strong> on <strong>{eventDate}</strong>. Stock counts have been updated in the ledger and the event record is closed.
              </p>

              {/* Summary 3-tile grid */}
              <div className="grid grid-cols-3 gap-px bg-[#dcdee3] border border-[#dcdee3] rounded-lg overflow-hidden">
                <div className="bg-white p-4">
                  <div className="text-[10px] font-bold tracking-wider uppercase text-[#6c6f77]">Passed out</div>
                  <div className="font-mono text-[24px] font-bold text-[#191c20] mt-1 tabular-nums">
                    {totalPassed}
                  </div>
                </div>
                <div className="bg-white p-4">
                  <div className="text-[10px] font-bold tracking-wider uppercase text-[#6c6f77]">Came back</div>
                  <div className="font-mono text-[24px] font-bold text-[#191c20] mt-1 tabular-nums">
                    {totalReturned}
                  </div>
                </div>
                <div className="bg-white p-4">
                  <div className="text-[10px] font-bold tracking-wider uppercase text-[#6c6f77]">Stock movements</div>
                  <div className="font-mono text-[24px] font-bold text-[#191c20] mt-1 tabular-nums">
                    {takenItems.length}
                  </div>
                </div>
              </div>

              {/* Needs Reorder Card */}
              <div className="p-4 border border-[#f2d9a8] bg-[#fffdf7] rounded-lg">
                <div className="text-[10px] font-bold tracking-wider uppercase text-[#8a5a00]">
                  Order list
                </div>
                {lowItemsAfterCount.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {lowItemsAfterCount.map(item => {
                      const after = item.inStore - (item.took - (item.returned || 0));
                      return (
                        <div key={item.code} className="flex items-baseline justify-between gap-3 text-[13.5px]">
                          <span className="text-[#191c20] truncate">
                            {item.title} <span className="text-[#8b8e96]">· {item.lang}</span>
                          </span>
                          <span className="font-mono text-[12.5px] text-[#44474e] flex-none tabular-nums">
                            {after} left · reorder at {reorderAt(item.reorder)}
                          </span>
                        </div>
                      );
                    })}
                    <div className="pt-2">
                      <button
                        onClick={onGoOrderList}
                        className="px-3.5 py-1.5 border border-[#c9cbd2] bg-white hover:bg-[#f6f7f9] text-[#44474e] text-[12.5px] font-semibold rounded-md cursor-pointer transition-colors"
                      >
                        Add all to order list
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[13px] text-[#44474e] mt-2">
                    Nothing is below its reorder point.
                  </p>
                )}
              </div>

              {/* Finish Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleRestart}
                  className="px-4 py-2.5 bg-[#1f5f8b] hover:bg-[#17496c] text-white font-semibold text-[13.5px] rounded-md transition-colors cursor-pointer shadow-xs"
                >
                  Count another event
                </button>
                <button
                  onClick={onViewRecord}
                  className="px-4 py-2.5 border border-[#c9cbd2] bg-white hover:bg-[#f6f7f9] text-[#44474e] font-semibold text-[13.5px] rounded-md transition-colors cursor-pointer"
                >
                  View event record
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Discard In-Progress Count Confirmation Dialog */}
      {showDiscardConfirm && (
        <div className="fixed inset-0 bg-slate-900/40 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-lg border border-[#dcdee3] space-y-4">
            <h3 className="font-bold text-[16px] text-[#191c20]">Discard in-progress count?</h3>
            <p className="text-[13px] text-[#44474e] leading-relaxed">
              This will clear all entered quantities and reset the count back to Step 1.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                className="px-3.5 py-1.5 border border-[#c9cbd2] bg-white text-[#44474e] text-[13px] font-semibold rounded-md hover:bg-[#f6f7f9] cursor-pointer"
              >
                Keep counting
              </button>
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="px-3.5 py-1.5 bg-[#b3261e] hover:bg-[#8e1f18] text-white text-[13px] font-semibold rounded-md cursor-pointer shadow-xs"
              >
                Discard & reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
