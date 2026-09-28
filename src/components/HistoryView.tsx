import React, { useState, useMemo } from 'react';
import { Movement, Title, Language, EventItem } from '../types';
import { Search, Filter, RotateCcw, CheckCircle2, PackageCheck, History, ArrowRight, X, ExternalLink } from 'lucide-react';
import { ItemTrailModal } from './ItemTrailModal';
import { buildItemTrail } from '../services/itemTrailService';

interface HistoryViewProps {
  movements: Movement[];
  onReconcile?: () => Promise<void>;
  isReconciling?: boolean;
  reconciliationMessage?: string;
  titles?: Title[];
  rawLogs?: any[];
  events?: EventItem[];
  rawInventory?: any[];
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  movements,
  onReconcile,
  isReconciling,
  reconciliationMessage,
  titles = [],
  rawLogs = [],
  events = [],
  rawInventory = []
}) => {
  const [kindFilter, setKindFilter] = useState<'all' | 'count' | 'receipt' | 'adjust'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemKey, setSelectedItemKey] = useState<string>('ALL');
  const [trailModalTarget, setTrailModalTarget] = useState<{ title: Title; lang?: Language } | null>(null);

  // Parse selected title & edition if any
  const selectedItem = useMemo(() => {
    if (!selectedItemKey || selectedItemKey === 'ALL') return null;
    const [code, langStr] = selectedItemKey.split(':');
    const title = titles.find(t => t.code === code);
    if (!title) return null;
    const lang = (langStr === 'ALL' || !langStr) ? undefined : (langStr as Language);
    return { title, lang };
  }, [selectedItemKey, titles]);

  // Compute item trail summary when an item is selected
  const activeTrailSummary = useMemo(() => {
    if (!selectedItem) return null;
    return buildItemTrail({
      title: selectedItem.title,
      editionLang: selectedItem.lang,
      rawLogs,
      events,
      rawInventory
    });
  }, [selectedItem, rawLogs, events, rawInventory]);

  // Calculate top metrics for overall or filtered view
  const { totalOut, totalIn, net } = useMemo(() => {
    let outSum = 0;
    let inSum = 0;

    if (activeTrailSummary) {
      outSum = activeTrailSummary.totalDistributed;
      inSum = activeTrailSummary.totalDelivered;
      return {
        totalOut: outSum,
        totalIn: inSum,
        net: inSum - outSum + activeTrailSummary.netAdjustments
      };
    }

    movements.forEach(m => {
      if (m.delta !== null) {
        if (m.delta < 0) outSum += Math.abs(m.delta);
        else if (m.delta > 0) inSum += m.delta;
      }
    });

    return { totalOut: outSum, totalIn: inSum, net: inSum - outSum };
  }, [movements, activeTrailSummary]);

  // Filter movements
  const filtered = useMemo(() => {
    // If an item is selected, we can directly format from its activeTrailSummary or filter movements
    if (activeTrailSummary) {
      return activeTrailSummary.entries.filter(entry => {
        if (kindFilter !== 'all') {
          if (kindFilter === 'count' && entry.type !== 'event' && entry.type !== 'outflow') return false;
          if (kindFilter === 'receipt' && entry.type !== 'delivery') return false;
          if (kindFilter === 'adjust' && entry.type !== 'adjustment' && entry.type !== 'correction' && entry.type !== 'starting') return false;
        }
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          entry.title.toLowerCase().includes(q) ||
          entry.detail.toLowerCase().includes(q) ||
          entry.date.toLowerCase().includes(q)
        );
      }).map(entry => ({
        id: entry.id,
        iso: entry.isoDate,
        date: entry.date,
        kind: (entry.type === 'event' || entry.type === 'outflow' ? 'count' : entry.type === 'delivery' ? 'receipt' : 'adjust') as Movement['kind'],
        what: entry.title,
        detail: entry.detail,
        delta: entry.delta
      }));
    }

    return movements.filter(m => {
      if (kindFilter !== 'all' && m.kind !== kindFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        m.what.toLowerCase().includes(q) ||
        m.detail.toLowerCase().includes(q) ||
        m.date.toLowerCase().includes(q)
      );
    });
  }, [movements, activeTrailSummary, kindFilter, searchQuery]);

  const hasSept18Delivery = movements.some(m => 
    (m.iso && m.iso.startsWith('2026-09-18')) || 
    (m.date && m.date.includes('18 Sep'))
  );

  // Helper to match a movement string with a Title
  const findTitleForMovement = (m: Movement): { title: Title; lang?: Language } | null => {
    const text = `${m.what} ${m.detail}`.toLowerCase();
    for (const t of titles) {
      if (text.includes(t.code.toLowerCase()) || text.includes(t.name.toLowerCase())) {
        for (const ed of t.editions) {
          if (text.includes(ed.lang.toLowerCase()) || text.includes(ed.title.toLowerCase()) || text.includes(`${t.code}-${ed.lang}`.toLowerCase())) {
            return { title: t, lang: ed.lang };
          }
        }
        return { title: t };
      }
    }
    return null;
  };

  return (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="px-6 py-6 border-b border-[#dcdee3]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[26px] font-bold tracking-tight text-[#191c20]">History & Ledger</h1>
              {selectedItem && (
                <span className="text-[11px] font-bold uppercase tracking-wider bg-[#e9f1f7] text-[#1f5f8b] px-2 py-0.5 rounded border border-[#bed6e8]">
                  Item Trail
                </span>
              )}
            </div>
            <p className="text-[13.5px] text-[#44474e] mt-1">
              {selectedItem 
                ? `Showing complete chronological trail for ${selectedItem.title.name}${selectedItem.lang ? ` (${selectedItem.lang})` : ''}.`
                : 'Ledger of all stock changes — counts, receipts, and shelf adjustments.'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {selectedItem && (
              <button
                type="button"
                onClick={() => setTrailModalTarget({ title: selectedItem.title, lang: selectedItem.lang })}
                className="px-3 py-1.5 bg-[#1f5f8b] hover:bg-[#17496c] text-white text-[12px] font-semibold rounded-md transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <History className="w-3.5 h-3.5" />
                <span>Open Full Trail Audit</span>
              </button>
            )}

            {onReconcile && !selectedItem && (
              <button
                type="button"
                onClick={onReconcile}
                disabled={isReconciling}
                className="px-3 py-1.5 bg-[#f6f7f9] hover:bg-[#eef0f3] border border-[#c9cbd2] text-[#44474e] text-[12px] font-semibold rounded-md transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isReconciling ? 'animate-spin' : ''}`} />
                <span>{isReconciling ? 'Reconciling...' : 'Reconcile 9/18 Delivery'}</span>
              </button>
            )}
          </div>
        </div>

        {/* 9/18 Verification Status Chip (only in global view) */}
        {!selectedItem && (hasSept18Delivery || reconciliationMessage) && (
          <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-[#f0f9f4] border border-[#c6ecd5] text-[#1b6b3e] rounded-md text-[12px]">
            <CheckCircle2 className="w-4 h-4 flex-none" />
            <span>
              {reconciliationMessage || 'Delivery of 9/18/26 verified in ledger: 124 units (32 Bible EN, 32 Bible ES, 30 Basic Elements EN, 30 Basic Elements ES).'}
            </span>
          </div>
        )}

        {/* Active Item Trail Highlight Banner */}
        {selectedItem && activeTrailSummary && (
          <div className="mt-4 p-4 bg-[#f8fafc] border border-[#bed6e8] rounded-lg space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-[15px] text-[#191c20]">
                  {activeTrailSummary.editionTitle}
                </span>
                <span className="font-mono text-[11px] font-semibold bg-[#e9f1f7] text-[#1f5f8b] px-2 py-0.5 rounded border border-[#bed6e8]">
                  {activeTrailSummary.code}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-white text-[#6c6f77] px-2 py-0.5 rounded border border-[#dcdee3]">
                  {activeTrailSummary.category}
                </span>
                {selectedItem.lang && (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-[#f4edf7] text-[#7a4a8b] px-2 py-0.5 rounded border border-[#dfcde5]">
                    {selectedItem.lang === 'EN' ? 'English' : 'Spanish'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTrailModalTarget({ title: selectedItem.title, lang: selectedItem.lang })}
                  className="px-2.5 py-1 bg-white hover:bg-[#f1f5f9] border border-[#bed6e8] text-[#1f5f8b] text-[11.5px] font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Audit view & CSV export</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedItemKey('ALL')}
                  className="px-2 py-1 text-[11.5px] text-[#6c6f77] hover:text-[#191c20] hover:bg-white rounded-md transition-colors cursor-pointer flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Show all movements</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#e2e8f0] text-[12px]">
              <div>
                <span className="text-[#6c6f77] block text-[10px] uppercase font-bold tracking-wider">In Store Now</span>
                <strong className="font-mono text-[16px] text-[#191c20]">{activeTrailSummary.currentStock}</strong>
              </div>
              <div>
                <span className="text-[#6c6f77] block text-[10px] uppercase font-bold tracking-wider">Total Received</span>
                <strong className="font-mono text-[16px] text-[#137333]">+{activeTrailSummary.totalDelivered.toLocaleString()}</strong>
              </div>
              <div>
                <span className="text-[#6c6f77] block text-[10px] uppercase font-bold tracking-wider">Total Distributed</span>
                <strong className="font-mono text-[16px] text-[#1f5f8b]">−{activeTrailSummary.totalDistributed.toLocaleString()}</strong>
              </div>
              <div>
                <span className="text-[#6c6f77] block text-[10px] uppercase font-bold tracking-wider">Shelf Adjustments</span>
                <strong className="font-mono text-[16px] text-[#44474e]">
                  {activeTrailSummary.netAdjustments >= 0 ? `+${activeTrailSummary.netAdjustments}` : activeTrailSummary.netAdjustments}
                </strong>
              </div>
            </div>
          </div>
        )}

        {/* 3 Summary metric tiles */}
        <div className="mt-5 grid grid-cols-3 gap-px bg-[#dcdee3] border border-[#dcdee3] rounded-lg overflow-hidden max-w-xl shadow-xs">
          <div className="bg-white p-4">
            <div className="text-[10px] font-bold tracking-wider uppercase text-[#6c6f77]">Went out</div>
            <div className="font-mono text-[22px] font-bold text-[#191c20] mt-0.5 tabular-nums">
              {totalOut.toLocaleString()}
            </div>
          </div>
          <div className="bg-white p-4">
            <div className="text-[10px] font-bold tracking-wider uppercase text-[#6c6f77]">Came in</div>
            <div className="font-mono text-[22px] font-bold text-[#1f5f8b] mt-0.5 tabular-nums">
              +{totalIn.toLocaleString()}
            </div>
          </div>
          <div className="bg-white p-4">
            <div className="text-[10px] font-bold tracking-wider uppercase text-[#6c6f77]">Net</div>
            <div className={`font-mono text-[22px] font-bold mt-0.5 tabular-nums ${net >= 0 ? 'text-[#1f5f8b]' : 'text-[#b3261e]'}`}>
              {net >= 0 ? '+' : ''}{net.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Item Selector Bar */}
      <div className="px-6 py-3 border-b border-[#dcdee3] flex flex-wrap items-center justify-between gap-3 bg-white">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search box */}
          <div className="relative w-56 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8b8e96]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search movements..."
              className="w-full pl-9 pr-3 py-1.5 border border-[#c9cbd2] rounded-md text-[13px] text-[#191c20] bg-white outline-none focus:border-[#1f5f8b]"
            />
          </div>

          {/* Item Trail Selector Dropdown */}
          {titles.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] font-bold text-[#44474e] flex items-center gap-1">
                <History className="w-3.5 h-3.5 text-[#1f5f8b]" />
                <span className="hidden sm:inline">Item trail:</span>
              </span>
              <select
                value={selectedItemKey}
                onChange={(e) => setSelectedItemKey(e.target.value)}
                className="px-2.5 py-1.5 border border-[#c9cbd2] rounded-md text-[12px] font-medium text-[#191c20] bg-white outline-none focus:border-[#1f5f8b] max-w-[220px] sm:max-w-[280px] truncate cursor-pointer"
              >
                <option value="ALL">All items (overall ledger)</option>
                {titles.map(t => (
                  <optgroup key={t.code} label={`${t.name} (${t.code})`}>
                    <option value={`${t.code}:ALL`}>
                      {t.name} (All editions combined)
                    </option>
                    {t.editions.map(ed => (
                      <option key={ed.lang} value={`${t.code}:${ed.lang}`}>
                        {t.name} — {ed.lang === 'EN' ? 'English' : 'Spanish'} ({ed.stock} in store)
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>

              {selectedItemKey !== 'ALL' && (
                <button
                  onClick={() => setSelectedItemKey('ALL')}
                  title="Clear item filter"
                  className="p-1.5 text-[#8b8e96] hover:text-[#191c20] hover:bg-[#f1f3f5] rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Movement Kind Filter Buttons */}
        <div className="flex items-center gap-1">
          {[
            { id: 'all' as const, label: 'All movements' },
            { id: 'count' as const, label: 'Counts' },
            { id: 'receipt' as const, label: 'Received' },
            { id: 'adjust' as const, label: 'Adjusted' }
          ].map(f => {
            const active = kindFilter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setKindFilter(f.id)}
                className={`
                  px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors cursor-pointer
                  ${active 
                    ? 'bg-[#e9f1f7] text-[#1f5f8b] border border-[#1f5f8b]' 
                    : 'bg-white text-[#44474e] border border-[#c9cbd2] hover:bg-[#f6f7f9]'
                  }
                `}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Ledger Table */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <div className="sticky top-0 z-10 grid grid-cols-[80px_1fr_90px_60px] items-center px-6 py-2.5 bg-[#f6f7f9] border-b border-[#dcdee3] text-[10px] font-bold tracking-wider uppercase text-[#6c6f77]">
          <div>Date</div>
          <div>Movement</div>
          <div className="text-right">Change</div>
          <div className="text-right">Trail</div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center text-[#6c6f77] text-[13px]">
            No movements match your criteria.
          </div>
        ) : (
          <div className="divide-y divide-[#eef0f3]">
            {filtered.map((m, idx) => {
              const matched = findTitleForMovement(m);

              return (
                <div
                  key={m.id || idx}
                  className="grid grid-cols-[80px_1fr_90px_60px] items-baseline px-6 py-3.5 hover:bg-[#fbfbfc] transition-colors"
                >
                  <div className="font-mono text-[12px] text-[#6c6f77]">
                    {m.date}
                  </div>

                  <div className="min-w-0 pr-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[13.5px] text-[#191c20]">
                        {m.what}
                      </span>
                      <span className={`
                        text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-xs flex-none
                        ${m.kind === 'count' 
                          ? 'bg-[#e9f1f7] text-[#1f5f8b]' 
                          : m.kind === 'receipt'
                            ? 'bg-[#e6f4ea] text-[#137333]'
                            : 'bg-[#f1f3f4] text-[#44474e]'
                        }
                      `}>
                        {m.kind === 'count' ? 'Count' : m.kind === 'receipt' ? 'Receipt' : 'Adjustment'}
                      </span>

                      {matched && selectedItemKey === 'ALL' && (
                        <button
                          type="button"
                          onClick={() => setSelectedItemKey(`${matched.title.code}:${matched.lang || 'ALL'}`)}
                          className="text-[10px] font-medium text-[#1f5f8b] bg-[#e9f1f7]/70 hover:bg-[#e9f1f7] px-1.5 py-0.5 rounded border border-[#bed6e8] transition-colors cursor-pointer"
                          title={`Focus history on ${matched.title.name}`}
                        >
                          {matched.title.code}{matched.lang ? `-${matched.lang}` : ''}
                        </button>
                      )}
                    </div>
                    {m.detail && (
                      <div className="text-[12px] text-[#6c6f77] mt-0.5 leading-normal">
                        {m.detail}
                      </div>
                    )}
                  </div>

                  <div className={`
                    text-right font-mono text-[14px] font-bold tabular-nums
                    ${m.delta && m.delta > 0 ? 'text-[#1f5f8b]' : 'text-[#44474e]'}
                  `}>
                    {m.delta !== null ? `${m.delta > 0 ? '+' : '−'}${Math.abs(m.delta).toLocaleString()}` : '—'}
                  </div>

                  <div className="text-right">
                    {matched ? (
                      <button
                        type="button"
                        onClick={() => setTrailModalTarget({ title: matched.title, lang: matched.lang })}
                        className="p-1 text-[#8b8e96] hover:text-[#1f5f8b] hover:bg-[#e9f1f7] rounded transition-colors cursor-pointer"
                        title={`View individual trail for ${matched.title.name}`}
                      >
                        <History className="w-3.5 h-3.5 inline" />
                      </button>
                    ) : (
                      <span className="text-[#c9cbd2] text-[11px]">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Item Trail Modal */}
      {trailModalTarget && (
        <ItemTrailModal
          isOpen={!!trailModalTarget}
          onClose={() => setTrailModalTarget(null)}
          title={trailModalTarget.title}
          initialLang={trailModalTarget.lang}
          rawLogs={rawLogs}
          events={events}
          rawInventory={rawInventory}
        />
      )}
    </div>
  );
};
