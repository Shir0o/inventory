import React, { useState, useEffect } from 'react';
import { X, Save, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { addInventoryItem, updateInventoryItem, deleteInventoryItem } from '../services/firestoreService';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  item?: any; // If present, we are editing
  settings?: any;
}

const InventoryModal = ({ isOpen, onClose, item, settings }: InventoryModalProps) => {
  const [formData, setFormData] = useState({
    sku: '',
    title: '',
    subtitle: '',
    category: 'Bibles',
    language: 'English',
    unitPrice: 0,
    stockLevel: 0,
    status: 'Healthy'
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (item) {
      setFormData({
        sku: item.sku || '',
        title: item.title || '',
        subtitle: item.subtitle || '',
        category: item.category || 'Bibles',
        language: item.language || 'English',
        unitPrice: item.unitPrice || 0,
        stockLevel: item.stockLevel || 0,
        status: item.status || 'Healthy'
      });
    } else {
      setFormData({
        sku: '',
        title: '',
        subtitle: '',
        category: 'Bibles',
        language: 'English',
        unitPrice: 0,
        stockLevel: 0,
        status: 'Healthy'
      });
    }
  }, [item, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
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
    } catch (error) {
      console.error("Failed to save inventory item", error);
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
            className="relative w-full max-w-lg bg-background ledger-card overflow-hidden"
          >
            <div className="indicator-primary" />
            <div className="px-8 py-6 border-b border-outline-variant flex justify-between items-center bg-surface-container">
              <h2 className="font-headline font-bold text-lg text-primary uppercase tracking-wider">
                {item ? 'Edit Inventory Item' : 'Add New Resource'}
              </h2>
              <button onClick={onClose} className="text-on-surface-variant hover:text-primary transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2 md:col-span-1 space-y-2">
                  <label className="font-headline font-bold text-[11px] text-on-surface-variant uppercase tracking-widest block">SKU / Reference ID</label>
                  <input 
                    required
                    type="text" 
                    value={formData.sku}
                    onChange={e => setFormData({...formData, sku: e.target.value})}
                    className="w-full border-0 border-b-2 border-surface-container bg-surface-container-low px-4 py-3 font-mono text-[14px] focus:ring-0 focus:border-primary transition-all"
                    placeholder="e.g. B-EN-001"
                  />
                </div>
                <div className="col-span-2 md:col-span-1 space-y-2">
                  <label className="font-headline font-bold text-[11px] text-on-surface-variant uppercase tracking-widest block">Category</label>
                  <select 
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                    className="w-full border-0 border-b-2 border-surface-container bg-surface-container-low px-4 py-3 font-sans text-[14px] focus:ring-0 focus:border-primary appearance-none"
                  >
                    <option>Bibles</option>
                    <option>Tracts</option>
                    <option>Study Guides</option>
                    <option>Magazines</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="font-headline font-bold text-[11px] text-on-surface-variant uppercase tracking-widest block">Primary Title</label>
                  <input 
                    required
                    type="text" 
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    className="w-full border-0 border-b-2 border-surface-container bg-surface-container-low px-4 py-3 font-sans text-[14px] focus:ring-0 focus:border-primary transition-all"
                    placeholder="e.g. The Great Controversy"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="font-headline font-bold text-[11px] text-on-surface-variant uppercase tracking-widest block">Subtitle / Edition</label>
                  <input 
                    type="text" 
                    value={formData.subtitle}
                    onChange={e => setFormData({...formData, subtitle: e.target.value})}
                    className="w-full border-0 border-b-2 border-surface-container bg-surface-container-low px-4 py-3 font-sans text-[14px] focus:ring-0 focus:border-primary transition-all"
                    placeholder="e.g. 1888 Edition - Hardcover"
                  />
                </div>
                <div className="col-span-2 md:col-span-1 space-y-2">
                  <label className="font-headline font-bold text-[11px] text-on-surface-variant uppercase tracking-widest block">Language</label>
                  <input 
                    type="text" 
                    value={formData.language}
                    onChange={e => setFormData({...formData, language: e.target.value})}
                    className="w-full border-0 border-b-2 border-surface-container bg-surface-container-low px-4 py-3 font-sans text-[14px] focus:ring-0 focus:border-primary transition-all"
                    placeholder="e.g. English"
                  />
                </div>
                <div className="col-span-2 md:col-span-1 space-y-2">
                  <label className="font-headline font-bold text-[11px] text-on-surface-variant uppercase tracking-widest block">Unit Price ($)</label>
                  <input 
                    required
                    type="number" 
                    step="0.01"
                    value={formData.unitPrice}
                    onChange={e => setFormData({...formData, unitPrice: parseFloat(e.target.value) || 0})}
                    className="w-full border-0 border-b-2 border-surface-container bg-surface-container-low px-4 py-3 font-mono text-[14px] focus:ring-0 focus:border-primary transition-all"
                  />
                </div>
                <div className="col-span-2 md:col-span-1 space-y-2">
                  <label className="font-headline font-bold text-[11px] text-on-surface-variant uppercase tracking-widest block">Stock Level</label>
                  <input 
                    required
                    type="number" 
                    value={formData.stockLevel}
                    onChange={e => setFormData({...formData, stockLevel: parseInt(e.target.value) || 0})}
                    className="w-full border-0 border-b-2 border-surface-container bg-surface-container-low px-4 py-3 font-mono text-[14px] focus:ring-0 focus:border-primary transition-all"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="font-headline font-bold text-[11px] text-on-surface-variant uppercase tracking-widest block">System Status</label>
                  <div className="flex gap-4">
                    {['Healthy', 'Low', 'Out'].map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setFormData({...formData, status: s})}
                        className={`flex-1 py-2 text-[11px] font-bold uppercase tracking-wider border-2 rounded-sharp transition-all ${
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

              <div className="pt-6 border-t border-outline-variant flex justify-between gap-4">
                {item && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-3 border-2 border-tertiary text-tertiary font-headline font-bold text-[12px] uppercase tracking-wider hover:bg-tertiary/5 transition-colors rounded-sharp disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                )}
                <div className="flex gap-4 ml-auto">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-3 text-on-surface-variant font-headline font-bold text-[12px] uppercase tracking-wider hover:bg-surface-container transition-colors rounded-sharp"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 px-8 py-3 bg-primary text-white font-headline font-bold text-[12px] uppercase tracking-wider hover:bg-primary-container transition-all rounded-sharp shadow-lg disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {loading ? 'Saving...' : (item ? 'Update Ledger' : 'Add to Ledger')}
                  </button>
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
