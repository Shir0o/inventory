import React, { useState } from 'react';
import { X, ShoppingCart, Plus, Minus, Trash2, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { distributeItems } from '../services/firestoreService';

interface DistributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: any[];
  inventory: any[];
  settings?: any;
}

const DistributionModal = ({ isOpen, onClose, events, inventory, settings }: DistributionModalProps) => {
  const [selectedEventId, setSelectedEventId] = useState('');
  const [cart, setCart] = useState<{ itemId: string, quantity: number, title: string, sku: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredInventory = inventory.filter(item => 
    (item.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
     item.sku?.toLowerCase().includes(searchQuery.toLowerCase())) &&
    item.stockLevel > 0
  );

  const addToCart = (item: any) => {
    const existing = cart.find(c => c.itemId === item.id);
    if (existing) {
      if (existing.quantity < item.stockLevel) {
        setCart(cart.map(c => c.itemId === item.id ? { ...c, quantity: c.quantity + 1 } : c));
      }
    } else {
      setCart([...cart, { itemId: item.id, quantity: 1, title: item.title, sku: item.sku }]);
    }
  };

  const updateQuantity = (itemId: string, delta: number) => {
    const item = inventory.find(i => i.id === itemId);
    setCart(cart.map(c => {
      if (c.itemId === itemId) {
        const newQty = Math.max(1, Math.min(item?.stockLevel || 0, c.quantity + delta));
        return { ...c, quantity: newQty };
      }
      return c;
    }));
  };

  const removeFromCart = (itemId: string) => {
    setCart(cart.filter(c => c.itemId !== itemId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId || cart.length === 0) return;
    
    setLoading(true);
    setError(null);
    try {
      const thresholds = {
        warning: settings?.warningThreshold || 250,
        critical: settings?.criticalThreshold || 75
      };
      await distributeItems(selectedEventId, cart, thresholds);
      setCart([]);
      setSelectedEventId('');
      onClose();
    } catch (err: any) {
      setError(err.message || "Distribution failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-primary-600" />
                </div>
                <h2 className="font-display font-semibold text-lg text-gray-900">New Distribution</h2>
              </div>
              <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
              {/* Left Side: Inventory Selection */}
              <div className="flex-1 p-4 sm:p-6 border-b lg:border-b-0 lg:border-r border-gray-200 overflow-y-auto custom-scrollbar">
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search inventory..."
                      className="w-full pl-10 pr-4 py-2 bg-gray-50 border-0 border-b-2 border-gray-200 focus:border-primary-500 focus:ring-0 text-sm transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
                    {filteredInventory.map(item => (
                      <button
                        key={item.id}
                        onClick={() => addToCart(item)}
                        className="flex items-center justify-between p-3 hover:bg-gray-100 transition-colors text-left rounded-xl group border border-transparent hover:border-gray-200 bg-white"
                      >
                        <div>
                          <p className="font-bold text-[13px] text-primary-600 line-clamp-1">{item.title}</p>
                          <p className="text-[11px] font-mono text-gray-500 whitespace-nowrap">{item.sku} • {item.stockLevel} units</p>
                        </div>
                        <Plus className="w-4 h-4 text-gray-400 group-hover:text-primary-600 shrink-0 ml-2" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Side: Cart and Event Selection */}
              <div className="w-full lg:w-80 bg-gray-50 p-4 sm:p-6 flex flex-col shrink-0 overflow-y-auto lg:overflow-visible">
                <form onSubmit={handleSubmit} className="flex flex-col h-full space-y-6">
                  <div className="space-y-2">
                    <label className="font-display font-bold text-[10px] sm:text-[11px] text-gray-500 uppercase tracking-widest block">Assign to Event</label>
                    <select
                      required
                      value={selectedEventId}
                      onChange={e => setSelectedEventId(e.target.value)}
                      className="w-full px-4 py-2 bg-white border-0 border-b-2 border-gray-200 focus:border-primary-500 focus:ring-0 text-sm appearance-none"
                    >
                      <option value="">Select Target Event...</option>
                      {events.map(e => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex-1 min-h-[150px] lg:min-h-0 overflow-y-auto space-y-3 custom-scrollbar">
                    <label className="font-display font-bold text-[10px] sm:text-[11px] text-gray-500 uppercase tracking-widest block">Allocated Resources ({cart.length})</label>
                    {cart.length === 0 ? (
                      <div className="py-8 text-center border-2 border-dashed border-gray-200 rounded-xl bg-white/50">
                        <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Cart is empty</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {cart.map(item => (
                          <div key={item.itemId} className="bg-white p-3 rounded-xl border border-gray-200 space-y-2 shadow-sm">
                            <div className="flex justify-between items-start gap-2">
                              <p className="font-bold text-[12px] text-primary-600 leading-tight line-clamp-2">{item.title}</p>
                              <button
                                type="button"
                                onClick={() => removeFromCart(item.itemId)}
                                className="text-accent-600 hover:text-accent-700 p-1 shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono text-gray-500">{item.sku}</span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.itemId, -1)}
                                  className="p-1 hover:bg-gray-100 rounded-xl border border-gray-200"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="font-mono font-bold text-xs w-6 text-center">{item.quantity}</span>
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.itemId, 1)}
                                  className="p-1 hover:bg-gray-100 rounded-xl border border-gray-200"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {error && (
                    <div className="p-3 bg-accent-50 border border-accent-200 rounded-xl">
                      <p className="text-[11px] text-accent-700 font-bold">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !selectedEventId || cart.length === 0}
                    className="w-full flex items-center justify-center gap-2 px-8 py-3 bg-primary-600 text-white font-display font-bold text-[12px] uppercase tracking-wider hover:bg-primary-700 transition-all rounded-xl shadow-lg disabled:opacity-50"
                  >
                    {loading ? 'Processing...' : 'Complete Distribution'}
                  </button>
                </form>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default DistributionModal;
