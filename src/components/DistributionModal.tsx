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
            className="absolute inset-0 bg-primary/40 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-4xl bg-background ledger-card overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="indicator-primary" />
            <div className="px-8 py-6 border-b border-outline-variant flex justify-between items-center bg-surface-container">
              <div className="flex items-center gap-3">
                <ShoppingCart className="w-6 h-6 text-primary" />
                <h2 className="font-headline font-bold text-lg text-primary uppercase tracking-wider">
                  Outreach Material Distribution
                </h2>
              </div>
              <button onClick={onClose} className="text-on-surface-variant hover:text-primary transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
              {/* Left Side: Inventory Selection */}
              <div className="flex-1 p-6 border-r border-outline-variant overflow-y-auto">
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search inventory to add..."
                      className="w-full pl-10 pr-4 py-2 bg-surface-container-low border-0 border-b-2 border-outline-variant focus:border-primary focus:ring-0 text-sm transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {filteredInventory.map(item => (
                      <button
                        key={item.id}
                        onClick={() => addToCart(item)}
                        className="flex items-center justify-between p-3 hover:bg-surface-container transition-colors text-left rounded-sharp group border border-transparent hover:border-outline-variant"
                      >
                        <div>
                          <p className="font-bold text-[13px] text-primary">{item.title}</p>
                          <p className="text-[11px] font-mono text-on-surface-variant">{item.sku} • {item.stockLevel} in stock</p>
                        </div>
                        <Plus className="w-4 h-4 text-slate-400 group-hover:text-primary" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Side: Cart and Event Selection */}
              <div className="w-full md:w-80 bg-surface-container-low p-6 flex flex-col">
                <form onSubmit={handleSubmit} className="flex flex-col h-full space-y-6">
                  <div className="space-y-2">
                    <label className="font-headline font-bold text-[11px] text-on-surface-variant uppercase tracking-widest block">Assign to Event</label>
                    <select 
                      required
                      value={selectedEventId}
                      onChange={e => setSelectedEventId(e.target.value)}
                      className="w-full px-4 py-2 bg-surface border-0 border-b-2 border-outline-variant focus:border-primary focus:ring-0 text-sm appearance-none"
                    >
                      <option value="">Select Event...</option>
                      {events.map(e => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3">
                    <label className="font-headline font-bold text-[11px] text-on-surface-variant uppercase tracking-widest block">Selected Materials ({cart.length})</label>
                    {cart.length === 0 ? (
                      <div className="py-8 text-center border-2 border-dashed border-outline-variant rounded-sharp">
                        <p className="text-[11px] font-mono text-on-surface-variant uppercase tracking-widest">Cart is empty</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {cart.map(item => (
                          <div key={item.itemId} className="bg-surface p-3 rounded-sharp border border-outline-variant space-y-2">
                            <div className="flex justify-between items-start">
                              <p className="font-bold text-[12px] text-primary leading-tight">{item.title}</p>
                              <button 
                                type="button"
                                onClick={() => removeFromCart(item.itemId)}
                                className="text-tertiary hover:text-tertiary/80"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono text-on-surface-variant">{item.sku}</span>
                              <div className="flex items-center gap-2">
                                <button 
                                  type="button"
                                  onClick={() => updateQuantity(item.itemId, -1)}
                                  className="p-1 hover:bg-surface-container rounded-sharp"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="font-mono font-bold text-[12px] w-8 text-center">{item.quantity}</span>
                                <button 
                                  type="button"
                                  onClick={() => updateQuantity(item.itemId, 1)}
                                  className="p-1 hover:bg-surface-container rounded-sharp"
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
                    <div className="p-3 bg-tertiary/10 border border-tertiary/20 rounded-sharp">
                      <p className="text-[11px] text-tertiary font-bold">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !selectedEventId || cart.length === 0}
                    className="w-full flex items-center justify-center gap-2 px-8 py-3 bg-primary text-white font-headline font-bold text-[12px] uppercase tracking-wider hover:bg-primary-container transition-all rounded-sharp shadow-lg disabled:opacity-50"
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
