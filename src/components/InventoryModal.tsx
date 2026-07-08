import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { addInventoryItem, updateInventoryItem, deleteInventoryItem, getInventoryItemBySku } from '../services/firestoreService';
import { cn } from '../lib/utils';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  item?: any;
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
  const [loading, setLoading] = useState(false);
  const [skuError, setSkuError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success', message: string } | null>(null);

  useEffect(() => {
    setShowDeleteConfirm(false);
    setFeedback(null);
    if (item) {
      setFormData({
        sku: item.sku || '',
        title: item.title || '',
        subtitle: item.subtitle || '',
        category: item.category || 'Bibles',
        language: item.language || 'English',
        stockLevel: item.stockLevel || 0
      });
    } else {
      setFormData({ sku: '', title: '', subtitle: '', category: 'Bibles', language: 'English', stockLevel: 0 });
    }
    setSkuError(null);
  }, [item, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSkuError(null);
    setFeedback(null);
    try {
      const thresholds = { warning: settings?.warningThreshold || 250, critical: settings?.criticalThreshold || 75 };
      if (item?.id) {
        await updateInventoryItem(item.id, formData, thresholds);
      } else {
        await addInventoryItem(formData, thresholds);
      }
      onClose();
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        setSkuError(error.message);
      } else {
        setFeedback({ type: 'error', message: "Failed to save item. Check permissions." });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!item?.id) return;
    setLoading(true);
    try {
      await deleteInventoryItem(item.id);
      onClose();
    } catch (error) {
      setFeedback({ type: 'error', message: "Failed to delete item." });
      setShowDeleteConfirm(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
                  <Package className="w-5 h-5 text-primary-600" />
                </div>
                <h2 className="font-display font-semibold text-lg text-gray-900">{item ? 'Edit Item' : 'Add New Item'}</h2>
              </div>
              <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Feedback */}
            {feedback && (
              <div onClick={() => setFeedback(null)} className={cn("mx-6 mt-4 p-3 rounded-xl cursor-pointer flex justify-between items-center", feedback.type === 'error' ? 'bg-danger-50 text-danger-700' : 'bg-success-50 text-success-700')}>
                <span className="text-sm font-medium">{feedback.message}</span>
                <span className="text-xs uppercase tracking-wide opacity-60">Dismiss</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">SKU</label>
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
                      "w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm transition-all",
                      "focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white",
                      skuError && "border-danger-500 focus:border-danger-500"
                    )}
                    placeholder="e.g. B-EN-001"
                  />
                  {skuError && <p className="text-xs text-danger-600 mt-1">{skuError}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Category</label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white"
                  >
                    {(settings?.categories || ['Bibles', 'Tracts', 'Booklets']).map((cat: string) => (
                      <option key={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Title</label>
                <input
                  required
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white"
                  placeholder="Item title"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Subtitle (Optional)</label>
                <input
                  type="text"
                  value={formData.subtitle}
                  onChange={e => setFormData({...formData, subtitle: e.target.value})}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white"
                  placeholder="Edition or notes"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Language</label>
                  <select
                    value={formData.language}
                    onChange={e => {
                      const lang = e.target.value;
                      let newSku = formData.sku;
                      if (!item) {
                        const baseSku = formData.sku.replace(/-001$|-002$/, '');
                        newSku = lang === 'English' ? `${baseSku}-001` : lang === 'Spanish' ? `${baseSku}-002` : baseSku;
                      }
                      setFormData({...formData, language: lang, sku: newSku});
                      setSkuError(null);
                    }}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white"
                  >
                    <option>English</option>
                    <option>Spanish</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Stock Level</label>
                  <input
                    required
                    type="number"
                    value={formData.stockLevel}
                    onChange={e => setFormData({...formData, stockLevel: parseInt(e.target.value) || 0})}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono transition-all focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="pt-5 border-t border-gray-100 flex flex-col-reverse sm:flex-row justify-between gap-3">
                {item && isAdmin && (
                  showDeleteConfirm ? (
                    <div className="flex gap-2">
                      <button type="button" onClick={handleDelete} disabled={loading} className="btn btn-danger btn-sm flex items-center gap-2">
                        <Trash2 className="w-4 h-4" /> Confirm Delete
                      </button>
                      <button type="button" onClick={() => setShowDeleteConfirm(false)} className="btn btn-outline btn-sm">Cancel</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setShowDeleteConfirm(true)} disabled={loading} className="btn btn-outline btn-sm text-danger-600 border-danger-200 hover:bg-danger-50">
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  )
                )}
                <div className="flex gap-3 sm:ml-auto">
                  <button type="button" onClick={onClose} className="btn btn-outline btn-sm">Cancel</button>
                  {isAdmin && (
                    <button type="submit" disabled={loading} className="btn btn-primary btn-sm">
                      <Save className="w-4 h-4" /> {loading ? 'Saving...' : (item ? 'Save Changes' : 'Add Item')}
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
