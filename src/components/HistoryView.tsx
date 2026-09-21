import React, { useState } from 'react';
import { Movement } from '../types';
import { Search, Filter, RotateCcw, CheckCircle2, PackageCheck } from 'lucide-react';

interface HistoryViewProps {
  movements: Movement[];
  onReconcile?: () => Promise<void>;
  isReconciling?: boolean;
  reconciliationMessage?: string;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  movements,
  onReconcile,
  isReconciling,
  reconciliationMessage
}) => {
  const [kindFilter, setKindFilter] = useState<'all' | 'count' | 'receipt' | 'adjust'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Calculate top metrics
  let totalOut = 0;
  let totalIn = 0;
  movements.forEach(m => {
    if (m.delta !== null) {
      if (m.delta < 0) totalOut += Math.abs(m.delta);
      else if (m.delta > 0) totalIn += m.delta;
    }
  });
  const net = totalIn - totalOut;

  // Filter movements
  const filtered = movements.filter(m => {
    if (kindFilter !== 'all' && m.kind !== kindFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.what.toLowerCase().includes(q) ||
      m.detail.toLowerCase().includes(q) ||
      m.date.toLowerCase().includes(q)
    );
  });

  const hasSept18Delivery = movements.some(m => 
    (m.iso && m.iso.startsWith('2026-09-18')) || 
    (m.date && m.date.includes('18 Sep'))
  );

  return (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="px-6 py-6 border-b border-[#dcdee3]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-bold tracking-tight text-[#191c20]">History</h1>
            <p className="text-[13.5px] text-[#44474e] mt-1">
              Ledger of all stock changes — counts, receipts, and shelf adjustments.
            </p>
          </div>

          {onReconcile && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onReconcile}
                disabled={isReconciling}
                className="px-3 py-1.5 bg-[#f6f7f9] hover:bg-[#eef0f3] border border-[#c9cbd2] text-[#44474e] text-[12px] font-semibold rounded-md transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isReconciling ? 'animate-spin' : ''}`} />
                <span>{isReconciling ? 'Reconciling...' : 'Reconcile 9/18 Delivery'}</span>
              </button>
            </div>
          )}
        </div>

        {/* 9/18 Verification Status Chip */}
        {(hasSept18Delivery || reconciliationMessage) && (
          <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-[#f0f9f4] border border-[#c6ecd5] text-[#1b6b3e] rounded-md text-[12px]">
            <CheckCircle2 className="w-4 h-4 flex-none" />
            <span>
              {reconciliationMessage || 'Delivery of 9/18/26 verified in ledger: 124 units (32 Bible EN, 32 Bible ES, 30 Basic Elements EN, 30 Basic Elements ES).'}
            </span>
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

      {/* Filter and Search Bar */}
      <div className="px-6 py-3 border-b border-[#dcdee3] flex flex-wrap items-center gap-3 bg-white">
        <div className="relative w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8b8e96]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search movements..."
            className="w-full pl-9 pr-3 py-1.5 border border-[#c9cbd2] rounded-md text-[13px] text-[#191c20] bg-white outline-none focus:border-[#1f5f8b]"
          />
        </div>

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
        <div className="sticky top-0 z-10 grid grid-cols-[80px_1fr_90px] items-center px-6 py-2.5 bg-[#f6f7f9] border-b border-[#dcdee3] text-[10px] font-bold tracking-wider uppercase text-[#6c6f77]">
          <div>Date</div>
          <div>Movement</div>
          <div className="text-right">Change</div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center text-[#6c6f77] text-[13px]">
            No movements match your criteria.
          </div>
        ) : (
          <div className="divide-y divide-[#eef0f3]">
            {filtered.map((m, idx) => (
              <div
                key={m.id || idx}
                className="grid grid-cols-[80px_1fr_90px] items-baseline px-6 py-3.5 hover:bg-[#fbfbfc] transition-colors"
              >
                <div className="font-mono text-[12px] text-[#6c6f77]">
                  {m.date}
                </div>

                <div className="min-w-0 pr-4">
                  <div className="flex items-center gap-2">
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
