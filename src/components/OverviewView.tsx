import React from 'react';
import { Title, EventItem, Movement, OrderItem } from '../types';
import { ArrowRight, ShoppingCart, Play, SlidersHorizontal } from 'lucide-react';

interface OverviewViewProps {
  titles: Title[];
  events: EventItem[];
  movements: Movement[];
  orders: OrderItem[];
  onNavigate: (tab: 'inventory' | 'events' | 'order') => void;
  onStartCount: () => void;
  onAddAllToOrderList: () => void;
  reorderSensitivity?: number;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  titles,
  events,
  movements,
  orders,
  onNavigate,
  onStartCount,
  onAddAllToOrderList,
  reorderSensitivity = 1
}) => {
  const reorderAt = (t: Title) => Math.round(t.reorder * reorderSensitivity);

  // Map order items by key
  const orderMap: Record<string, OrderItem> = {};
  orders.forEach(o => { orderMap[o.key] = o; });

  // Calculate flagged items
  interface FlaggedItem {
    title: Title;
    edition: Title['editions'][0];
    at: number;
    out: boolean;
    ratio: number;
    suggest: number;
    onOrder?: OrderItem;
  }

  const flagged: FlaggedItem[] = [];
  titles.forEach(t => {
    t.editions.forEach(ed => {
      const at = reorderAt(t);
      if (ed.stock === 0 || ed.stock < at) {
        const target = at * 2;
        const need = Math.max(target - ed.stock, t.pack);
        const suggest = Math.ceil(need / t.pack) * t.pack;
        const key = `${t.code}-${ed.lang}`;
        flagged.push({
          title: t,
          edition: ed,
          at,
          out: ed.stock === 0,
          ratio: at ? ed.stock / at : 0,
          suggest,
          onOrder: orderMap[key]
        });
      }
    });
  });

  flagged.sort((a, b) => a.ratio - b.ratio);

  const outCount = flagged.filter(f => f.out).length;
  const lowCount = flagged.length - outCount;

  // Next planned event & last posted event
  const plannedEvents = events.filter(e => e.planned).sort((a, b) => a.date.localeCompare(b.date));
  const nextEvent = plannedEvents[0];

  const postedEvents = events.filter(e => !e.planned).sort((a, b) => b.date.localeCompare(a.date));
  const lastPosted = postedEvents[0];
  const lastPassedCount = lastPosted ? lastPosted.lines.reduce((sum, l) => sum + (l.took - l.back), 0) : 0;

  const formatDateShort = (iso: string) => {
    try {
      const [y, m, d] = iso.split('-').map(Number);
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      return `${d} ${months[m - 1]} ${y}`;
    } catch {
      return iso;
    }
  };

  // Headline string
  const headlineParts: string[] = [];
  if (outCount > 0) headlineParts.push(`${outCount} ${outCount === 1 ? 'edition is out of stock' : 'editions are out of stock'}`);
  if (lowCount > 0) headlineParts.push(`${lowCount} below the reorder point`);
  if (nextEvent) headlineParts.push(`next event in ${Math.max(1, Math.round((new Date(nextEvent.date).getTime() - new Date().getTime()) / 86400000))} days`);

  const headline = headlineParts.length > 0 
    ? headlineParts.join(' · ')
    : 'Nothing needs reordering · all stocks healthy';

  return (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="px-6 py-6 border-b border-[#dcdee3] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-[#191c20]">Overview</h1>
          <p className="text-[14px] text-[#44474e] mt-1">{headline}</p>
        </div>
        <div className="flex items-center gap-2.5 flex-none">
          <button 
            onClick={() => onNavigate('inventory')}
            className="px-3.5 py-2 border border-[#c9cbd2] bg-white hover:bg-[#f6f7f9] text-[#44474e] font-semibold text-[13px] rounded-md transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Adjust stock</span>
          </button>
          <button 
            onClick={onStartCount}
            className="px-4 py-2 border border-[#1f5f8b] bg-[#1f5f8b] hover:bg-[#17496c] text-white font-semibold text-[13px] rounded-md transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Start a count</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {/* Running low section */}
        <div className="px-6 pt-6 pb-2 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-[18px] font-bold tracking-tight text-[#191c20]">Running low</h2>
            <p className="text-[13px] text-[#6c6f77] mt-1">
              Most urgent first, by how far each edition has fallen below its reorder point.
            </p>
          </div>
          {flagged.length > 0 && (
            <button
              onClick={onAddAllToOrderList}
              className="px-3.5 py-1.5 border border-[#c9cbd2] bg-white hover:bg-[#f6f7f9] text-[#44474e] font-semibold text-[13px] rounded-md transition-colors cursor-pointer flex-none flex items-center gap-1.5"
            >
              <ShoppingCart className="w-3.5 h-3.5 text-[#6c6f77]" />
              <span>Add all to order list</span>
            </button>
          )}
        </div>

        {/* Low stock table */}
        <div className="mx-6 mt-3 border border-[#dcdee3] rounded-lg overflow-hidden bg-white shadow-xs">
          <div className="grid grid-cols-[1fr_80px_90px_90px_80px_100px] items-center px-4 py-2.5 bg-[#f6f7f9] border-b border-[#dcdee3] text-[10px] font-bold tracking-wider uppercase text-[#6c6f77]">
            <div>Edition</div>
            <div>Code</div>
            <div className="text-right">In store</div>
            <div className="text-right">Reorder at</div>
            <div className="text-right">Suggest</div>
            <div className="text-right">Status</div>
          </div>

          {flagged.length === 0 ? (
            <div className="py-12 text-center text-[#6c6f77]">
              <p className="font-semibold text-[14px] text-[#191c20]">Nothing is below its reorder point.</p>
              <p className="text-[13px] mt-1">All literature editions are currently stocked above their reorder thresholds.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#eef0f3]">
              {flagged.map((item) => {
                const code = `${item.title.code}-${item.edition.lang}`;
                const onOrder = item.onOrder;
                const isOut = item.out;

                return (
                  <div
                    key={code}
                    className={`
                      grid grid-cols-[1fr_80px_90px_90px_80px_100px] items-center px-4 py-3 text-[13px] transition-colors
                      ${onOrder ? 'bg-[#fbfbfc]' : isOut ? 'bg-[#fffcfc]' : 'bg-[#fffdf7]'}
                    `}
                  >
                    {/* Title & Lang Badge */}
                    <div className="min-w-0 flex items-baseline gap-2.5 pr-3">
                      <span className={`
                        text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded-xs flex-none
                        ${item.edition.lang === 'EN' ? 'text-[#1f5f8b] bg-[#e9f1f7]' : 'text-[#7a4a8b] bg-[#f4edf7]'}
                      `}>
                        {item.edition.lang}
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold text-[#191c20] text-[13.5px] leading-snug truncate">
                          {item.edition.title}
                        </div>
                        <div className="text-[11.5px] text-[#8b8e96] mt-0.5 truncate">
                          {onOrder 
                            ? `${onOrder.qty.toLocaleString()} on order since ${onOrder.orderedDate}`
                            : isOut
                              ? 'Nothing in store — cannot be taken out'
                              : `${item.at - item.edition.stock} below reorder point`
                          }
                        </div>
                      </div>
                    </div>

                    {/* Code */}
                    <div className="font-mono text-[11px] text-[#6c6f77] truncate">
                      {code}
                    </div>

                    {/* In Store */}
                    <div className={`
                      text-right font-mono text-[14px] font-bold tabular-nums
                      ${isOut ? 'text-[#b3261e]' : 'text-[#8a5a00]'}
                    `}>
                      {item.edition.stock}
                    </div>

                    {/* Reorder At */}
                    <div className="text-right font-mono text-[13px] text-[#6c6f77] tabular-nums">
                      {item.at}
                    </div>

                    {/* Suggest */}
                    <div className="text-right font-mono text-[13.5px] font-bold text-[#191c20] tabular-nums">
                      {item.suggest}
                    </div>

                    {/* Status Pill */}
                    <div className="flex justify-end">
                      {onOrder ? (
                        <span className="text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-xs text-[#44474e] bg-[#eef0f3] border border-[#dcdee3]">
                          On order
                        </span>
                      ) : isOut ? (
                        <span className="text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-xs text-[#b3261e] bg-[#fdeceb] border border-[#f4cfcd]">
                          Out
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-xs text-[#8a5a00] bg-[#fdf0d8] border border-[#f2d9a8]">
                          Low
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="mx-6 mt-2.5 text-[11.5px] text-[#8b8e96] leading-normal">
          Suggested quantity brings the edition back to twice its reorder point, rounded up to a whole pack.
        </p>

        {/* 2-Column Grid: Next Event & Recent Movements */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 items-start">
          {/* Next Event Card */}
          <div className="border border-[#dcdee3] rounded-lg overflow-hidden bg-white shadow-xs">
            <div className="px-4 py-3 bg-[#f6f7f9] border-b border-[#dcdee3] text-[10px] font-bold tracking-wider uppercase text-[#6c6f77]">
              Next event
            </div>
            <div className="p-4">
              <div className="text-[16px] font-bold tracking-tight text-[#191c20]">
                {nextEvent ? nextEvent.location : 'No event planned'}
              </div>
              <div className="font-mono text-[12.5px] text-[#44474e] mt-1">
                {nextEvent ? formatDateShort(nextEvent.date) : 'Plan an event to reserve literature'}
              </div>
              <div className="mt-3.5 p-3.5 bg-[#f6f7f9] border border-[#eef0f3] rounded-md text-[12.5px] text-[#44474e] leading-relaxed">
                {nextEvent ? (
                  <>
                    Nothing taken out yet. Taking literature out <strong>reserves</strong> it — the numbers in store only change when you post the count afterwards.
                  </>
                ) : (
                  'No outreach event is currently scheduled. Stock remains unreserved.'
                )}
              </div>
              <div className="mt-4 flex items-center gap-2.5">
                <button
                  onClick={onStartCount}
                  className="px-3.5 py-2 bg-[#1f5f8b] hover:bg-[#17496c] text-white font-semibold text-[13px] rounded-md transition-colors cursor-pointer shadow-xs"
                >
                  Take out literature
                </button>
                <button
                  onClick={() => onNavigate('events')}
                  className="px-3.5 py-2 border border-[#c9cbd2] bg-white hover:bg-[#f6f7f9] text-[#44474e] font-semibold text-[13px] rounded-md transition-colors cursor-pointer"
                >
                  All events
                </button>
              </div>
            </div>
            
            {/* Last event link */}
            <div 
              onClick={() => onNavigate('events')}
              className="px-4 py-3 border-t border-[#eef0f3] bg-[#fbfbfc] hover:bg-[#f6f7f9] flex items-center justify-between gap-3 text-[12.5px] cursor-pointer transition-colors"
            >
              <span className="text-[#6c6f77]">
                {lastPosted ? `Last event — ${lastPosted.location}, ${formatDateShort(lastPosted.date)}` : 'No counts posted yet'}
              </span>
              <span className="font-mono font-bold text-[#191c20] tabular-nums">
                {lastPosted ? `${lastPassedCount.toLocaleString()} passed out` : '—'}
              </span>
            </div>
          </div>

          {/* Recent Movements Card */}
          <div className="border border-[#dcdee3] rounded-lg overflow-hidden bg-white shadow-xs">
            <div className="px-4 py-3 bg-[#f6f7f9] border-b border-[#dcdee3] text-[10px] font-bold tracking-wider uppercase text-[#6c6f77]">
              Recent movements
            </div>
            <div className="divide-y divide-[#eef0f3]">
              {movements.slice(0, 4).map((m, idx) => (
                <div key={m.id || idx} className="grid grid-cols-[64px_1fr_64px] items-baseline gap-3 px-4 py-3">
                  <div className="font-mono text-[12px] text-[#8b8e96]">
                    {m.date}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-[13px] text-[#191c20] leading-snug">
                      {m.what}
                    </div>
                    <div className="text-[12px] text-[#6c6f77] mt-0.5 leading-normal">
                      {m.detail}
                    </div>
                  </div>
                  <div className={`
                    text-right font-mono text-[13px] font-bold tabular-nums
                    ${m.delta && m.delta > 0 ? 'text-[#1f5f8b]' : 'text-[#44474e]'}
                  `}>
                    {m.delta !== null ? `${m.delta > 0 ? '+' : '−'}${Math.abs(m.delta).toLocaleString()}` : ''}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 bg-[#fbfbfc] border-t border-[#eef0f3] text-[11.5px] text-[#8b8e96] text-center">
              Every movement is logged with full transparency.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
