import React, { useState, useMemo } from 'react';
import { ConsumableItem, UnitType } from '../types';
import { 
  Search, 
  Plus, 
  Download, 
  RotateCcw, 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2, 
  Edit2, 
  Trash2, 
  Droplets, 
  Package, 
  SlidersHorizontal,
  ChevronRight,
  Filter,
  Sparkles,
  SprayCan,
  X,
  Layers,
  Info
} from 'lucide-react';
import { exportToCSV } from '../lib/csvExport';

interface ConsumablesViewProps {
  items: ConsumableItem[];
  onUpdateItem: (item: ConsumableItem) => void | Promise<void>;
  onAddItem: (item: Omit<ConsumableItem, 'id'>) => void | Promise<void>;
  onDeleteItem: (id: string) => void | Promise<void>;
  onResetToSeed: () => void;
}

export function getConsumableStatus(item: ConsumableItem): {
  status: 'sufficient' | 'low' | 'empty';
  label: string;
  badgeBg: string;
  textColor: string;
  borderColor: string;
  dotColor: string;
} {
  const full = item.fullUnitsCount ?? 0;
  const partial = item.partialRemainingVolume ?? 0;
  const threshold = item.reorderThreshold ?? 1;

  if (full === 0 && partial === 0) {
    return {
      status: 'empty',
      label: 'Empty',
      badgeBg: 'bg-[#fef2f2]',
      textColor: 'text-[#991b1b]',
      borderColor: 'border-[#fecaca]',
      dotColor: 'bg-[#ef4444]'
    };
  }

  if (full < threshold) {
    return {
      status: full === 0 ? 'empty' : 'low',
      label: full === 0 ? 'Partial Only (Low)' : 'Low Stock',
      badgeBg: full === 0 ? 'bg-[#fffbeb]' : 'bg-[#fef9c3]',
      textColor: full === 0 ? 'text-[#b45309]' : 'text-[#854d0e]',
      borderColor: full === 0 ? 'border-[#fde68a]' : 'border-[#fde047]',
      dotColor: full === 0 ? 'bg-[#f59e0b]' : 'bg-[#eab308]'
    };
  }

  if (full === threshold) {
    return {
      status: 'low',
      label: 'Near Reorder',
      badgeBg: 'bg-[#fef9c3]',
      textColor: 'text-[#854d0e]',
      borderColor: 'border-[#fde047]',
      dotColor: 'bg-[#eab308]'
    };
  }

  return {
    status: 'sufficient',
    label: 'Sufficient',
    badgeBg: 'bg-[#ecfdf5]',
    textColor: 'text-[#065f46]',
    borderColor: 'border-[#a7f3d0]',
    dotColor: 'bg-[#10b981]'
  };
}

export const ConsumablesView: React.FC<ConsumablesViewProps> = ({
  items,
  onUpdateItem,
  onAddItem,
  onDeleteItem,
  onResetToSeed
}) => {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'All' | 'Cleaning Supply' | 'Consumable'>('All');
  const [unitFilter, setUnitFilter] = useState<'All' | 'liquid' | 'count' | 'box_pack'>('All');
  const [lowOnly, setLowOnly] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingItem, setEditingItem] = useState<ConsumableItem | null>(null);

  // Form draft state for Create / Edit modal
  const [formDraft, setFormDraft] = useState<{
    name: string;
    category: 'Cleaning Supply' | 'Consumable';
    unit: UnitType;
    fullUnitsCount: number;
    unitVolume: number;
    partialRemainingVolume: number;
    reorderThreshold: number;
    location: string;
    notes: string;
  }>({
    name: '',
    category: 'Cleaning Supply',
    unit: 'fl_oz',
    fullUnitsCount: 1,
    unitVolume: 32,
    partialRemainingVolume: 0,
    reorderThreshold: 1,
    location: '',
    notes: ''
  });

  // Calculate statistics across all consumables
  const stats = useMemo(() => {
    let sufficient = 0;
    let low = 0;
    let empty = 0;
    let totalVolume = 0;

    items.forEach(item => {
      const { status } = getConsumableStatus(item);
      if (status === 'sufficient') sufficient++;
      else if (status === 'low') low++;
      else if (status === 'empty') empty++;

      if (item.unit === 'fl_oz' || item.unit === 'oz') {
        const fullVol = (item.fullUnitsCount || 0) * (item.unitVolume || 0);
        const partVol = item.partialRemainingVolume || 0;
        totalVolume += (fullVol + partVol);
      }
    });

    return {
      total: items.length,
      sufficient,
      low,
      empty,
      needsAttention: low + empty,
      totalVolume
    };
  }, [items]);

  // Filtered item list
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(item => {
      if (categoryFilter !== 'All' && item.category !== categoryFilter) return false;

      if (unitFilter === 'liquid' && item.unit !== 'fl_oz' && item.unit !== 'oz') return false;
      if (unitFilter === 'count' && item.unit !== 'count') return false;
      if (unitFilter === 'box_pack' && item.unit !== 'box' && item.unit !== 'pack') return false;

      const { status } = getConsumableStatus(item);
      if (lowOnly && status === 'sufficient') return false;

      if (q) {
        const matchName = item.name.toLowerCase().includes(q);
        const matchNotes = (item.notes || '').toLowerCase().includes(q);
        const matchLocation = (item.location || '').toLowerCase().includes(q);
        const matchCategory = item.category.toLowerCase().includes(q);
        if (!matchName && !matchNotes && !matchLocation && !matchCategory) return false;
      }

      return true;
    });
  }, [items, query, categoryFilter, unitFilter, lowOnly]);

  // Items needing attention for the alert banner
  const attentionItems = useMemo(() => {
    return items.filter(item => {
      const { status } = getConsumableStatus(item);
      return status === 'low' || status === 'empty';
    });
  }, [items]);

  // Quick increment / decrement full containers
  const handleAdjustFullCount = (item: ConsumableItem, delta: number) => {
    const nextCount = Math.max(0, (item.fullUnitsCount || 0) + delta);
    const unitVol = item.unitVolume || 0;
    const partial = item.partialRemainingVolume || 0;
    const totalVolumeEquivalent = unitVol > 0 ? (nextCount * unitVol) + partial : nextCount;

    onUpdateItem({
      ...item,
      fullUnitsCount: nextCount,
      totalVolumeEquivalent
    });
  };

  // Quick partial volume change
  const handleAdjustPartialVolume = (item: ConsumableItem, nextVolume: number) => {
    const validVolume = Math.max(0, Math.round(nextVolume));
    const unitVol = item.unitVolume || 0;
    const full = item.fullUnitsCount || 0;
    const totalVolumeEquivalent = unitVol > 0 ? (full * unitVol) + validVolume : (item.totalVolumeEquivalent ?? full);

    onUpdateItem({
      ...item,
      partialRemainingVolume: validVolume,
      totalVolumeEquivalent
    });
  };

  // Open Modal for Create
  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setFormDraft({
      name: '',
      category: 'Cleaning Supply',
      unit: 'fl_oz',
      fullUnitsCount: 1,
      unitVolume: 32,
      partialRemainingVolume: 0,
      reorderThreshold: 1,
      location: '',
      notes: ''
    });
    setModalMode('create');
  };

  // Open Modal for Edit
  const handleOpenEditModal = (item: ConsumableItem) => {
    setEditingItem(item);
    setFormDraft({
      name: item.name,
      category: item.category,
      unit: item.unit,
      fullUnitsCount: item.fullUnitsCount,
      unitVolume: item.unitVolume || 0,
      partialRemainingVolume: item.partialRemainingVolume || 0,
      reorderThreshold: item.reorderThreshold,
      location: item.location || '',
      notes: item.notes || ''
    });
    setModalMode('edit');
  };

  // Handle Form Submit
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDraft.name.trim()) return;

    const unitVol = Number(formDraft.unitVolume) || undefined;
    const full = Number(formDraft.fullUnitsCount) || 0;
    const partial = Number(formDraft.partialRemainingVolume) || 0;
    const totalVolumeEquivalent = unitVol ? (full * unitVol) + partial : full;

    if (modalMode === 'create') {
      onAddItem({
        name: formDraft.name.trim(),
        category: formDraft.category,
        unit: formDraft.unit,
        fullUnitsCount: full,
        unitVolume: unitVol,
        partialRemainingVolume: partial,
        totalVolumeEquivalent,
        reorderThreshold: Number(formDraft.reorderThreshold) || 1,
        location: formDraft.location.trim() || undefined,
        notes: formDraft.notes.trim() || undefined,
        lastAuditedDate: new Date().toISOString().slice(0, 10)
      });
    } else if (modalMode === 'edit' && editingItem) {
      onUpdateItem({
        ...editingItem,
        name: formDraft.name.trim(),
        category: formDraft.category,
        unit: formDraft.unit,
        fullUnitsCount: full,
        unitVolume: unitVol,
        partialRemainingVolume: partial,
        totalVolumeEquivalent,
        reorderThreshold: Number(formDraft.reorderThreshold) || 1,
        location: formDraft.location.trim() || undefined,
        notes: formDraft.notes.trim() || undefined,
        lastAuditedDate: new Date().toISOString().slice(0, 10)
      });
    }

    setModalMode(null);
    setEditingItem(null);
  };

  // Export to CSV
  const handleExportCSV = () => {
    const exportData = items.map(item => {
      const { label } = getConsumableStatus(item);
      return {
        ID: item.id,
        Name: item.name,
        Category: item.category,
        Unit: item.unit,
        'Full Containers': item.fullUnitsCount,
        'Container Volume': item.unitVolume ? `${item.unitVolume} ${item.unit}` : '',
        'Partial Remaining': item.partialRemainingVolume ? `${item.partialRemainingVolume} ${item.unit}` : '',
        'Total Equivalent Volume': item.totalVolumeEquivalent || '',
        'Reorder Threshold': item.reorderThreshold,
        Status: label,
        Location: item.location || '',
        Notes: item.notes || '',
        'Last Audited': item.lastAuditedDate
      };
    });
    exportToCSV(exportData, 'lit_ledger_consumables');
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#f8f9fa] overflow-y-auto">
      {/* Top Header Section */}
      <div className="bg-white border-b border-[#dcdee3] px-6 py-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#1f5f8b]/10 text-[#1f5f8b] flex items-center justify-center">
                <SprayCan className="w-4 h-4" />
              </div>
              <h1 className="text-[20px] font-bold text-[#191c20] tracking-tight">
                Consumables & Cleaning Supplies
              </h1>
            </div>
            <p className="text-[13px] text-[#6c6f77] mt-1">
              Tracks full containers, partial open bottle levels (fl oz), packaging counts, and reorder alerts.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-white hover:bg-[#f1f3f5] text-[#44474e] border border-[#dcdee3] text-[12px] font-semibold rounded-md flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              title="Download CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => {
                if (window.confirm("Reset consumable supplies to Google Keep 8/12/26 seed data?")) {
                  onResetToSeed();
                }
              }}
              className="px-3 py-1.5 bg-white hover:bg-[#f1f3f5] text-[#6c6f77] hover:text-[#191c20] border border-[#dcdee3] text-[12px] font-medium rounded-md flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              title="Reload the 15 baseline items from Keep"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Seed</span>
            </button>
            <button
              onClick={handleOpenCreateModal}
              className="px-3.5 py-1.5 bg-[#1f5f8b] hover:bg-[#17496c] text-white text-[12px] font-semibold rounded-md flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Supply</span>
            </button>
          </div>
        </div>

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <div className="bg-[#fbfbfc] border border-[#dcdee3] rounded-lg p-3">
            <div className="text-[11px] font-semibold text-[#6c6f77] uppercase tracking-wider">Total Supplies</div>
            <div className="text-[22px] font-bold text-[#191c20] mt-0.5">{stats.total}</div>
            <div className="text-[11px] text-[#6c6f77] mt-0.5">items cataloged</div>
          </div>

          <div className="bg-[#fbfbfc] border border-[#dcdee3] rounded-lg p-3">
            <div className="text-[11px] font-semibold text-[#065f46] uppercase tracking-wider flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#10b981]" />
              Sufficient
            </div>
            <div className="text-[22px] font-bold text-[#065f46] mt-0.5">{stats.sufficient}</div>
            <div className="text-[11px] text-[#6c6f77] mt-0.5">above reorder threshold</div>
          </div>

          <div 
            onClick={() => setLowOnly(prev => !prev)}
            className={`border rounded-lg p-3 cursor-pointer transition-all ${
              lowOnly 
                ? 'bg-[#fef9c3] border-[#fde047] ring-2 ring-[#eab308]/40' 
                : 'bg-[#fbfbfc] border-[#dcdee3] hover:border-[#fde047]'
            }`}
          >
            <div className="text-[11px] font-semibold text-[#854d0e] uppercase tracking-wider flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#eab308]" />
              Low / Reorder
            </div>
            <div className="text-[22px] font-bold text-[#854d0e] mt-0.5">{stats.low}</div>
            <div className="text-[11px] text-[#854d0e] mt-0.5 flex items-center justify-between">
              <span>near or at threshold</span>
              <span className="underline font-medium text-[10px]">{lowOnly ? 'Active' : 'Filter'}</span>
            </div>
          </div>

          <div 
            onClick={() => setLowOnly(prev => !prev)}
            className={`border rounded-lg p-3 cursor-pointer transition-all ${
              stats.empty > 0 
                ? (lowOnly ? 'bg-[#fef2f2] border-[#fecaca] ring-2 ring-[#ef4444]/40' : 'bg-[#fff5f5] border-[#fecaca]') 
                : 'bg-[#fbfbfc] border-[#dcdee3]'
            }`}
          >
            <div className="text-[11px] font-semibold text-[#991b1b] uppercase tracking-wider flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
              Empty / Urgent
            </div>
            <div className="text-[22px] font-bold text-[#991b1b] mt-0.5">{stats.empty}</div>
            <div className="text-[11px] text-[#991b1b] mt-0.5">0 full containers</div>
          </div>
        </div>
      </div>

      {/* Low Stock Alert Notification Bar */}
      {attentionItems.length > 0 && !lowOnly && (
        <div className="mx-6 mt-4 p-3.5 bg-[#fffbeb] border border-[#fde68a] rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[13px]">
          <div className="flex items-start sm:items-center gap-2.5 text-[#92400e]">
            <AlertTriangle className="w-4 h-4 shrink-0 text-[#d97706] mt-0.5 sm:mt-0" />
            <div>
              <span className="font-semibold">{attentionItems.length} supply items need restocking:</span>{' '}
              <span className="text-[#b45309]">
                {attentionItems.slice(0, 4).map(i => i.name).join(', ')}
                {attentionItems.length > 4 && ` and ${attentionItems.length - 4} more`}
              </span>
            </div>
          </div>
          <button
            onClick={() => setLowOnly(true)}
            className="px-2.5 py-1 bg-[#d97706] hover:bg-[#b45309] text-white text-[11px] font-semibold rounded shrink-0 self-start sm:self-auto cursor-pointer transition-colors"
          >
            View Low Stock ({attentionItems.length})
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8b8e96]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search supplies by name, notes, or volume..."
            className="w-full pl-9 pr-8 py-1.5 bg-white border border-[#dcdee3] rounded-md text-[13px] text-[#191c20] placeholder-[#8b8e96] focus:outline-none focus:border-[#1f5f8b] focus:ring-1 focus:ring-[#1f5f8b]"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8b8e96] hover:text-[#191c20]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Category Chips */}
          <div className="flex bg-[#eef0f3] p-0.5 rounded-md border border-[#dcdee3]/60 text-[12px]">
            {(['All', 'Cleaning Supply', 'Consumable'] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1 rounded font-medium transition-all cursor-pointer ${
                  categoryFilter === cat 
                    ? 'bg-white text-[#191c20] shadow-xs font-semibold' 
                    : 'text-[#6c6f77] hover:text-[#191c20]'
                }`}
              >
                {cat === 'All' ? 'All categories' : cat}
              </button>
            ))}
          </div>

          {/* Unit Chips */}
          <div className="flex bg-[#eef0f3] p-0.5 rounded-md border border-[#dcdee3]/60 text-[12px]">
            <button
              onClick={() => setUnitFilter('All')}
              className={`px-2 py-1 rounded font-medium cursor-pointer ${
                unitFilter === 'All' ? 'bg-white text-[#191c20] shadow-xs font-semibold' : 'text-[#6c6f77] hover:text-[#191c20]'
              }`}
            >
              All units
            </button>
            <button
              onClick={() => setUnitFilter('liquid')}
              className={`px-2 py-1 rounded font-medium cursor-pointer ${
                unitFilter === 'liquid' ? 'bg-white text-[#191c20] shadow-xs font-semibold' : 'text-[#6c6f77] hover:text-[#191c20]'
              }`}
            >
              Liquid (fl oz)
            </button>
            <button
              onClick={() => setUnitFilter('count')}
              className={`px-2 py-1 rounded font-medium cursor-pointer ${
                unitFilter === 'count' ? 'bg-white text-[#191c20] shadow-xs font-semibold' : 'text-[#6c6f77] hover:text-[#191c20]'
              }`}
            >
              Count
            </button>
            <button
              onClick={() => setUnitFilter('box_pack')}
              className={`px-2 py-1 rounded font-medium cursor-pointer ${
                unitFilter === 'box_pack' ? 'bg-white text-[#191c20] shadow-xs font-semibold' : 'text-[#6c6f77] hover:text-[#191c20]'
              }`}
            >
              Box / Pack
            </button>
          </div>

          {/* Low Stock Toggle */}
          <button
            onClick={() => setLowOnly(prev => !prev)}
            className={`px-3 py-1 rounded-md text-[12px] font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
              lowOnly 
                ? 'bg-[#fef9c3] border-[#fde047] text-[#854d0e]' 
                : 'bg-white border-[#dcdee3] text-[#6c6f77] hover:text-[#191c20]'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Low Stock Only</span>
            {stats.needsAttention > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                lowOnly ? 'bg-[#eab308] text-white' : 'bg-[#eef0f3] text-[#6c6f77]'
              }`}>
                {stats.needsAttention}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Supplies List / Table */}
      <div className="px-6 pb-12 flex-1">
        {filteredItems.length === 0 ? (
          <div className="bg-white border border-[#dcdee3] rounded-lg py-16 text-center text-[#6c6f77]">
            <SprayCan className="w-10 h-10 mx-auto text-[#8b8e96]/60 stroke-1" />
            <p className="font-semibold text-[15px] text-[#191c20] mt-3">No supply items match your filter</p>
            <p className="text-[13px] mt-1 text-[#6c6f77]">
              Try adjusting your search query or reset the filter chips above.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                onClick={() => {
                  setQuery('');
                  setCategoryFilter('All');
                  setUnitFilter('All');
                  setLowOnly(false);
                }}
                className="px-3 py-1.5 bg-[#f1f3f5] hover:bg-[#e4e7ea] text-[#191c20] text-[12px] font-medium rounded-md cursor-pointer"
              >
                Clear all filters
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-[#dcdee3] rounded-lg shadow-xs overflow-hidden">
            {/* Desktop Table Header */}
            <div className="hidden lg:grid grid-cols-[1.8fr_140px_160px_240px_100px_90px] items-center px-5 py-3 bg-[#f8f9fa] border-b border-[#dcdee3] text-[11px] font-bold text-[#6c6f77] uppercase tracking-wider">
              <div>Supply Item & Details</div>
              <div>Status</div>
              <div>Full Containers</div>
              <div>Open Bottle / Volume</div>
              <div className="text-center">Threshold</div>
              <div className="text-right">Actions</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-[#dcdee3]">
              {filteredItems.map(item => {
                const { status, label, badgeBg, textColor, borderColor, dotColor } = getConsumableStatus(item);
                const isLiquid = item.unit === 'fl_oz' || item.unit === 'oz';
                const unitVol = item.unitVolume || 0;
                const partial = item.partialRemainingVolume || 0;
                const fullCount = item.fullUnitsCount || 0;
                const totalVol = unitVol > 0 ? (fullCount * unitVol) + partial : fullCount;

                return (
                  <div 
                    key={item.id}
                    className="p-4 lg:px-5 lg:py-3.5 hover:bg-[#fafbfc] transition-colors flex flex-col lg:grid lg:grid-cols-[1.8fr_140px_160px_240px_100px_90px] lg:items-center gap-3 lg:gap-2"
                  >
                    {/* Item Information */}
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[14.5px] text-[#191c20] tracking-tight">
                          {item.name}
                        </span>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#f1f3f5] text-[#44474e] border border-[#dcdee3]/60">
                          {item.category}
                        </span>
                        {item.location && (
                          <span className="text-[10px] text-[#6c6f77] bg-[#f8f9fa] px-1.5 py-0.5 rounded border border-[#dcdee3]/40">
                            📍 {item.location}
                          </span>
                        )}
                      </div>

                      {item.notes && (
                        <div className="text-[12px] text-[#6c6f77] mt-1 flex items-center gap-1.5">
                          <Info className="w-3.5 h-3.5 shrink-0 text-[#8b8e96]" />
                          <span>{item.notes}</span>
                        </div>
                      )}

                      <div className="text-[11px] text-[#8b8e96] mt-0.5">
                        Audited: {item.lastAuditedDate || 'Recent'}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${badgeBg} ${textColor} ${borderColor}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                        <span>{label}</span>
                      </span>
                    </div>

                    {/* Full Container Increment / Decrement */}
                    <div>
                      <div className="text-[11px] font-medium text-[#6c6f77] lg:hidden mb-1">Full Containers:</div>
                      <div className="inline-flex items-center bg-[#f1f3f5] rounded-md border border-[#dcdee3] p-0.5 shadow-2xs">
                        <button
                          onClick={() => handleAdjustFullCount(item, -1)}
                          disabled={fullCount <= 0}
                          className={`w-7 h-7 flex items-center justify-center font-bold text-sm rounded transition-all ${
                            fullCount <= 0 
                              ? 'text-[#8b8e96]/50 cursor-not-allowed' 
                              : 'text-[#191c20] hover:bg-white active:scale-95 cursor-pointer'
                          }`}
                          title="Decrease full count by 1"
                        >
                          -1
                        </button>
                        <div className="px-2.5 py-0.5 text-center min-w-[70px]">
                          <span className="font-bold text-[14px] text-[#191c20]">{fullCount}</span>
                          <span className="text-[11px] text-[#6c6f77] ml-1">
                            {item.unit === 'box' ? 'box' : item.unit === 'pack' ? 'pack' : 'full'}
                          </span>
                        </div>
                        <button
                          onClick={() => handleAdjustFullCount(item, 1)}
                          className="w-7 h-7 flex items-center justify-center font-bold text-sm text-[#191c20] hover:bg-white active:scale-95 rounded transition-all cursor-pointer"
                          title="Increase full count by 1"
                        >
                          +1
                        </button>
                      </div>
                    </div>

                    {/* Open Bottle / Partial Volume Tracking */}
                    <div>
                      {isLiquid ? (
                        <div className="space-y-1.5 pr-2">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[#6c6f77] font-medium flex items-center gap-1">
                              <Droplets className="w-3.5 h-3.5 text-[#1f5f8b]" />
                              <span>Open:</span>
                              <span className="font-semibold text-[#191c20]">
                                {partial > 0 ? `< ${partial} fl oz` : 'None open'}
                              </span>
                            </span>
                            {unitVol > 0 && (
                              <span className="font-mono text-[10px] text-[#8b8e96]">
                                cap: {unitVol} oz
                              </span>
                            )}
                          </div>

                          {/* Slider and Numeric Stepper */}
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min={0}
                              max={unitVol > 0 ? unitVol : 128}
                              step={1}
                              value={partial}
                              onChange={(e) => handleAdjustPartialVolume(item, Number(e.target.value))}
                              className="w-full accent-[#1f5f8b] h-1.5 bg-[#eef0f3] rounded-lg cursor-pointer"
                              title={`Adjust open volume (${partial} fl oz)`}
                            />
                            <input
                              type="number"
                              min={0}
                              max={unitVol > 0 ? unitVol : 256}
                              value={partial}
                              onChange={(e) => handleAdjustPartialVolume(item, Number(e.target.value))}
                              className="w-14 px-1.5 py-0.5 border border-[#dcdee3] rounded text-[11px] font-mono text-center text-[#191c20] focus:outline-none focus:border-[#1f5f8b]"
                              title="Direct volume input in fl oz"
                            />
                          </div>

                          {/* Quick Percentage Buttons */}
                          <div className="flex items-center gap-1 text-[10px]">
                            <button
                              onClick={() => handleAdjustPartialVolume(item, 0)}
                              className={`px-1.5 py-0.2 rounded border transition-colors cursor-pointer ${
                                partial === 0 ? 'bg-[#1f5f8b] text-white border-[#1f5f8b]' : 'bg-[#f8f9fa] hover:bg-[#eef0f3] text-[#6c6f77] border-[#dcdee3]'
                              }`}
                            >
                              0
                            </button>
                            {unitVol > 0 && (
                              <>
                                <button
                                  onClick={() => handleAdjustPartialVolume(item, Math.round(unitVol * 0.25))}
                                  className="px-1.5 py-0.2 rounded bg-[#f8f9fa] hover:bg-[#eef0f3] text-[#6c6f77] border border-[#dcdee3] cursor-pointer"
                                >
                                  25%
                                </button>
                                <button
                                  onClick={() => handleAdjustPartialVolume(item, Math.round(unitVol * 0.5))}
                                  className="px-1.5 py-0.2 rounded bg-[#f8f9fa] hover:bg-[#eef0f3] text-[#6c6f77] border border-[#dcdee3] cursor-pointer"
                                >
                                  50%
                                </button>
                                <button
                                  onClick={() => handleAdjustPartialVolume(item, Math.round(unitVol * 0.75))}
                                  className="px-1.5 py-0.2 rounded bg-[#f8f9fa] hover:bg-[#eef0f3] text-[#6c6f77] border border-[#dcdee3] cursor-pointer"
                                >
                                  75%
                                </button>
                                <button
                                  onClick={() => handleAdjustPartialVolume(item, unitVol)}
                                  className="px-1.5 py-0.2 rounded bg-[#f8f9fa] hover:bg-[#eef0f3] text-[#6c6f77] border border-[#dcdee3] cursor-pointer"
                                >
                                  Full
                                </button>
                              </>
                            )}
                            <span className="ml-auto text-[10px] font-bold text-[#1f5f8b]">
                              {totalVol} oz tot
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[12px] text-[#6c6f77] flex items-center gap-1">
                          <Package className="w-3.5 h-3.5 text-[#8b8e96]" />
                          <span>Packaged item: {item.unit} count</span>
                        </div>
                      )}
                    </div>

                    {/* Reorder Threshold */}
                    <div className="lg:text-center text-[12px]">
                      <span className="text-[#6c6f77] lg:hidden mr-1">Reorder at:</span>
                      <span className="font-semibold text-[#191c20]">{item.reorderThreshold}</span>
                      <span className="text-[11px] text-[#6c6f77] ml-0.5">full</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center lg:justify-end gap-1.5 pt-2 lg:pt-0 border-t lg:border-t-0 border-[#dcdee3]/60">
                      <button
                        onClick={() => handleOpenEditModal(item)}
                        className="p-1.5 rounded hover:bg-[#f1f3f5] text-[#6c6f77] hover:text-[#191c20] transition-colors cursor-pointer"
                        title="Edit supply details"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete ${item.name}?`)) {
                            onDeleteItem(item.id);
                          }
                        }}
                        className="p-1.5 rounded hover:bg-[#fef2f2] text-[#6c6f77] hover:text-[#b3261e] transition-colors cursor-pointer"
                        title="Delete supply"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Consumable Modal */}
      {modalMode && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-2xs">
          <div className="bg-white rounded-xl shadow-xl border border-[#dcdee3] max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-[#dcdee3] flex items-center justify-between bg-[#fbfbfc]">
              <div className="flex items-center gap-2">
                <SprayCan className="w-4 h-4 text-[#1f5f8b]" />
                <h3 className="font-bold text-[16px] text-[#191c20]">
                  {modalMode === 'create' ? 'Add Supply Item' : 'Edit Supply Item'}
                </h3>
              </div>
              <button
                onClick={() => setModalMode(null)}
                className="text-[#8b8e96] hover:text-[#191c20] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6c6f77] mb-1">
                  Item Name *
                </label>
                <input
                  type="text"
                  required
                  value={formDraft.name}
                  onChange={(e) => setFormDraft({ ...formDraft, name: e.target.value })}
                  placeholder="e.g. Clorox Bleach 121 oz"
                  className="w-full px-3 py-2 border border-[#dcdee3] rounded-md text-[13px] text-[#191c20] focus:outline-none focus:border-[#1f5f8b]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6c6f77] mb-1">
                    Category
                  </label>
                  <select
                    value={formDraft.category}
                    onChange={(e) => setFormDraft({ ...formDraft, category: e.target.value as any })}
                    className="w-full px-3 py-2 border border-[#dcdee3] rounded-md text-[13px] text-[#191c20] focus:outline-none focus:border-[#1f5f8b]"
                  >
                    <option value="Cleaning Supply">Cleaning Supply</option>
                    <option value="Consumable">Consumable</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6c6f77] mb-1">
                    Measurement Unit
                  </label>
                  <select
                    value={formDraft.unit}
                    onChange={(e) => setFormDraft({ ...formDraft, unit: e.target.value as any })}
                    className="w-full px-3 py-2 border border-[#dcdee3] rounded-md text-[13px] text-[#191c20] focus:outline-none focus:border-[#1f5f8b]"
                  >
                    <option value="fl_oz">Fluid Ounces (fl_oz)</option>
                    <option value="oz">Ounces (oz)</option>
                    <option value="count">Count / Canisters</option>
                    <option value="box">Box</option>
                    <option value="pack">Pack</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6c6f77] mb-1">
                    Full Containers
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formDraft.fullUnitsCount}
                    onChange={(e) => setFormDraft({ ...formDraft, fullUnitsCount: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-[#dcdee3] rounded-md text-[13px] text-[#191c20] focus:outline-none focus:border-[#1f5f8b]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6c6f77] mb-1">
                    Container Vol (oz)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formDraft.unitVolume || ''}
                    onChange={(e) => setFormDraft({ ...formDraft, unitVolume: Number(e.target.value) })}
                    placeholder="e.g. 121"
                    className="w-full px-3 py-2 border border-[#dcdee3] rounded-md text-[13px] text-[#191c20] focus:outline-none focus:border-[#1f5f8b]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6c6f77] mb-1">
                    Open Bottle (oz)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formDraft.partialRemainingVolume || ''}
                    onChange={(e) => setFormDraft({ ...formDraft, partialRemainingVolume: Number(e.target.value) })}
                    placeholder="e.g. 77"
                    className="w-full px-3 py-2 border border-[#dcdee3] rounded-md text-[13px] text-[#191c20] focus:outline-none focus:border-[#1f5f8b]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6c6f77] mb-1">
                    Reorder Threshold
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formDraft.reorderThreshold}
                    onChange={(e) => setFormDraft({ ...formDraft, reorderThreshold: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-[#dcdee3] rounded-md text-[13px] text-[#191c20] focus:outline-none focus:border-[#1f5f8b]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6c6f77] mb-1">
                    Location / Shelf
                  </label>
                  <input
                    type="text"
                    value={formDraft.location}
                    onChange={(e) => setFormDraft({ ...formDraft, location: e.target.value })}
                    placeholder="e.g. Storage Closet A"
                    className="w-full px-3 py-2 border border-[#dcdee3] rounded-md text-[13px] text-[#191c20] focus:outline-none focus:border-[#1f5f8b]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6c6f77] mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={formDraft.notes}
                  onChange={(e) => setFormDraft({ ...formDraft, notes: e.target.value })}
                  placeholder="e.g. 3 partial <16 oz + 1 32 oz"
                  className="w-full px-3 py-2 border border-[#dcdee3] rounded-md text-[13px] text-[#191c20] focus:outline-none focus:border-[#1f5f8b]"
                />
              </div>

              <div className="pt-3 border-t border-[#dcdee3] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-3.5 py-1.5 bg-[#f1f3f5] hover:bg-[#e4e7ea] text-[#44474e] text-[12px] font-semibold rounded-md cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#1f5f8b] hover:bg-[#17496c] text-white text-[12px] font-semibold rounded-md shadow-xs cursor-pointer"
                >
                  {modalMode === 'create' ? 'Create Supply' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
