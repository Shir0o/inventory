import React, { useState, useEffect } from 'react';
import { X, Save, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { addInventoryItem, updateInventoryItem, deleteInventoryItem, getInventoryItemBySku } from '../services/firestoreService';
import { cn } from '../lib/utils';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  item?: any; // If present, we are editing
  settings?: any;
  isAdmin?: boolean;
}

const InventoryModal = ({ isOpen, onClose, item, settings, isAdmin = false }: InventoryModalProps) => {
  const [formData, setFormData] = useState({
    sku: '',
    title: '',
    subtitle: '',
    category: 'Bibles',
    language: 'English',
    stockLevel: 0
  });
  const [editNote, setEditNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [skuError, setSkuError] = useState<string | null>(null);
  
  const [showItemDeleteConfirm, setShowItemDeleteConfirm] = useState(false);
  const [modalFeedback, setModalFeedback] = useState<{ type: 'error' | 'success', message: string } | null>(null);

  const NOTE_PRESETS = [
    'Gave one to someone to pass to a friend',
    'Personal one-on-one outreach / evangelism',
    'Visitor / Info desk direct copy handed out',
    'Care package / Hospital visit',
    'Damaged / Lost copy removed',
    'Shelf inventory recount reconciliation',
    'Direct restock / shipment unboxed'
  ];

  useEffect(() => {
    setShowItemDeleteConfirm(false);
    setModalFeedback(null);
    setEditNote('');
    if (item) {
      setFormData({
        sku: item.sku || '',
        title: item.title || '',
        subtitle: item.subtitle || '',
        category: item.category || 'Bibles',
        language: item.language || 'English',
        stockLevel: item.stockLevel || 0
      });
      setSkuError(null);
    } else {
      setFormData({
        sku: '',
        title: '',
        subtitle: '',
        category: 'Bibles',
        language: 'English',
        stockLevel: 0
      });
      setSkuError(null);
    }
  }, [item, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSkuError(null);
    setModalFeedback(null);
    try {
      const thresholds = {
        warning: settings?.warningThreshold || 250,
        critical: settings?.criticalThreshold || 75
      };

      if (item?.id) {
        await updateInventoryItem(item.id, formData, thresholds, editNote.trim() || undefined);
      } else {
        await addInventoryItem(formData, thresholds);
      }
      onClose();
    } catch (error: any) {
      console.error("Failed to save inventory item", error);
      if (error.message?.includes('already exists')) {
        setSkuError(error.message);
      } else {
        let errMsg = "Failed to save item. Check your role/permissions or logs.";
        try {
          if (error?.message) {
            const parsed = JSON.parse(error.message);
            if (parsed.error) errMsg = parsed.error;
          }
        } catch (_) {}
        setModalFeedback({ type: 'error', message: errMsg });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!item?.id) return;
    setLoading(true);
    setModalFeedback(null);
    try {
      await deleteInventoryItem(item.id);
      onClose();
    } catch (error: any) {
      console.error("Failed to delete inventory item", error);
      let errMsg = "Failed to delete item. Check your role/permissions.";
      try {
        if (error?.message) {
          const parsed = JSON.parse(error.message);
          if (parsed.error) errMsg = parsed.error;
        }
      } catch (_) {}
      setModalFeedback({ type: 'error', message: errMsg });
      setShowItemDeleteConfirm(false);
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
            className="relative w-full max-w-lg bg-surface m3-elevated-card rounded-[28px] overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh] border border-outline-variant/40"
          >
            <div className="indicator-primary" />
            <div className="px-6 sm:px-8 py-4 sm:py-6 border-b border-outline-variant flex justify-between items-center bg-surface-container shrink-0">
              <h2 className="font-headline font-bold text-base sm:text-lg text-primary uppercase tracking-wider">
                {item ? 'Edit Resource' : 'Add New Resource'}
              </h2>
              <button onClick={onClose} className="text-on-surface-variant hover:text-primary transition-colors p-2">
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            {modalFeedback && (
              <div onClick={() => setModalFeedback(null)} className={cn(
                "mx-6 sm:mx-8 mt-4 p-3 font-headline font-semibold text-xs rounded-sharp cursor-pointer border flex justify-between items-center transition-all animate-in fade-in slide-in-from-top-2 shrink-0",
                modalFeedback.type === 'error' 
                  ? 'bg-tertiary/10 border-tertiary/20 text-tertiary font-bold' 
                  : 'bg-secondary/10 border-secondary/20 text-primary font-bold'
              )}>
                <span className="flex-1">{modalFeedback.message}</span>
                <span className="text-[9px] font-mono font-bold uppercase tracking-widest opacity-60 ml-2 select-none">Dismiss</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-2">
                  <label className="font-headline font-bold text-[10px] sm:text-[11px] text-on-surface-variant uppercase tracking-widest block">SKU / Reference ID</label>
                  <input 
                    required
                    type="text" 
                    value={formData.sku}
                    disabled={!!item}
                    onChange={e => {
                      setFormData({...formData, sku: e.target.value.toUpperCase()});
                      setSkuError(null);
                    }}
                    onBlur={async (e) => {
                      if (!item && e.target.value) {
                        const existing = await getInventoryItemBySku(e.target.value.toUpperCase());
                        if (existing) {
                          setSkuError(`SKU "${e.target.value.toUpperCase()}" already exists.`);
                        }
                      }
                    }}
                    className={cn(
                      "w-full border-0 border-b-2 bg-surface-container-low px-4 py-2 sm:py-3 font-mono text-sm focus:ring-0 transition-all",
                      skuError ? "border-tertiary focus:border-tertiary" : "border-surface-container focus:border-primary"
                    )}
                    placeholder="e.g. B-EN-001"
                  />
                  {skuError && <p className="text-[10px] text-tertiary font-headline font-bold uppercase tracking-wider">{skuError}</p>}
                </div>
                <div className="space-y-2">
                  <label className="font-headline font-bold text-[10px] sm:text-[11px] text-on-surface-variant uppercase tracking-widest block">Category</label>
                  <select 
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                    className="w-full border-0 border-b-2 border-surface-container bg-surface-container-low px-4 py-2 sm:py-3 font-sans text-sm focus:ring-0 focus:border-primary appearance-none"
                  >
                    {(settings?.categories || ['Bibles', 'Tracts', 'Booklets']).map((cat: string) => (
                      <option key={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <label className="font-headline font-bold text-[10px] sm:text-[11px] text-on-surface-variant uppercase tracking-widest block">Primary Title</label>
                  <input 
                    required
                    type="text" 
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    className="w-full border-0 border-b-2 border-surface-container bg-surface-container-low px-4 py-2 sm:py-3 font-sans text-sm focus:ring-0 focus:border-primary transition-all"
                    placeholder="e.g. The Great Controversy"
                  />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <label className="font-headline font-bold text-[10px] sm:text-[11px] text-on-surface-variant uppercase tracking-widest block">Subtitle / Edition</label>
                  <input 
                    type="text" 
                    value={formData.subtitle}
                    onChange={e => setFormData({...formData, subtitle: e.target.value})}
                    className="w-full border-0 border-b-2 border-surface-container bg-surface-container-low px-4 py-2 sm:py-3 font-sans text-sm focus:ring-0 focus:border-primary transition-all"
                    placeholder="e.g. 1888 Edition - Hardcover"
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-headline font-bold text-[10px] sm:text-[11px] text-on-surface-variant uppercase tracking-widest block">Language</label>
                  <select 
                    value={formData.language}
                    onChange={e => {
                      const lang = e.target.value;
                      let newSku = formData.sku;
                      
                      if (!item) {
                        const langKey = lang.toLowerCase();
                        let baseSku = formData.sku;
                        if (baseSku.endsWith('-001') || baseSku.endsWith('-002')) {
                          baseSku = baseSku.slice(0, -4);
                        }

                        if (langKey === 'english') newSku = `${baseSku}-001`;
                        else if (langKey === 'spanish') newSku = `${baseSku}-002`;
                        else newSku = baseSku;
                      }

                      setFormData({...formData, language: lang, sku: newSku});
                      setSkuError(null);
                    }}
                    className="w-full border-0 border-b-2 border-surface-container bg-surface-container-low px-4 py-2 sm:py-3 font-sans text-sm focus:ring-0 focus:border-primary appearance-none"
                  >
                    <option>English</option>
                    <option>Spanish</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="font-headline font-bold text-[10px] sm:text-[11px] text-on-surface-variant uppercase tracking-widest block">Stock Level</label>
                    {item && item.stockLevel !== undefined && (
                      <span className="font-mono text-[10px] text-on-surface-variant">
                        Current: <strong className="text-primary">{item.stockLevel}</strong>
                      </span>
                    )}
                  </div>
                  <input 
                    required
                    type="number" 
                    value={formData.stockLevel}
                    onChange={e => setFormData({...formData, stockLevel: parseInt(e.target.value) || 0})}
                    className="w-full border-0 border-b-2 border-surface-container bg-surface-container-low px-4 py-2 sm:py-3 font-mono text-sm focus:ring-0 focus:border-primary transition-all"
                  />
                  {item && item.stockLevel !== undefined && formData.stockLevel !== item.stockLevel && (
                    <div className="flex items-center gap-1.5 pt-1 text-[11px] font-mono">
                      <span className="text-on-surface-variant">Adjustment:</span>
                      <span className={cn(
                        "font-bold px-1.5 py-0.5 rounded",
                        formData.stockLevel > item.stockLevel 
                          ? "bg-secondary/15 text-secondary" 
                          : "bg-tertiary/15 text-tertiary"
                      )}>
                        {formData.stockLevel > item.stockLevel ? `+${formData.stockLevel - item.stockLevel}` : formData.stockLevel - item.stockLevel} units
                      </span>
                    </div>
                  )}
                </div>

                <div className="sm:col-span-2 space-y-2 pt-2 border-t border-dashed border-outline-variant/60">
                  <div className="flex justify-between items-center">
                    <label className="font-headline font-bold text-[10px] sm:text-[11px] text-on-surface-variant uppercase tracking-widest block">
                      Retrospective Context / Log Note
                    </label>
                    <span className="text-[9px] font-mono text-slate-400 uppercase">Optional • Saved to History</span>
                  </div>
                  
                  <input 
                    type="text" 
                    value={editNote}
                    onChange={e => setEditNote(e.target.value)}
                    className="w-full border-0 border-b-2 border-surface-container bg-surface-container-low px-4 py-2 sm:py-3 font-sans text-sm focus:ring-0 focus:border-primary transition-all"
                    placeholder="e.g. Gave one bible to someone to give to friend, shelf recount, outreach gift..."
                  />

                  <div className="space-y-1 pt-1">
                    <span className="text-[9px] font-headline font-bold uppercase tracking-wider text-on-surface-variant block">Quick suggestions:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {NOTE_PRESETS.map(preset => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            setEditNote(preset);
                          }}
                          className={cn(
                            "text-[10px] px-2 py-1 rounded-sharp border transition-all text-left font-medium",
                            editNote === preset
                              ? "bg-primary text-white border-primary shadow-sm"
                              : "bg-surface-container hover:bg-surface-container-high border-outline-variant text-on-surface-variant hover:text-primary"
                          )}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-outline-variant flex flex-col-reverse sm:flex-row justify-between gap-4 shrink-0">
                {item && isAdmin && (
                  showItemDeleteConfirm ? (
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={loading}
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-tertiary text-white font-headline font-bold text-[11px] uppercase tracking-wider hover:bg-tertiary-container transition-all rounded-sharp shadow-md w-full sm:w-auto animate-in fade-in zoom-in-95 duration-150"
                      >
                        <Trash2 className="w-4 h-4" />
                        Confirm Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowItemDeleteConfirm(false)}
                        className="px-4 py-3 border border-outline-variant text-on-surface-variant font-headline font-bold text-[11px] uppercase tracking-wider hover:bg-surface-container transition-colors rounded-sharp w-full sm:w-auto text-center"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowItemDeleteConfirm(true)}
                      disabled={loading}
                      className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 border-2 border-tertiary text-tertiary font-headline font-bold text-[11px] uppercase tracking-wider hover:bg-tertiary/5 transition-colors rounded-sharp disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  )
                )}
                <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 sm:ml-auto w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-3 text-on-surface-variant font-headline font-bold text-[11px] uppercase tracking-wider hover:bg-surface-container transition-colors rounded-sharp text-center"
                  >
                    {isAdmin ? 'Cancel' : 'Close'}
                  </button>
                  {isAdmin && (
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex items-center justify-center gap-2 px-8 py-3 bg-primary text-white font-headline font-bold text-[11px] uppercase tracking-wider hover:bg-primary-container transition-all rounded-sharp shadow-lg disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {loading ? 'Saving...' : (item ? 'Save Edits' : 'Add to Matrix')}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default InventoryModal;
