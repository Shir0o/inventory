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
    stockLevel: 0,
    status: 'Healthy'
  });
  const [loading, setLoading] = useState(false);
  const [skuError, setSkuError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setFormData({
        sku: item.sku || '',
        title: item.title || '',
        subtitle: item.subtitle || '',
        category: item.category || 'Bibles',
        language: item.language || 'English',
        stockLevel: item.stockLevel || 0,
        status: item.status || 'Healthy'
      });
      setSkuError(null);
    } else {
      setFormData({
        sku: '',
        title: '',
        subtitle: '',
        category: 'Bibles',
        language: 'English',
        stockLevel: 0,
        status: 'Healthy'
      });
      setSkuError(null);
    }
  }, [item, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSkuError(null);
    try {
      const thresholds = {
        warning: settings?.warningThreshold || 250,
        critical: settings?.criticalThreshold || 75
      };

      if (item?.id) {
        await updateInventoryItem(item.id, formData, thresholds);
      } else {
        await addInventoryItem(formData);
      }
      onClose();
    } catch (error: any) {
      console.error("Failed to save inventory item", error);
      if (error.message?.includes('already exists')) {
        setSkuError(error.message);
      } else {
        alert("Failed to save item. Check logs for details.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!item?.id || !confirm("Are you sure you want to delete this item?")) return;
    setLoading(true);
    try {
      await deleteInventoryItem(item.id);
      onClose();
    } catch (error) {
      console.error("Failed to delete inventory item", error);
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
            className="relative w-full max-w-lg bg-background ledger-card overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh]"
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
                  <label className="font-headline font-bold text-[10px] sm:text-[11px] text-on-surface-variant uppercase tracking-widest block">Stock Level</label>
                  <input 
                    required
                    type="number" 
                    value={formData.stockLevel}
                    onChange={e => setFormData({...formData, stockLevel: parseInt(e.target.value) || 0})}
                    className="w-full border-0 border-b-2 border-surface-container bg-surface-container-low px-4 py-2 sm:py-3 font-mono text-sm focus:ring-0 focus:border-primary transition-all"
                  />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <label className="font-headline font-bold text-[10px] sm:text-[11px] text-on-surface-variant uppercase tracking-widest block">System Status</label>
                  <div className="flex gap-2 sm:gap-4">
                    {['Healthy', 'Low', 'Out'].map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setFormData({...formData, status: s})}
                        className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider border-2 rounded-sharp transition-all ${
                          formData.status === s 
                            ? 'bg-primary text-white border-primary' 
                            : 'border-outline-variant text-on-surface-variant hover:border-primary/50'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-outline-variant flex flex-col-reverse sm:flex-row justify-between gap-4 shrink-0">
                {item && isAdmin && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={loading}
                    className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 border-2 border-tertiary text-tertiary font-headline font-bold text-[11px] uppercase tracking-wider hover:bg-tertiary/5 transition-colors rounded-sharp disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
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
