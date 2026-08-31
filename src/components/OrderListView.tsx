import React, { useState } from 'react';
import { Title, OrderItem } from '../types';
import { ShoppingCart, PackageCheck, Plus, Check, Trash2, ArrowLeft, Layers } from 'lucide-react';

interface OrderListViewProps {
  titles: Title[];
  orders: OrderItem[];
  onMarkOrdered: (items: { code: string; title: string; lang?: string; qty: number; packs?: number; bundle?: string }[]) => void;
  onReceiveDelivery: (receipts: { code: string; title: string; lang: 'EN' | 'ES'; qty: number }[], remainingOrders: OrderItem[]) => void;
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

  // Check-in state
  const [checkInQuantities, setCheckInQuantities] = useState<Record<string, number>>({});
  const [extraItemCode, setExtraItemCode] = useState('');
  const [extraItemQty, setExtraItemQty] = useState('');
  const [extraArrivals, setExtraArrivals] = useState<{ code: string; title: string; lang: 'EN' | 'ES'; qty: number }[]>([]);

  const reorderAt = (t: Title) => Math.round(t.reorder * reorderSensitivity);

  // Map of existing orders
  const orderMap: Record<string, OrderItem> = {};
  orders.forEach(o => { orderMap[o.key] = o; });

  // Gather flagged editions
  interface Candidate {
    title: Title;
    edition: Title['editions'][0];
    codeKey: string;
    at: number;
    suggest: number;
    pack: number;
  }

  const candidates: Candidate[] = [];
  titles.forEach(t => {
    t.editions.forEach(ed => {
      const at = reorderAt(t);
      if (ed.stock < at) {
        const target = at * 2;
        const need = Math.max(target - ed.stock, t.pack);
        const suggest = Math.ceil(need / t.pack) * t.pack;
        const codeKey = `${t.code}-${ed.lang}`;
        candidates.push({
          title: t,
          edition: ed,
          codeKey,
          at,
          suggest,
          pack: t.pack
        });
      }
    });
  });

  const handleToggleSelect = (codeKey: string) => {
    setSelectedKeys(prev => ({ ...prev, [codeKey]: !prev[codeKey] }));
  };

  const handleSelectAllCandidates = () => {
    const next: Record<string, boolean> = {};
    candidates.forEach(c => {
      if (!orderMap[c.codeKey]) next[c.codeKey] = true;
    });
    setSelectedKeys(next);
  };

  const handleOrderSelected = () => {
    const toOrder: { code: string; title: string; lang?: string; qty: number; packs?: number }[] = [];
    candidates.forEach(c => {
      if (selectedKeys[c.codeKey]) {
        const qty = customQuantities[c.codeKey] !== undefined ? customQuantities[c.codeKey] : c.suggest;
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
      setSelectedKeys({});
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
        const lang = (o.lang || (o.key.endsWith('-ES') ? 'ES' : 'EN')) as 'EN' | 'ES';
        if (arrivedQty > 0) {
          receipts.push({
            code: o.code,
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

    onReceiveDelivery(receipts, remainingOrders);
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
            Receiving <strong>{totalArriving.toLocaleString()}</strong> pieces into inventory.
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
  const selectedCount = Object.values(selectedKeys).filter(Boolean).length;

  return (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="px-6 py-6 border-b border-[#dcdee3] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-[#191c20]">Order list</h1>
          <p className="text-[13.5px] text-[#44474e] mt-1">
            {candidates.length} {candidates.length === 1 ? 'edition needs' : 'editions need'} reordering · {orders.length} items currently on order
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
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <h2 className="text-[18px] font-bold tracking-tight text-[#191c20]">To order</h2>
              <p className="text-[13px] text-[#6c6f77] mt-0.5">
                Editions that have fallen below their reorder point. Select which ones to place with the publisher.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-none">
              <button
                type="button"
                onClick={handleAddBundleEnglishTracts}
                className="px-3.5 py-1.5 border border-[#c9cbd2] bg-white hover:bg-[#f6f7f9] text-[#44474e] text-[12.5px] font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Layers className="w-3.5 h-3.5 text-[#1f5f8b]" />
                <span>Bundle: All English tracts (600 pcs)</span>
              </button>
              {candidates.length > 0 && (
                <button
                  type="button"
                  onClick={handleOrderSelected}
                  disabled={selectedCount === 0}
                  className="px-4 py-1.5 bg-[#1f5f8b] hover:bg-[#17496c] text-white text-[12.5px] font-semibold rounded-md transition-colors cursor-pointer disabled:opacity-40 shadow-xs"
                >
                  Mark selected as ordered ({selectedCount})
                </button>
              )}
            </div>
          </div>

          {/* Table of Flagged Items to order */}
          <div className="border border-[#dcdee3] rounded-lg overflow-hidden bg-white shadow-xs">
            <div className="grid grid-cols-[40px_1fr_90px_80px_80px_110px_70px] items-center px-4 py-2.5 bg-[#f6f7f9] border-b border-[#dcdee3] text-[10px] font-bold tracking-wider uppercase text-[#6c6f77]">
              <div>
                <input
                  type="checkbox"
                  checked={candidates.length > 0 && selectedCount === candidates.length}
                  onChange={handleSelectAllCandidates}
                  className="rounded-sm text-[#1f5f8b] focus:ring-0 cursor-pointer"
                />
              </div>
              <div>Edition</div>
              <div>Code</div>
              <div className="text-right">In store</div>
              <div className="text-right">Reorder</div>
              <div className="text-right">Order qty</div>
              <div className="text-right">Pack size</div>
            </div>

            {candidates.length === 0 ? (
              <div className="py-8 text-center text-[#6c6f77] text-[13px]">
                No items are below their reorder points right now.
              </div>
            ) : (
              <div className="divide-y divide-[#eef0f3]">
                {candidates.map(c => {
                  const isChecked = !!selectedKeys[c.codeKey];
                  const isOnOrder = !!orderMap[c.codeKey];
                  const qtyVal = customQuantities[c.codeKey] !== undefined ? customQuantities[c.codeKey] : c.suggest;

                  return (
                    <div
                      key={c.codeKey}
                      className={`
                        grid grid-cols-[40px_1fr_90px_80px_80px_110px_70px] items-center px-4 py-3 text-[13px] transition-colors
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
                        </div>
                        {isOnOrder && (
                          <div className="text-[11.5px] text-[#8a5a00] font-medium mt-0.5">
                            Already on order ({orderMap[c.codeKey].qty} pcs)
                          </div>
                        )}
                      </div>

                      <div className="font-mono text-[11px] text-[#6c6f77] truncate">
                        {c.codeKey}
                      </div>

                      <div className="text-right font-mono text-[13.5px] font-bold text-[#8a5a00] tabular-nums">
                        {c.edition.stock}
                      </div>

                      <div className="text-right font-mono text-[13px] text-[#6c6f77] tabular-nums">
                        {c.at}
                      </div>

                      <div className="flex justify-end">
                        <input
                          type="number"
                          min="0"
                          step={c.pack}
                          value={qtyVal}
                          disabled={isOnOrder}
                          onChange={(e) => {
                            const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                            setCustomQuantities({ ...customQuantities, [c.codeKey]: val });
                          }}
                          className="w-20 px-2 py-1 border border-[#c9cbd2] rounded-md font-mono text-[13px] font-bold text-right text-[#191c20] bg-white focus:border-[#1f5f8b] outline-none tabular-nums disabled:bg-[#edeef4]"
                        />
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
                      <div className="font-semibold text-[#191c20] truncate">
                        {o.title}
                      </div>
                      {o.bundle && (
                        <div className="text-[11.5px] text-[#1f5f8b] font-medium mt-0.5">
                          Bundle · 1 pack each across 12 titles
                        </div>
                      )}
                    </div>

                    <div className="font-mono text-[11px] text-[#6c6f77] truncate">
                      {o.code}
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
