import React, { useState } from 'react';
import { Title, OrderItem } from '../types';
import { ShoppingCart, PackageCheck, Plus, Check, Trash2, ArrowLeft, Layers, RotateCcw, Search, Sparkles, Calendar } from 'lucide-react';
import { calculateSuggestedOrderQty } from '../lib/utils';

interface OrderListViewProps {
  titles: Title[];
  orders: OrderItem[];
  onMarkOrdered: (items: { code: string; title: string; lang?: string; qty: number; packs?: number; bundle?: string }[]) => void;
  onReceiveDelivery: (receipts: { code: string; title: string; lang: 'EN' | 'ES'; qty: number }[], remainingOrders: OrderItem[], checkInDate?: string) => void;
  onCancelOrder: (code: string) => void;
  reorderSensitivity?: number;
}

export const OrderListView: React.FC<OrderListViewProps> = ({
  titles,
  orders,
  onMarkOrdered,
  onReceiveDelivery,
  onCancelOrder,
  reorderSensitivity = 1
}) => {
  const [checkingIn, setCheckingIn] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Record<string, boolean>>({});
  const [customQuantities, setCustomQuantities] = useState<Record<string, number>>({});
  const [viewFilter, setViewFilter] = useState<'all' | 'low'>('all');
  const [catFilter, setCatFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Check-in state
  const [checkInDate, setCheckInDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [checkInQuantities, setCheckInQuantities] = useState<Record<string, number>>({});
  const [extraItemCode, setExtraItemCode] = useState('');
  const [extraItemQty, setExtraItemQty] = useState('');
  const [extraArrivals, setExtraArrivals] = useState<{ code: string; title: string; lang: 'EN' | 'ES'; qty: number }[]>([]);

  const reorderAt = (t: Title) => Math.round(t.reorder * reorderSensitivity);

  // Map of existing orders
  const orderMap: Record<string, OrderItem> = {};
  orders.forEach(o => { orderMap[o.key] = o; });

  // Gather all editions for the order list
  interface Candidate {
    title: Title;
    edition: Title['editions'][0];
    codeKey: string;
    at: number;
    suggest: number;
    pack: number;
    isLow: boolean;
  }

  const allItems: Candidate[] = [];
  titles.forEach(t => {
    t.editions.forEach(ed => {
      const at = reorderAt(t);
      const isLow = ed.stock < at;
      const suggest = calculateSuggestedOrderQty(ed.stock, at, t.pack);
      const codeKey = `${t.code}-${ed.lang}`;
      allItems.push({
        title: t,
        edition: ed,
        codeKey,
        at,
        suggest,
        pack: t.pack,
        isLow
      });
    });
  });

  const lowCount = allItems.filter(i => i.isLow).length;

  const filteredItems = allItems.filter(c => {
    if (viewFilter === 'low' && !c.isLow) return false;
    if (catFilter !== 'All' && c.title.cat !== catFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = c.edition.title.toLowerCase().includes(q);
      const matchCode = c.codeKey.toLowerCase().includes(q);
      const matchCat = c.title.cat.toLowerCase().includes(q);
      if (!matchTitle && !matchCode && !matchCat) return false;
    }
    return true;
  });

  const handleToggleSelect = (codeKey: string) => {
    setSelectedKeys(prev => ({ ...prev, [codeKey]: !prev[codeKey] }));
  };

  const handleToggleSelectAllVisible = () => {
    const selectable = filteredItems.filter(i => !orderMap[i.codeKey]);
    const allSelected = selectable.length > 0 && selectable.every(i => selectedKeys[i.codeKey]);
    const next: Record<string, boolean> = { ...selectedKeys };
    selectable.forEach(i => {
      next[i.codeKey] = !allSelected;
    });
    setSelectedKeys(next);
  };

  const handleFillAllSuggestions = () => {
    const nextQtys: Record<string, number> = { ...customQuantities };
    const nextSelected: Record<string, boolean> = { ...selectedKeys };
    allItems.forEach(c => {
      if (c.isLow && c.suggest > 0 && !orderMap[c.codeKey]) {
        nextQtys[c.codeKey] = c.suggest;
        nextSelected[c.codeKey] = true;
      }
    });
    setCustomQuantities(nextQtys);
    setSelectedKeys(nextSelected);
  };

  const handleResetAllToZero = () => {
    setCustomQuantities({});
    setSelectedKeys({});
  };

  const handleOrderSelected = () => {
    const toOrder: { code: string; title: string; lang?: string; qty: number; packs?: number }[] = [];
    allItems.forEach(c => {
      if (selectedKeys[c.codeKey] && !orderMap[c.codeKey]) {
        const qty = customQuantities[c.codeKey] !== undefined ? customQuantities[c.codeKey] : 0;
        if (qty > 0) {
          toOrder.push({
            code: c.codeKey,
            title: c.edition.title,
            lang: c.edition.lang,
            qty,
            packs: Math.ceil(qty / c.pack)
          });
        }
      }
    });
    if (toOrder.length > 0) {
      onMarkOrdered(toOrder);
      const nextCustom = { ...customQuantities };
      const nextSelected = { ...selectedKeys };
      toOrder.forEach(item => {
        delete nextCustom[item.code];
        delete nextSelected[item.code];
      });
      setCustomQuantities(nextCustom);
      setSelectedKeys(nextSelected);
    }
  };

  const handleAddBundleEnglishTracts = () => {
    // English tracts bundle
    onMarkOrdered([
      {
        code: 'BND-TR-EN',
        bundle: 'tracts-en',
        title: 'All English tracts — 1 pack of each',
        qty: 600,
        packs: 12
      }
    ]);
  };

  // Check In Flow Initialization
  const handleStartCheckIn = () => {
    const initQtys: Record<string, number> = {};
    orders.forEach(o => {
      initQtys[o.key] = o.qty;
    });
    setCheckInQuantities(initQtys);
    setExtraArrivals([]);
    setCheckingIn(true);
  };

  const handleAddExtraArrival = () => {
    if (!extraItemCode || !extraItemQty) return;
    const qty = parseInt(extraItemQty, 10);
    if (!qty || qty <= 0) return;

    // Find title and edition
    let foundTitle: Title | undefined;
    let foundEd: Title['editions'][0] | undefined;
    titles.forEach(t => {
      t.editions.forEach(ed => {
        if (`${t.code}-${ed.lang}` === extraItemCode) {
          foundTitle = t;
          foundEd = ed;
        }
      });
    });

    if (foundTitle && foundEd) {
      setExtraArrivals(prev => [
        ...prev,
        {
          code: extraItemCode,
          title: foundEd!.title,
          lang: foundEd!.lang,
          qty
        }
      ]);
      setExtraItemCode('');
      setExtraItemQty('');
    }
  };

  const handleSaveCheckIn = () => {
    const receipts: { code: string; title: string; lang: 'EN' | 'ES'; qty: number }[] = [];
    const remainingOrders: OrderItem[] = [];

    // Process on-order items
    orders.forEach(o => {
      const arrivedQty = checkInQuantities[o.key] !== undefined ? checkInQuantities[o.key] : o.qty;

      if (o.bundle === 'tracts-en') {
        // Expand 1 pack (50) for each of the 12 English tract titles
        const engTracts = titles.filter(t => t.cat === 'Tract');
        const packSize = 50;
        const totalPacks = Math.round(arrivedQty / packSize);

        engTracts.forEach(t => {
          const ed = t.editions.find(e => e.lang === 'EN');
          if (ed && arrivedQty > 0) {
            receipts.push({
              code: `${t.code}-EN`,
              title: ed.title,
              lang: 'EN',
              qty: Math.round(arrivedQty / engTracts.length)
            });
          }
        });
      } else {
        // Regular single title edition
        const isSpanish = (o.lang && o.lang.toUpperCase().includes('ES')) || 
          o.key.endsWith('-ES') || 
          (o.code && o.code.endsWith('-ES')) || 
          o.key.includes('_ES') ||
          (o.title && (
            o.title.toLowerCase().includes('spanish') ||
            o.title.toLowerCase().includes('elementos') ||
            o.title.toLowerCase().includes('básicos') ||
            o.title.toLowerCase().includes('basicos') ||
            o.title.toLowerCase().includes('biblia') ||
            o.title.toLowerCase().includes('tomo')
          ));
        const lang: 'EN' | 'ES' = isSpanish ? 'ES' : 'EN';
        if (arrivedQty > 0) {
          receipts.push({
            code: o.code || o.key,
            title: o.title,
            lang,
            qty: arrivedQty
          });
        }
      }

      // Check for partial delivery remaining on order
      if (arrivedQty < o.qty) {
        remainingOrders.push({
          ...o,
          qty: o.qty - arrivedQty
        });
      }
    });

    // Add extra arrivals
    extraArrivals.forEach(extra => {
      receipts.push(extra);
    });

    onReceiveDelivery(receipts, remainingOrders, checkInDate);
    setCheckingIn(false);
  };

  // CHECK IN FLOW SCREEN
  if (checkingIn) {
    const totalArriving = Object.values(checkInQuantities).reduce((a, b) => a + b, 0) +
      extraArrivals.reduce((sum, e) => sum + e.qty, 0);

    return (
      <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-white overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#dcdee3]">
          <button
            onClick={() => setCheckingIn(false)}
            className="text-[12.5px] font-semibold text-[#44474e] hover:text-[#1f5f8b] flex items-center gap-1.5 mb-2 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Cancel check-in</span>
          </button>
          <h1 className="text-[25px] font-bold tracking-tight text-[#191c20]">
            Check in a delivery
          </h1>
          <p className="text-[13.5px] text-[#44474e] mt-1">
            Compare the packing slip against what arrived. Partial deliveries stay on order; unexpected items can be added below.
          </p>
        </div>

        {/* Form Body */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 space-y-6">
          <div className="max-w-3xl space-y-6">
            {/* Delivery Date Tagging Card */}
            <div className="border border-[#dcdee3] rounded-lg p-4 bg-white shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#1f5f8b]" />
                    <label htmlFor="delivery-date-input" className="text-[13px] font-bold text-[#191c20]">
                      Delivery / Arrival Date
                    </label>
                  </div>
                  <p className="text-[12px] text-[#6c6f77] mt-0.5">
                    Tag the physical date this shipment arrived. History records and movements will use this date.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    id="delivery-date-input"
                    type="date"
                    value={checkInDate}
                    onChange={(e) => setCheckInDate(e.target.value)}
                    className="px-3 py-1.5 border border-[#c9cbd2] rounded-md font-mono text-[13px] text-[#191c20] bg-white focus:border-[#1f5f8b] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setCheckInDate(new Date().toISOString().slice(0, 10))}
                    className={`px-2.5 py-1.5 text-[11.5px] font-medium rounded border cursor-pointer transition-colors ${
                      checkInDate === new Date().toISOString().slice(0, 10)
                        ? 'bg-[#1f5f8b] text-white border-[#1f5f8b]'
                        : 'bg-[#f6f7f9] text-[#44474e] border-[#dcdee3] hover:bg-[#eef0f3]'
                    }`}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() - 1);
                      setCheckInDate(d.toISOString().slice(0, 10));
                    }}
                    className="px-2.5 py-1.5 text-[11.5px] font-medium rounded border border-[#dcdee3] bg-[#f6f7f9] text-[#44474e] hover:bg-[#eef0f3] cursor-pointer transition-colors"
                  >
                    Yesterday
                  </button>
                  <button
                    type="button"
                    onClick={() => setCheckInDate('2026-09-18')}
                    className={`px-2.5 py-1.5 text-[11.5px] font-medium rounded border cursor-pointer transition-colors ${
                      checkInDate === '2026-09-18'
                        ? 'bg-[#1f5f8b] text-white border-[#1f5f8b]'
                        : 'bg-[#f6f7f9] text-[#44474e] border-[#dcdee3] hover:bg-[#eef0f3]'
                    }`}
                  >
                    9/18/26
                  </button>
                </div>
              </div>
            </div>

            {/* On order check-off */}
            <div className="border border-[#dcdee3] rounded-lg overflow-hidden bg-white shadow-xs">
              <div className="px-4 py-3 bg-[#f6f7f9] border-b border-[#dcdee3] text-[11px] font-bold tracking-wider uppercase text-[#6c6f77]">
                Expected from order list
              </div>

              <div className="grid grid-cols-[1fr_90px_120px] items-center px-4 py-2 bg-[#f6f7f9] border-b border-[#dcdee3] text-[10px] font-bold tracking-wider uppercase text-[#6c6f77]">
                <div>Item</div>
                <div className="text-right">Ordered</div>
                <div className="text-right">Arrived</div>
              </div>

              <div className="divide-y divide-[#eef0f3]">
                {orders.map(o => {
                  const val = checkInQuantities[o.key] !== undefined ? checkInQuantities[o.key] : o.qty;
                  const isPartial = val < o.qty;

                  return (
                    <div key={o.key} className="grid grid-cols-[1fr_90px_120px] items-center px-4 py-3 text-[13px]">
                      <div className="min-w-0 pr-3">
                        <div className="font-semibold text-[#191c20] truncate">
                          {o.title}
                        </div>
                        <div className="text-[11.5px] text-[#8b8e96] mt-0.5">
                          {o.bundle ? 'Bundle · Expands into 12 English tract titles' : `Code: ${o.code}`}
                        </div>
                        {isPartial && (
                          <div className="text-[11.5px] text-[#8a5a00] font-medium mt-0.5">
                            {o.qty - val} remains on the order list as unfulfilled
                          </div>
                        )}
                      </div>

                      <div className="text-right font-mono text-[13.5px] text-[#6c6f77] tabular-nums">
                        {o.qty}
                      </div>

                      <div className="flex justify-end">
                        <input
                          type="number"
                          min="0"
                          max={o.qty * 2}
                          value={val}
                          onChange={(e) => {
                            const num = Math.max(0, parseInt(e.target.value, 10) || 0);
                            setCheckInQuantities({ ...checkInQuantities, [o.key]: num });
                          }}
                          className="w-24 px-2 py-1.5 border border-[#c9cbd2] rounded-md font-mono text-[13.5px] font-bold text-right text-[#191c20] bg-white focus:border-[#1f5f8b] outline-none tabular-nums"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Unexpected Items / Extra Arrivals */}
            <div className="border border-[#dcdee3] rounded-lg p-4 bg-white space-y-3">
              <div className="text-[12px] font-bold tracking-wider uppercase text-[#6c6f77]">
                Add item not on order list
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_100px_auto] gap-2.5 items-end">
                <div>
                  <label className="text-[10px] font-bold tracking-wider uppercase text-[#8b8e96] block mb-1">
                    Literature edition
                  </label>
                  <select
                    value={extraItemCode}
                    onChange={(e) => setExtraItemCode(e.target.value)}
                    className="w-full px-3 py-2 border border-[#c9cbd2] rounded-md text-[13px] text-[#191c20] bg-white outline-none"
                  >
                    <option value="">Select an edition...</option>
                    {titles.map(t =>
                      t.editions.map(ed => (
                        <option key={`${t.code}-${ed.lang}`} value={`${t.code}-${ed.lang}`}>
                          [{ed.lang}] {ed.title} ({t.code}-{ed.lang})
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold tracking-wider uppercase text-[#8b8e96] block mb-1">
                    Pieces
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={extraItemQty}
                    onChange={(e) => setExtraItemQty(e.target.value)}
                    placeholder="Qty"
                    className="w-full px-2.5 py-2 border border-[#c9cbd2] rounded-md font-mono text-[13px] font-bold text-right text-[#191c20] bg-white outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddExtraArrival}
                  disabled={!extraItemCode || !extraItemQty}
                  className="px-3.5 py-2 bg-[#f6f7f9] hover:bg-[#eef0f3] border border-[#c9cbd2] text-[#44474e] text-[12.5px] font-semibold rounded-md cursor-pointer disabled:opacity-40"
                >
                  Add to delivery
                </button>
              </div>

              {extraArrivals.length > 0 && (
                <div className="mt-2 divide-y divide-[#eef0f3] border-t border-[#eef0f3] pt-2">
                  {extraArrivals.map((extra, idx) => (
                    <div key={idx} className="py-1.5 flex items-center justify-between text-[13px]">
                      <span className="font-semibold text-[#191c20]">{extra.title} [{extra.lang}]</span>
                      <span className="font-mono font-bold text-[#1f5f8b]">+{extra.qty}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="px-6 py-4 border-t border-[#dcdee3] bg-[#f6f7f9] flex items-center justify-between gap-4">
          <div className="text-[13px] text-[#44474e]">
            Receiving <strong>{totalArriving.toLocaleString()}</strong> pieces into inventory for <strong>{checkInDate}</strong>.
          </div>
          <div className="flex items-center gap-2.5 flex-none">
            <button
              onClick={() => setCheckingIn(false)}
              className="px-4 py-2 border border-[#c9cbd2] bg-white text-[#44474e] font-semibold text-[13px] rounded-md hover:bg-[#f6f7f9] cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveCheckIn}
              disabled={totalArriving === 0}
              className="px-5 py-2 bg-[#1f5f8b] hover:bg-[#17496c] text-white font-semibold text-[13px] rounded-md transition-colors cursor-pointer shadow-xs disabled:opacity-40"
            >
              Save & receive into stock
            </button>
          </div>
        </div>
      </div>
    );
  }

  // MAIN ORDER LIST VIEW
  const readyToOrderCount = allItems.filter(c => selectedKeys[c.codeKey] && !orderMap[c.codeKey] && (customQuantities[c.codeKey] || 0) > 0).length;
  const hasCustomQtys = Object.values(customQuantities).some(v => v > 0);
  const selectableVisible = filteredItems.filter(i => !orderMap[i.codeKey]);
  const allVisibleSelected = selectableVisible.length > 0 && selectableVisible.every(i => selectedKeys[i.codeKey]);

  return (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="px-6 py-6 border-b border-[#dcdee3] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-[#191c20]">Order list</h1>
          <p className="text-[13.5px] text-[#44474e] mt-1">
            {allItems.length} editions in catalog · {lowCount} {lowCount === 1 ? 'edition needs' : 'editions need'} reordering · {orders.length} items currently on order
          </p>
        </div>
        <button
          onClick={handleStartCheckIn}
          disabled={orders.length === 0}
          className={`
            px-4 py-2 rounded-md font-semibold text-[13px] transition-colors cursor-pointer flex items-center gap-1.5 flex-none shadow-xs
            ${orders.length > 0
              ? 'bg-[#1f5f8b] hover:bg-[#17496c] text-white border border-[#1f5f8b]'
              : 'bg-[#f6f7f9] text-[#a3a6ad] border border-[#dcdee3] cursor-not-allowed'
            }
          `}
        >
          <PackageCheck className="w-4 h-4" />
          <span>Check in a delivery</span>
        </button>
      </div>

      {/* Main Body */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 space-y-8">
        {/* TO ORDER SECTION */}
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div>
              <h2 className="text-[18px] font-bold tracking-tight text-[#191c20]">To order</h2>
              <p className="text-[13px] text-[#6c6f77] mt-0.5">
                All order quantities default to 0. Enter your desired quantities or use smart suggestions to order full packs.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 flex-none">
              <button
                type="button"
                onClick={handleAddBundleEnglishTracts}
                className="px-3 py-1.5 border border-[#c9cbd2] bg-white hover:bg-[#f6f7f9] text-[#44474e] text-[12.5px] font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Layers className="w-3.5 h-3.5 text-[#1f5f8b]" />
                <span>Bundle: All English tracts (600 pcs)</span>
              </button>
              {lowCount > 0 && (
                <button
                  type="button"
                  onClick={handleFillAllSuggestions}
                  title="Fill smart suggested order quantities for all items currently below their reorder threshold"
                  className="px-3 py-1.5 border border-[#c9cbd2] bg-white hover:bg-[#f6f7f9] text-[#1f5f8b] text-[12.5px] font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#1f5f8b]" />
                  <span>Fill low-stock suggestions</span>
                </button>
              )}
              {hasCustomQtys && (
                <button
                  type="button"
                  onClick={handleResetAllToZero}
                  className="px-3 py-1.5 border border-[#c9cbd2] bg-white hover:bg-[#f6f7f9] text-[#8b8e96] hover:text-[#b3261e] text-[12.5px] font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset all to 0</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleOrderSelected}
                disabled={readyToOrderCount === 0}
                className="px-4 py-1.5 bg-[#1f5f8b] hover:bg-[#17496c] text-white text-[12.5px] font-semibold rounded-md transition-colors cursor-pointer disabled:opacity-40 shadow-xs flex items-center gap-1.5"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Mark selected as ordered ({readyToOrderCount})</span>
              </button>
            </div>
          </div>

          {/* Filter Bar: Tabs + Search + Category */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            {/* View Mode Tabs */}
            <div className="inline-flex rounded-lg border border-[#dcdee3] bg-[#f6f7f9] p-0.5">
              <button
                type="button"
                onClick={() => setViewFilter('all')}
                className={`px-3.5 py-1.5 text-[12.5px] font-semibold rounded-md transition-colors cursor-pointer ${
                  viewFilter === 'all'
                    ? 'bg-white text-[#191c20] shadow-xs'
                    : 'text-[#6c6f77] hover:text-[#191c20]'
                }`}
              >
                All items ({allItems.length})
              </button>
              <button
                type="button"
                onClick={() => setViewFilter('low')}
                className={`px-3.5 py-1.5 text-[12.5px] font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                  viewFilter === 'low'
                    ? 'bg-white text-[#191c20] shadow-xs'
                    : 'text-[#6c6f77] hover:text-[#191c20]'
                }`}
              >
                <span>Needs reorder</span>
                {lowCount > 0 && (
                  <span className="bg-[#8a5a00]/10 text-[#8a5a00] text-[10.5px] font-bold px-1.5 py-0.2 rounded-full">
                    {lowCount}
                  </span>
                )}
              </button>
            </div>

            {/* Search and Category Filter */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-56">
                <Search className="w-3.5 h-3.5 text-[#8b8e96] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search editions or codes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-[#c9cbd2] rounded-md text-[12.5px] text-[#191c20] bg-white outline-none focus:border-[#1f5f8b]"
                />
              </div>
              <select
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value)}
                className="px-3 py-1.5 border border-[#c9cbd2] rounded-md text-[12.5px] font-medium text-[#191c20] bg-white outline-none focus:border-[#1f5f8b]"
              >
                <option value="All">All categories</option>
                <option value="Bible">Bibles</option>
                <option value="Booklet">Booklets</option>
                <option value="Tract">Tracts</option>
              </select>
            </div>
          </div>

          {/* Table of Items to order */}
          <div className="border border-[#dcdee3] rounded-lg overflow-hidden bg-white shadow-xs">
            <div className="grid grid-cols-[36px_1fr_80px_68px_68px_165px_60px] items-center px-4 py-2.5 bg-[#f6f7f9] border-b border-[#dcdee3] text-[10px] font-bold tracking-wider uppercase text-[#6c6f77]">
              <div>
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={handleToggleSelectAllVisible}
                  title="Toggle select all visible items"
                  className="rounded-sm text-[#1f5f8b] focus:ring-0 cursor-pointer"
                />
              </div>
              <div>Edition</div>
              <div>Code</div>
              <div className="text-right">In store</div>
              <div className="text-right">Reorder</div>
              <div className="text-right pr-1">Order qty</div>
              <div className="text-right">Pack</div>
            </div>

            {filteredItems.length === 0 ? (
              <div className="py-12 text-center text-[#6c6f77] text-[13px]">
                {viewFilter === 'low'
                  ? 'No items are below their reorder points right now.'
                  : 'No editions match your search filter.'}
              </div>
            ) : (
              <div className="divide-y divide-[#eef0f3]">
                {filteredItems.map(c => {
                  const isChecked = !!selectedKeys[c.codeKey];
                  const isOnOrder = !!orderMap[c.codeKey];
                  // Default order quantity is strictly 0 for everything
                  const qtyVal = customQuantities[c.codeKey] !== undefined ? customQuantities[c.codeKey] : 0;

                  return (
                    <div
                      key={c.codeKey}
                      className={`
                        grid grid-cols-[36px_1fr_80px_68px_68px_165px_60px] items-center px-4 py-3 text-[13px] transition-colors
                        ${isOnOrder ? 'bg-[#fbfbfc] opacity-75' : isChecked ? 'bg-[#f6f9fb]' : 'bg-white'}
                      `}
                    >
                      <div>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isOnOrder}
                          onChange={() => handleToggleSelect(c.codeKey)}
                          className="rounded-sm text-[#1f5f8b] focus:ring-0 cursor-pointer disabled:opacity-40"
                        />
                      </div>

                      <div className="min-w-0 pr-3">
                        <div className="flex items-baseline gap-2">
                          <span className={`
                            text-[9px] font-bold px-1.5 py-0.5 rounded-xs flex-none
                            ${c.edition.lang === 'EN' ? 'text-[#1f5f8b] bg-[#e9f1f7]' : 'text-[#7a4a8b] bg-[#f4edf7]'}
                          `}>
                            {c.edition.lang}
                          </span>
                          <span className="font-semibold text-[#191c20] truncate">
                            {c.edition.title}
                          </span>
                          <span className="font-mono text-[10px] text-[#8b8e96] bg-[#f1f3f5] px-1.5 py-0.5 rounded tracking-tight border border-[#dcdee3]/60 flex-none">
                            {c.codeKey}
                          </span>
                        </div>
                        {isOnOrder ? (
                          <div className="text-[11.5px] text-[#8a5a00] font-medium mt-0.5">
                            Already on order ({orderMap[c.codeKey].qty} pcs)
                          </div>
                        ) : c.isLow ? (
                          <div className="text-[11px] text-[#8a5a00] font-medium mt-0.5">
                            Deficit: {c.at - c.edition.stock} below threshold ({c.at}) · Smart suggest: {c.suggest} ({Math.round(c.suggest / c.pack)} {Math.round(c.suggest / c.pack) === 1 ? 'pack' : 'packs'}) to reach ≥{c.at}
                          </div>
                        ) : (
                          <div className="text-[11px] text-[#8b8e96] mt-0.5">
                            Healthy stock ({c.edition.stock} on shelf · reorder threshold {c.at})
                          </div>
                        )}
                      </div>

                      <div className="font-mono text-[11px] text-[#8b8e96] truncate">
                        <span className="bg-[#f6f7f9] px-1.5 py-0.5 rounded text-[10.5px]">
                          {c.codeKey}
                        </span>
                      </div>

                      <div className={`text-right font-mono text-[13.5px] tabular-nums ${c.isLow ? 'font-bold text-[#8a5a00]' : 'text-[#191c20]'}`}>
                        {c.edition.stock}
                      </div>

                      <div className="text-right font-mono text-[13px] text-[#6c6f77] tabular-nums">
                        {c.at}
                      </div>

                      <div className="min-w-0 flex items-center justify-end gap-1.5 overflow-visible">
                        {c.isLow && c.suggest > 0 && qtyVal !== c.suggest && !isOnOrder && (
                          <button
                            type="button"
                            onClick={() => {
                              setCustomQuantities(prev => ({ ...prev, [c.codeKey]: c.suggest }));
                              setSelectedKeys(prev => ({ ...prev, [c.codeKey]: true }));
                            }}
                            title={`Set to smart suggested quantity (${c.suggest})`}
                            className="text-[10.5px] font-bold text-[#1f5f8b] bg-[#e9f1f7] hover:bg-[#d8e8f4] px-1.5 py-0.5 rounded transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                          >
                            +{c.suggest}
                          </button>
                        )}
                        <input
                          type="number"
                          min="0"
                          step={c.pack}
                          value={qtyVal}
                          disabled={isOnOrder}
                          onChange={(e) => {
                            const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                            setCustomQuantities(prev => ({ ...prev, [c.codeKey]: val }));
                            if (val > 0) {
                              setSelectedKeys(prev => ({ ...prev, [c.codeKey]: true }));
                            }
                          }}
                          className="w-16 min-w-[64px] max-w-[68px] px-2 py-1 border border-[#c9cbd2] rounded-md font-mono text-[13px] font-bold text-right text-[#191c20] bg-white focus:border-[#1f5f8b] outline-none tabular-nums disabled:bg-[#edeef4] shrink-0"
                        />
                        <div className="w-5 flex items-center justify-center shrink-0">
                          {qtyVal > 0 && !isOnOrder && (
                            <button
                              type="button"
                              onClick={() => {
                                setCustomQuantities(prev => ({ ...prev, [c.codeKey]: 0 }));
                              }}
                              title="Reset order quantity to 0"
                              className="p-1 text-[#8b8e96] hover:text-[#1f5f8b] cursor-pointer transition-colors"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="text-right font-mono text-[12.5px] text-[#8b8e96] tabular-nums">
                        {c.pack}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ON ORDER SECTION */}
        <div className="space-y-3">
          <h2 className="text-[18px] font-bold tracking-tight text-[#191c20]">Currently on order</h2>

          <div className="border border-[#dcdee3] rounded-lg overflow-hidden bg-white shadow-xs">
            <div className="grid grid-cols-[1fr_100px_100px_90px_70px] items-center px-4 py-2.5 bg-[#f6f7f9] border-b border-[#dcdee3] text-[10px] font-bold tracking-wider uppercase text-[#6c6f77]">
              <div>Item</div>
              <div>Code</div>
              <div>Ordered date</div>
              <div className="text-right">Quantity</div>
              <div className="text-right">Actions</div>
            </div>

            {orders.length === 0 ? (
              <div className="py-8 text-center text-[#6c6f77] text-[13px]">
                No outstanding orders.
              </div>
            ) : (
              <div className="divide-y divide-[#eef0f3]">
                {orders.map(o => (
                  <div
                    key={o.key}
                    className="grid grid-cols-[1fr_100px_100px_90px_70px] items-center px-4 py-3 text-[13px]"
                  >
                    <div className="min-w-0 pr-3">
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold text-[#191c20] truncate">
                          {o.title}
                        </span>
                        <span className="font-mono text-[10px] text-[#8b8e96] bg-[#f1f3f5] px-1.5 py-0.5 rounded tracking-tight border border-[#dcdee3]/60 flex-none">
                          {o.code}
                        </span>
                      </div>
                      {o.bundle && (
                        <div className="text-[11.5px] text-[#1f5f8b] font-medium mt-0.5">
                          Bundle · 1 pack each across 12 titles
                        </div>
                      )}
                    </div>

                    <div className="font-mono text-[11px] text-[#8b8e96] truncate">
                      <span className="bg-[#f6f7f9] px-1.5 py-0.5 rounded text-[10.5px]">
                        {o.code}
                      </span>
                    </div>

                    <div className="text-[12.5px] text-[#6c6f77]">
                      {o.orderedDate}
                    </div>

                    <div className="text-right font-mono text-[14px] font-bold text-[#191c20] tabular-nums">
                      {o.qty}
                    </div>

                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => onCancelOrder(o.key)}
                        className="text-[#8b8e96] hover:text-[#b3261e] p-1 cursor-pointer transition-colors"
                        title="Cancel this order"
                      >
                        <Trash2 className="w-4 h-4 ml-auto" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
