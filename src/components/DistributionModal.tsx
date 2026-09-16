import React, { useState } from 'react';
import { X, ShoppingCart, Plus, Minus, Trash2, Search, Calendar, User, FileText, Send, CalendarDays } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { distributeItems, recordBatchDirectDistribution } from '../services/firestoreService';
import { cn } from '../lib/utils';

interface DistributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: any[];
  inventory: any[];
  settings?: any;
}

const DistributionModal = ({ isOpen, onClose, events, inventory, settings }: DistributionModalProps) => {
  const [distributionMode, setDistributionMode] = useState<'EVENT' | 'DIRECT'>('EVENT');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [directNote, setDirectNote] = useState('');
  const [directRecipient, setDirectRecipient] = useState('');
  const [occurredDate, setOccurredDate] = useState(() => new Date().toISOString().split('T')[0]);
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
    if (cart.length === 0) return;
    if (distributionMode === 'EVENT' && !selectedEventId) {
      setError("Please select a target event.");
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const thresholds = {
        warning: settings?.warningThreshold || 250,
        critical: settings?.criticalThreshold || 75
      };

      if (distributionMode === 'EVENT') {
        await distributeItems(selectedEventId, cart, thresholds);
      } else {
        await recordBatchDirectDistribution(
          cart,
          {
            recipient: directRecipient.trim() || undefined,
            note: directNote.trim() || undefined,
            occurredAt: occurredDate,
            category: 'Direct / Personal Distribution'
          },
          thresholds
        );
      }

      setCart([]);
      setSelectedEventId('');
      setDirectNote('');
      setDirectRecipient('');
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
            className="relative w-full max-w-4xl bg-surface m3-elevated-card rounded-[28px] overflow-hidden flex flex-col max-h-[90vh] border border-outline-variant/40"
          >
            <div className="indicator-primary" />
            <div className="px-6 sm:px-8 py-4 sm:py-6 border-b border-outline-variant flex justify-between items-center bg-surface-container shrink-0">
              <div className="flex items-center gap-3">
                <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                <div>
                  <h2 className="font-headline font-bold text-base sm:text-lg text-primary uppercase tracking-wider">
                    Material Distribution
                  </h2>
                  <p className="text-[10px] font-mono text-on-surface-variant uppercase">
                    Allocate literature to an event or log direct personal distribution
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="text-on-surface-variant hover:text-primary transition-colors p-2">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
              {/* Left Side: Inventory Selection */}
              <div className="flex-1 p-4 sm:p-6 border-b lg:border-b-0 lg:border-r border-outline-variant overflow-y-auto custom-scrollbar">
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search inventory to distribute..."
                      className="w-full pl-10 pr-4 py-2 bg-surface-container-low border-0 border-b-2 border-outline-variant focus:border-primary focus:ring-0 text-sm transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
                    {filteredInventory.map(item => (
                      <button
                        key={item.id}
                        onClick={() => addToCart(item)}
                        className="flex items-center justify-between p-3 hover:bg-surface-container transition-colors text-left rounded-sharp group border border-transparent hover:border-outline-variant bg-surface"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-[13px] text-primary line-clamp-1">{item.title}</p>
                            <span className="font-mono text-[9.5px] text-slate-500 bg-slate-100 px-1 py-0.5 rounded tracking-tight shrink-0">{item.sku}</span>
                          </div>
                          <p className="text-[11px] font-mono text-on-surface-variant whitespace-nowrap">{item.stockLevel} units available</p>
                        </div>
                        <Plus className="w-4 h-4 text-slate-400 group-hover:text-primary shrink-0 ml-2" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Side: Cart and Destination Selection */}
              <div className="w-full lg:w-96 bg-surface-container-low p-4 sm:p-6 flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
                <form onSubmit={handleSubmit} className="flex flex-col h-full space-y-4">
                  
                  {/* Mode Selector */}
                  <div className="space-y-1.5">
                    <label className="font-headline font-bold text-[10px] text-on-surface-variant uppercase tracking-widest block">Distribution Target</label>
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-surface-container rounded-sharp border border-outline-variant">
                      <button
                        type="button"
                        onClick={() => setDistributionMode('EVENT')}
                        className={cn(
                          "flex items-center justify-center gap-1.5 py-2 px-2 rounded-sharp font-headline font-bold text-[10px] uppercase tracking-wider transition-all",
                          distributionMode === 'EVENT'
                            ? "bg-primary text-white shadow-sm"
                            : "text-on-surface-variant hover:text-primary hover:bg-surface-container-high"
                        )}
                      >
                        <CalendarDays className="w-3.5 h-3.5" />
                        <span>To Event</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDistributionMode('DIRECT')}
                        className={cn(
                          "flex items-center justify-center gap-1.5 py-2 px-2 rounded-sharp font-headline font-bold text-[10px] uppercase tracking-wider transition-all",
                          distributionMode === 'DIRECT'
                            ? "bg-primary text-white shadow-sm"
                            : "text-on-surface-variant hover:text-primary hover:bg-surface-container-high"
                        )}
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Direct / Giving</span>
                      </button>
                    </div>
                  </div>

                  {distributionMode === 'EVENT' ? (
                    <div className="space-y-1.5">
                      <label className="font-headline font-bold text-[10px] text-on-surface-variant uppercase tracking-widest block">Assign to Event</label>
                      <select 
                        required={distributionMode === 'EVENT'}
                        value={selectedEventId}
                        onChange={e => setSelectedEventId(e.target.value)}
                        className="w-full px-3 py-2 bg-surface border-0 border-b-2 border-outline-variant focus:border-primary focus:ring-0 text-xs appearance-none"
                      >
                        <option value="">Select Target Event...</option>
                        {events.map(e => (
                          <option key={e.id} value={e.id}>{e.name}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-2 bg-surface p-3 rounded-sharp border border-outline-variant">
                      <div className="space-y-1">
                        <label className="font-headline font-bold text-[9px] text-on-surface-variant uppercase tracking-widest block">
                          Reason / Context / Story
                        </label>
                        <input
                          type="text"
                          value={directNote}
                          onChange={e => setDirectNote(e.target.value)}
                          placeholder="e.g. Gave to friend, personal evangelism..."
                          className="w-full bg-surface-container-low border-0 border-b border-outline-variant text-xs py-1.5 px-2 focus:border-primary focus:ring-0"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <label className="font-headline font-bold text-[9px] text-on-surface-variant uppercase tracking-widest block">Recipient</label>
                          <input
                            type="text"
                            value={directRecipient}
                            onChange={e => setDirectRecipient(e.target.value)}
                            placeholder="e.g. John..."
                            className="w-full bg-surface-container-low border-0 border-b border-outline-variant text-xs py-1 px-2 focus:border-primary focus:ring-0"
                          />
                        </div>
                        <div>
                          <label className="font-headline font-bold text-[9px] text-on-surface-variant uppercase tracking-widest block">Date</label>
                          <input
                            type="date"
                            value={occurredDate}
                            onChange={e => setOccurredDate(e.target.value)}
                            className="w-full bg-surface-container-low border-0 border-b border-outline-variant text-[11px] py-1 px-1 font-mono focus:border-primary focus:ring-0"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Cart Items List */}
                  <div className="flex-1 min-h-[140px] max-h-[220px] overflow-y-auto space-y-2 custom-scrollbar">
                    <label className="font-headline font-bold text-[10px] text-on-surface-variant uppercase tracking-widest block">
                      Allocated Resources ({cart.length})
                    </label>
                    {cart.length === 0 ? (
                      <div className="py-6 text-center border-2 border-dashed border-outline-variant rounded-sharp bg-surface/50">
                        <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest">Cart is empty</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {cart.map(item => (
                          <div key={item.itemId} className="bg-surface p-2.5 rounded-sharp border border-outline-variant space-y-1.5 shadow-sm">
                            <div className="flex justify-between items-start gap-2">
                              <p className="font-bold text-[11px] text-primary leading-tight line-clamp-1">{item.title}</p>
                              <button 
                                type="button"
                                onClick={() => removeFromCart(item.itemId)}
                                className="text-tertiary hover:text-tertiary/80 p-0.5 shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-mono text-on-surface-variant">{item.sku}</span>
                              <div className="flex items-center gap-1">
                                <button 
                                  type="button"
                                  onClick={() => updateQuantity(item.itemId, -1)}
                                  className="p-1 hover:bg-surface-container rounded-sharp border border-outline-variant"
                                >
                                  <Minus className="w-2.5 h-2.5" />
                                </button>
                                <span className="font-mono font-bold text-xs w-5 text-center">{item.quantity}</span>
                                <button 
                                  type="button"
                                  onClick={() => updateQuantity(item.itemId, 1)}
                                  className="p-1 hover:bg-surface-container rounded-sharp border border-outline-variant"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {error && (
                    <div className="p-2.5 bg-tertiary/10 border border-tertiary/20 rounded-sharp">
                      <p className="text-[11px] text-tertiary font-bold">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || (distributionMode === 'EVENT' && !selectedEventId) || cart.length === 0}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white font-headline font-bold text-[11px] uppercase tracking-wider hover:bg-primary/90 transition-all rounded-sharp shadow-lg disabled:opacity-50"
                  >
                    {loading ? 'Processing...' : distributionMode === 'EVENT' ? 'Complete Event Distribution' : 'Record Direct Giving'}
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

