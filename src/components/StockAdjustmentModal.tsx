import React, { useState, useEffect } from 'react';
import { 
  X, 
  ArrowDownRight, 
  ArrowUpRight, 
  Minus, 
  Plus, 
  Calendar, 
  User, 
  Check, 
  AlertCircle,
  Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { recordDirectStockMovement } from '../services/firestoreService';
import { cn } from '../lib/utils';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: any;
  settings?: any;
}

const OUTFLOW_PRESETS = [
  'Gave to someone to pass to a friend',
  'One-on-one evangelism / outreach',
  'Visitor / Info desk direct handout',
  'Care package / Hospital visit',
  'Damaged / Lost copy removed',
  'Shelf count reconciliation'
];

const INFLOW_PRESETS = [
  'Direct purchase / shipment restock',
  'Personal donation / gift received',
  'Surplus returned from ministry',
  'Found misplaced copies'
];

export const StockAdjustmentModal = ({ isOpen, onClose, item, settings }: StockAdjustmentModalProps) => {
  const [movementType, setMovementType] = useState<'SUBTRACT' | 'ADD'>('SUBTRACT');
  const [quantity, setQuantity] = useState<number>(1);
  const [note, setNote] = useState('');
  const [recipient, setRecipient] = useState('');
  const [occurredDate, setOccurredDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const currentStock = item?.stockLevel ?? 0;
  const newStock = movementType === 'SUBTRACT' ? currentStock - quantity : currentStock + quantity;
  const isInvalidSubtract = movementType === 'SUBTRACT' && quantity > currentStock;

  useEffect(() => {
    if (isOpen) {
      setMovementType('SUBTRACT');
      setQuantity(1);
      setNote('');
      setRecipient('');
      setOccurredDate(new Date().toISOString().split('T')[0]);
      setError(null);
      setSuccessMessage(null);
    }
  }, [isOpen, item?.id]);

  const handleQuickPreset = (presetText: string) => {
    setNote(presetText);
  };

  const handleSetQuickDate = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    setOccurredDate(d.toISOString().split('T')[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item?.id) return;
    if (quantity <= 0) {
      setError('Please specify a quantity greater than 0.');
      return;
    }
    if (isInvalidSubtract) {
      setError(`Cannot subtract ${quantity} units. Available stock is only ${currentStock}.`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const thresholds = {
        warning: settings?.warningThreshold || 250,
        critical: settings?.criticalThreshold || 75
      };

      await recordDirectStockMovement(
        item.id,
        {
          type: movementType,
          quantity,
          note: note.trim() || undefined,
          recipient: recipient.trim() || undefined,
          occurredAt: occurredDate,
          reasonCategory: movementType === 'SUBTRACT' ? 'Direct / Personal Giving' : 'Direct Inflow / Restock'
        },
        thresholds
      );

      setSuccessMessage(
        movementType === 'SUBTRACT'
          ? `Successfully recorded outflow of ${quantity} unit(s).`
          : `Successfully added ${quantity} unit(s) to stock.`
      );

      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err.message || 'Failed to record stock movement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && item && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
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
            className="relative w-full max-w-xl bg-surface m3-elevated-card rounded-[28px] overflow-hidden flex flex-col max-h-[92vh] border border-outline-variant/40 shadow-2xl"
          >
            <div className={movementType === 'SUBTRACT' ? 'indicator-tertiary' : 'indicator-secondary'} />
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container shrink-0">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-sharp",
                  movementType === 'SUBTRACT' ? "bg-tertiary/10 text-tertiary" : "bg-secondary/10 text-secondary"
                )}>
                  {movementType === 'SUBTRACT' ? (
                    <ArrowDownRight className="w-5 h-5" />
                  ) : (
                    <ArrowUpRight className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h2 className="font-headline font-bold text-base text-primary uppercase tracking-wider">
                    Log Stock Movement
                  </h2>
                  <p className="text-[11px] font-mono text-on-surface-variant">
                    {item.sku} • <span className="font-bold text-primary">{item.title}</span>
                  </p>
                </div>
              </div>
              <button 
                onClick={onClose} 
                className="text-on-surface-variant hover:text-primary transition-colors p-2 rounded-sharp hover:bg-surface-container-high"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
              
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-surface-container rounded-sharp border border-outline-variant">
                <button
                  type="button"
                  onClick={() => {
                    setMovementType('SUBTRACT');
                    setError(null);
                  }}
                  className={cn(
                    "flex items-center justify-center gap-2 py-2.5 px-3 rounded-sharp font-headline font-bold text-[11px] uppercase tracking-wider transition-all",
                    movementType === 'SUBTRACT'
                      ? "bg-tertiary text-white shadow-sm"
                      : "text-on-surface-variant hover:text-primary hover:bg-surface-container-high"
                  )}
                >
                  <ArrowDownRight className="w-4 h-4" />
                  <span>Outflow / Subtract</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMovementType('ADD');
                    setError(null);
                  }}
                  className={cn(
                    "flex items-center justify-center gap-2 py-2.5 px-3 rounded-sharp font-headline font-bold text-[11px] uppercase tracking-wider transition-all",
                    movementType === 'ADD'
                      ? "bg-secondary text-white shadow-sm"
                      : "text-on-surface-variant hover:text-primary hover:bg-surface-container-high"
                  )}
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>Inflow / Restock</span>
                </button>
              </div>

              {/* Quantity Selector & Stock Calculation Box */}
              <div className="bg-surface-container-low p-4 rounded-sharp border border-outline-variant space-y-3">
                <div className="flex justify-between items-center">
                  <label className="font-headline font-bold text-[11px] text-on-surface-variant uppercase tracking-widest block">
                    Quantity to {movementType === 'SUBTRACT' ? 'Subtract / Give' : 'Add / Restock'}
                  </label>
                  <span className="font-mono text-xs text-on-surface-variant">
                    Current Stock: <strong className="text-primary">{currentStock}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    className="p-3 bg-surface hover:bg-surface-container-high border border-outline-variant rounded-sharp text-primary disabled:opacity-40 transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>

                  <input
                    type="number"
                    min="1"
                    max={movementType === 'SUBTRACT' ? currentStock : 99999}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full text-center font-mono font-bold text-lg py-2 bg-surface border border-outline-variant focus:border-primary focus:ring-0 rounded-sharp"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      if (movementType === 'SUBTRACT' && quantity >= currentStock) return;
                      setQuantity(quantity + 1);
                    }}
                    disabled={movementType === 'SUBTRACT' && quantity >= currentStock}
                    className="p-3 bg-surface hover:bg-surface-container-high border border-outline-variant rounded-sharp text-primary disabled:opacity-40 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Quick Quantity Chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] font-mono text-on-surface-variant uppercase mr-1">Quick:</span>
                  {[1, 2, 5, 10].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setQuantity(num)}
                      disabled={movementType === 'SUBTRACT' && num > currentStock}
                      className={cn(
                        "text-[10px] font-mono px-2 py-0.5 rounded-sharp border transition-all disabled:opacity-30",
                        quantity === num
                          ? "bg-primary text-white border-primary"
                          : "bg-surface hover:bg-surface-container-high border-outline-variant text-on-surface"
                      )}
                    >
                      {movementType === 'ADD' ? `+${num}` : num}
                    </button>
                  ))}
                  {movementType === 'SUBTRACT' && currentStock > 0 && currentStock <= 50 && (
                    <button
                      type="button"
                      onClick={() => setQuantity(currentStock)}
                      className={cn(
                        "text-[10px] font-mono px-2 py-0.5 rounded-sharp border transition-all",
                        quantity === currentStock
                          ? "bg-primary text-white border-primary"
                          : "bg-surface hover:bg-surface-container-high border-outline-variant text-tertiary font-bold"
                      )}
                    >
                      All ({currentStock})
                    </button>
                  )}
                </div>

                {/* Live Diff Preview */}
                <div className="pt-2 border-t border-outline-variant/60 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-on-surface-variant">Resulting Balance:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 line-through">{currentStock}</span>
                    <span className="text-on-surface-variant">➔</span>
                    <span className={cn(
                      "font-bold px-2 py-0.5 rounded-sharp",
                      isInvalidSubtract
                        ? "bg-tertiary/20 text-tertiary font-bold"
                        : "bg-primary/10 text-primary"
                    )}>
                      {isInvalidSubtract ? 'Insufficient Stock' : `${newStock} units`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Note / Context Description */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="font-headline font-bold text-[11px] text-on-surface-variant uppercase tracking-widest block">
                    Context / Story / Note <span className="text-primary font-mono text-[10px]">(e.g. reason or who it was for)</span>
                  </label>
                </div>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={
                    movementType === 'SUBTRACT'
                      ? "e.g. Gave one bible to someone to give to friend, personal evangelism at train station..."
                      : "e.g. Direct purchase donation from church member, carton unboxed..."
                  }
                  className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant focus:border-primary focus:ring-0 text-sm px-4 py-2.5 transition-all resize-none"
                />

                {/* Quick Presets */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-headline uppercase font-bold text-on-surface-variant tracking-wider block">
                    Quick suggestions:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(movementType === 'SUBTRACT' ? OUTFLOW_PRESETS : INFLOW_PRESETS).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleQuickPreset(preset)}
                        className={cn(
                          "text-[10px] px-2.5 py-1 rounded-sharp border transition-all text-left",
                          note === preset
                            ? "bg-primary text-white border-primary font-bold"
                            : "bg-surface hover:bg-surface-container-high border-outline-variant text-on-surface-variant hover:text-primary"
                        )}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Retrospective Metadata: Date & Recipient */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-outline-variant/60">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-on-surface-variant" />
                    <label className="font-headline font-bold text-[10px] text-on-surface-variant uppercase tracking-widest">
                      {movementType === 'SUBTRACT' ? 'Given To / Handled By' : 'Received By / Source'}
                    </label>
                  </div>
                  <input
                    type="text"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="e.g. John (for friend), Sarah..."
                    className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant focus:border-primary focus:ring-0 text-xs px-3 py-2 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-on-surface-variant" />
                      <label className="font-headline font-bold text-[10px] text-on-surface-variant uppercase tracking-widest">
                        Date of Movement
                      </label>
                    </div>
                  </div>
                  <input
                    type="date"
                    value={occurredDate}
                    onChange={(e) => setOccurredDate(e.target.value)}
                    className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant focus:border-primary focus:ring-0 text-xs px-3 py-1.5 transition-all font-mono"
                  />
                  <div className="flex gap-1 pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleSetQuickDate(0)}
                      className="text-[9px] font-mono text-on-surface-variant hover:text-primary underline"
                    >
                      Today
                    </button>
                    <span className="text-[9px] text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={() => handleSetQuickDate(1)}
                      className="text-[9px] font-mono text-on-surface-variant hover:text-primary underline"
                    >
                      Yesterday
                    </button>
                    <span className="text-[9px] text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={() => handleSetQuickDate(7)}
                      className="text-[9px] font-mono text-on-surface-variant hover:text-primary underline"
                    >
                      Last Week
                    </button>
                  </div>
                </div>
              </div>

              {/* Error feedback */}
              {error && (
                <div className="p-3 bg-tertiary/10 border border-tertiary/20 rounded-sharp flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-tertiary shrink-0" />
                  <p className="text-[11px] text-tertiary font-bold">{error}</p>
                </div>
              )}

              {/* Success feedback */}
              {successMessage && (
                <div className="p-3 bg-secondary/10 border border-secondary/20 rounded-sharp flex items-center gap-2">
                  <Check className="w-4 h-4 text-secondary shrink-0" />
                  <p className="text-[11px] text-secondary font-bold">{successMessage}</p>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-1/3 py-3 border border-outline-variant font-headline font-bold text-[11px] uppercase tracking-wider text-on-surface-variant hover:bg-surface-container rounded-sharp transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || isInvalidSubtract}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-3 text-white font-headline font-bold text-[11px] uppercase tracking-wider rounded-sharp shadow-lg transition-all disabled:opacity-50",
                    movementType === 'SUBTRACT'
                      ? "bg-tertiary hover:bg-tertiary/90"
                      : "bg-secondary hover:bg-secondary/90"
                  )}
                >
                  {loading ? (
                    'Recording...'
                  ) : movementType === 'SUBTRACT' ? (
                    <>
                      <ArrowDownRight className="w-4 h-4" />
                      <span>Record Outflow (-{quantity} {quantity === 1 ? 'unit' : 'units'})</span>
                    </>
                  ) : (
                    <>
                      <ArrowUpRight className="w-4 h-4" />
                      <span>Record Inflow (+{quantity} {quantity === 1 ? 'unit' : 'units'})</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
