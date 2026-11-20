import React, { useState, useMemo } from 'react';
import { Title, EventItem, Language } from '../types';
import { 
  X, 
  History, 
  Download, 
  Calendar, 
  User, 
  SlidersHorizontal, 
  Package, 
  ArrowUpRight, 
  ArrowDownRight, 
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  ArrowUpDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { buildItemTrail, ItemTrailEntry } from '../services/itemTrailService';
import { exportToCSV } from '../lib/csvExport';

interface ItemTrailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: Title | null;
  initialLang?: Language;
  rawLogs?: any[];
  events?: EventItem[];
  rawInventory?: any[];
  onStartAdjust?: (code: string, currentStock: number) => void;
}

export const ItemTrailModal: React.FC<ItemTrailModalProps> = ({
  isOpen,
  onClose,
  title,
  initialLang,
  rawLogs = [],
  events = [],
  rawInventory = [],
  onStartAdjust
}) => {
  const [selectedLang, setSelectedLang] = useState<Language | 'ALL'>(initialLang || 'ALL');
  const [filterType, setFilterType] = useState<'all' | 'event' | 'delivery' | 'adjustment'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc'); // 'desc' = latest on top

  // Keep selectedLang updated if initialLang changes
  React.useEffect(() => {
    if (initialLang) {
      setSelectedLang(initialLang);
    } else {
      setSelectedLang('ALL');
    }
  }, [initialLang, title?.code]);

  const trailSummary = useMemo(() => {
    if (!title) return null;
    return buildItemTrail({
      title,
      editionLang: selectedLang === 'ALL' ? undefined : selectedLang,
      rawLogs,
      events,
      rawInventory
    });
  }, [title, selectedLang, rawLogs, events, rawInventory]);

  // Filter and sort trail entries (default: latest on top)
  const filteredEntries = useMemo(() => {
    if (!trailSummary) return [];
    const list = trailSummary.entries.filter(entry => {
      if (filterType !== 'all') {
        if (filterType === 'event' && entry.type !== 'event' && entry.type !== 'outflow') return false;
        if (filterType === 'delivery' && entry.type !== 'delivery') return false;
        if (filterType === 'adjustment' && entry.type !== 'adjustment' && entry.type !== 'correction' && entry.type !== 'starting') return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          entry.title.toLowerCase().includes(q) ||
          entry.detail.toLowerCase().includes(q) ||
          entry.date.toLowerCase().includes(q) ||
          (entry.note && entry.note.toLowerCase().includes(q)) ||
          (entry.user && entry.user.toLowerCase().includes(q)) ||
          (entry.location && entry.location.toLowerCase().includes(q))
        );
      }
      return true;
    });

    list.sort((a, b) => {
      const diff = b.timestamp - a.timestamp;
      if (diff !== 0) {
        return sortOrder === 'desc' ? diff : -diff;
      }
      const isoDiff = (b.isoDate || '').localeCompare(a.isoDate || '');
      if (isoDiff !== 0) {
        return sortOrder === 'desc' ? isoDiff : -isoDiff;
      }
      return sortOrder === 'desc' ? b.id.localeCompare(a.id) : a.id.localeCompare(b.id);
    });

    return list;
  }, [trailSummary, filterType, searchQuery, sortOrder]);

  if (!isOpen || !title || !trailSummary) return null;

  const handleExportTrailCSV = () => {
    const rows = filteredEntries.map(e => ({
      Date: e.date,
      Type: e.typeLabel,
      Title: e.title,
      Detail: e.detail,
      Change: e.delta !== null ? (e.delta > 0 ? `+${e.delta}` : `${e.delta}`) : '',
      LoggedBy: e.user || 'Admin',
      Language: e.lang || selectedLang
    }));
    exportToCSV(rows, `${title.code}_${selectedLang}_trail`);
  };

  const isLowStock = trailSummary.currentStock < trailSummary.reorderPoint;
  const isOutOfStock = trailSummary.currentStock === 0;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#0f172a]/50 backdrop-blur-sm"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-3xl bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-[#dcdee3]"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#dcdee3] bg-[#fbfbfc] flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="p-1.5 rounded-md bg-[#e9f1f7] text-[#1f5f8b]">
                  <History className="w-4 h-4" />
                </span>
                <h2 className="text-[17px] font-bold text-[#191c20] tracking-tight truncate">
                  {trailSummary.editionTitle}
                </h2>
                <span className="font-mono text-[11px] font-semibold bg-[#f1f3f5] text-[#44474e] px-2 py-0.5 rounded border border-[#dcdee3]">
                  {trailSummary.code}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-[#f6f7f9] text-[#6c6f77] px-2 py-0.5 rounded border border-[#dcdee3]">
                  {title.cat}
                </span>
              </div>
              <p className="text-[12px] text-[#6c6f77] mt-1">
                Complete activity trail — outreach event distributions, delivery receipts, and shelf adjustments.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-none">
              <button
                onClick={handleExportTrailCSV}
                title="Export this item's trail as CSV"
                className="px-2.5 py-1.5 border border-[#c9cbd2] bg-white hover:bg-[#f6f7f9] text-[#44474e] text-[11.5px] font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 text-[#6c6f77]" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>
              <button
                onClick={onClose}
                className="p-1.5 text-[#6c6f77] hover:text-[#191c20] hover:bg-[#f1f3f5] rounded-md transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Language Edition Selector Tabs */}
          <div className="px-6 py-2.5 bg-[#f6f7f9] border-b border-[#dcdee3] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#6c6f77] mr-1">
                Edition:
              </span>
              <button
                onClick={() => setSelectedLang('ALL')}
                className={`px-3 py-1 rounded-md text-[11.5px] font-semibold transition-colors cursor-pointer ${
                  selectedLang === 'ALL'
                    ? 'bg-[#1f5f8b] text-white'
                    : 'bg-white text-[#44474e] border border-[#c9cbd2] hover:bg-[#f1f3f5]'
                }`}
              >
                All editions combined
              </button>
              {title.editions.map(ed => (
                <button
                  key={ed.lang}
                  onClick={() => setSelectedLang(ed.lang)}
                  className={`px-3 py-1 rounded-md text-[11.5px] font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    selectedLang === ed.lang
                      ? 'bg-[#1f5f8b] text-white'
                      : 'bg-white text-[#44474e] border border-[#c9cbd2] hover:bg-[#f1f3f5]'
                  }`}
                >
                  <span className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                    selectedLang === ed.lang ? 'bg-white/20 text-white' : 'bg-[#eef0f3] text-[#44474e]'
                  }`}>
                    {ed.lang}
                  </span>
                  <span>{ed.lang === 'EN' ? 'English' : 'Spanish'} ({ed.stock})</span>
                </button>
              ))}
            </div>

            {onStartAdjust && (
              <button
                onClick={() => {
                  const targetCode = selectedLang === 'ALL' ? `${title.code}-EN` : `${title.code}-${selectedLang}`;
                  onStartAdjust(targetCode, trailSummary.currentStock);
                  onClose();
                }}
                className="px-2.5 py-1 text-[11.5px] font-semibold text-[#1f5f8b] hover:bg-[#e9f1f7] rounded-md transition-colors cursor-pointer border border-[#bed6e8]"
              >
                + Adjust shelf stock
              </button>
            )}
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[#dcdee3] border-b border-[#dcdee3] bg-white">
            <div className="bg-white p-3.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#6c6f77] flex items-center justify-between">
                <span>In store now</span>
                {isOutOfStock ? (
                  <span className="text-[9px] px-1.5 py-0.2 rounded font-bold text-[#b3261e] bg-[#fdeceb] border border-[#f4cfcd]">
                    Out
                  </span>
                ) : isLowStock ? (
                  <span className="text-[9px] px-1.5 py-0.2 rounded font-bold text-[#8a5a00] bg-[#fdf0d8] border border-[#f2d9a8]">
                    Low
                  </span>
                ) : (
                  <span className="text-[9px] px-1.5 py-0.2 rounded font-bold text-[#137333] bg-[#e6f4ea] border border-[#bce2c7]">
                    Healthy
                  </span>
                )}
              </div>
              <div className={`font-mono text-[22px] font-bold mt-0.5 tabular-nums ${
                isOutOfStock ? 'text-[#b3261e]' : isLowStock ? 'text-[#8a5a00]' : 'text-[#191c20]'
              }`}>
                {trailSummary.currentStock}
              </div>
              <div className="text-[10.5px] text-[#6c6f77] mt-0.5">
                Reorder point: {trailSummary.reorderPoint} · Pack: {trailSummary.packSize}
              </div>
            </div>

            <div className="bg-white p-3.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#6c6f77]">
                Total received
              </div>
              <div className="font-mono text-[22px] font-bold text-[#137333] mt-0.5 tabular-nums">
                +{trailSummary.totalDelivered.toLocaleString()}
              </div>
              <div className="text-[10.5px] text-[#6c6f77] mt-0.5">
                From shipments & deliveries
              </div>
            </div>

            <div className="bg-white p-3.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#6c6f77]">
                Total distributed
              </div>
              <div className="font-mono text-[22px] font-bold text-[#1f5f8b] mt-0.5 tabular-nums">
                −{trailSummary.totalDistributed.toLocaleString()}
              </div>
              <div className="text-[10.5px] text-[#6c6f77] mt-0.5">
                Across {trailSummary.eventCount} outreach event{trailSummary.eventCount === 1 ? '' : 's'}
              </div>
            </div>

            <div className="bg-white p-3.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#6c6f77]">
                Shelf adjustments
              </div>
              <div className={`font-mono text-[22px] font-bold mt-0.5 tabular-nums ${
                trailSummary.netAdjustments >= 0 ? 'text-[#1f5f8b]' : 'text-[#44474e]'
              }`}>
                {trailSummary.netAdjustments >= 0 ? `+${trailSummary.netAdjustments}` : trailSummary.netAdjustments}
              </div>
              <div className="text-[10.5px] text-[#6c6f77] mt-0.5">
                Net manual recounts & changes
              </div>
            </div>
          </div>

          {/* Trail Search & Filter Bar */}
          <div className="px-6 py-3 border-b border-[#dcdee3] flex flex-wrap items-center justify-between gap-3 bg-white">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8b8e96]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search events, notes, users..."
                className="w-full pl-8 pr-2.5 py-1.5 border border-[#c9cbd2] rounded-md text-[12px] text-[#191c20] bg-white outline-none focus:border-[#1f5f8b]"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                {[
                  { id: 'all' as const, label: `All (${trailSummary.totalEntries})` },
                  { id: 'event' as const, label: 'Outreach Events' },
                  { id: 'delivery' as const, label: 'Deliveries' },
                  { id: 'adjustment' as const, label: 'Shelf Recounts' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFilterType(f.id)}
                    className={`px-2.5 py-1 rounded-md text-[11.5px] font-semibold transition-colors cursor-pointer ${
                      filterType === f.id
                        ? 'bg-[#e9f1f7] text-[#1f5f8b] border border-[#1f5f8b]'
                        : 'bg-white text-[#44474e] border border-[#c9cbd2] hover:bg-[#f6f7f9]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Sort Order Toggle */}
              <button
                onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                title={sortOrder === 'desc' ? 'Currently sorted latest on top. Click to sort oldest first.' : 'Currently sorted oldest first. Click to sort latest on top.'}
                className="px-2.5 py-1 border border-[#c9cbd2] bg-white hover:bg-[#f6f7f9] text-[#1f5f8b] text-[11.5px] font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-[#1f5f8b]" />
                <span>{sortOrder === 'desc' ? 'Latest on top' : 'Oldest first'}</span>
              </button>
            </div>
          </div>

          {/* Chronological Trail Ledger */}
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 space-y-4">
            {filteredEntries.length === 0 ? (
              <div className="py-12 text-center text-[#6c6f77] space-y-2">
                <Package className="w-10 h-10 mx-auto text-[#c9cbd2]" />
                <p className="font-semibold text-[14px] text-[#191c20]">No trail entries found</p>
                <p className="text-[12px] text-[#6c6f77] max-w-sm mx-auto">
                  {searchQuery 
                    ? `No activity matching "${searchQuery}". Try clearing search.`
                    : 'Activity is automatically logged when items are taken to outreach events, received in orders, or adjusted on the shelf.'}
                </p>
              </div>
            ) : (
              <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-[#dcdee3]">
                {filteredEntries.map((entry) => {
                  const isPositive = entry.delta !== null && entry.delta > 0;
                  const isNegative = entry.delta !== null && entry.delta < 0;

                  return (
                    <div key={entry.id} className="relative group">
                      {/* Timeline Dot */}
                      <div className={`absolute -left-[27px] top-1.5 w-3 h-3 rounded-full border-2 border-white ${
                        entry.type === 'delivery'
                          ? 'bg-[#137333]'
                          : entry.type === 'event'
                            ? 'bg-[#1f5f8b]'
                            : entry.type === 'correction'
                              ? 'bg-[#7a4a8b]'
                              : 'bg-[#6c6f77]'
                      }`} />

                      {/* Card */}
                      <div className="p-3.5 bg-white border border-[#dcdee3] rounded-lg shadow-2xs hover:border-[#1f5f8b]/40 transition-colors space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${entry.badgeClass}`}>
                              {entry.typeLabel}
                            </span>
                            {entry.lang && (
                              <span className="font-mono text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-[#f1f3f5] text-[#44474e] border border-[#dcdee3]">
                                {entry.lang}
                              </span>
                            )}
                            <span className="text-[13.5px] font-bold text-[#191c20]">
                              {entry.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            {entry.delta !== null && (
                              <span className={`font-mono text-[14px] font-bold tabular-nums ${
                                isPositive 
                                  ? 'text-[#137333]' 
                                  : isNegative 
                                    ? 'text-[#1f5f8b]' 
                                    : 'text-[#44474e]'
                              }`}>
                                {isPositive ? `+${entry.delta}` : entry.delta}
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-[12.5px] text-[#44474e] leading-relaxed">
                          {entry.detail}
                        </p>

                        {/* Metadata Footer */}
                        <div className="pt-2 border-t border-[#f1f3f5] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#8b8e96]">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-[#8b8e96]" />
                            <span className="font-mono">{entry.date}</span>
                            {entry.location && (
                              <span className="ml-2 font-sans font-medium text-[#6c6f77]">
                                • {entry.location}
                              </span>
                            )}
                          </div>

                          {entry.user && (
                            <div className="flex items-center gap-1 font-medium text-[#6c6f77]">
                              <User className="w-3 h-3 text-[#8b8e96]" />
                              <span>{entry.user}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 bg-[#fbfbfc] border-t border-[#dcdee3] flex items-center justify-between gap-4">
            <span className="text-[11.5px] text-[#6c6f77]">
              Showing {filteredEntries.length} of {trailSummary.totalEntries} trail record{trailSummary.totalEntries === 1 ? '' : 's'} · {sortOrder === 'desc' ? 'sorted latest on top' : 'sorted oldest first'}
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-[#191c20] hover:bg-[#2c3036] text-white text-[12px] font-semibold rounded-md transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ItemTrailModal;
