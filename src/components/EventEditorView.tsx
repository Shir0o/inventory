import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Save, 
  Trash2, 
  Calendar as CalendarIcon, 
  Package, 
  Edit2, 
  Check, 
  RotateCcw, 
  Plus, 
  Search,
  MapPin,
  Clock,
  Layers,
  AlertTriangle,
  CheckCircle2,
  X,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  updateEvent, 
  deleteEvent, 
  subscribeToEventMaterials, 
  updateEventMaterialQuantity, 
  removeEventMaterial, 
  distributeItems, 
  updateInventoryItem, 
  createEventWithDistributions, 
  updateEventMaterialCounts 
} from '../services/firestoreService';
import { Timestamp } from 'firebase/firestore';
import { cn } from '../lib/utils';

interface EventEditorViewProps {
  event?: any;
  onBack: () => void;
  settings?: any;
  isAdmin?: boolean;
  inventory?: any[];
}

export const EventEditorView: React.FC<EventEditorViewProps> = ({
  event,
  onBack,
  settings,
  isAdmin = false,
  inventory = []
}) => {
  const isEditing = Boolean(event?.id);
  const [activeTab, setActiveTab] = useState<'details' | 'materials'>('details');
  const [beforeCountMaterials, setBeforeCountMaterials] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [optimisticMaterials, setOptimisticMaterials] = useState<any[]>([]);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState<number>(0);
  const [editPreCount, setEditPreCount] = useState<number>(0);
  const [editPostCount, setEditPostCount] = useState<number>(0);
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    date: '',
    location: '',
    materialsDistributed: 0,
    status: 'Scheduled'
  });
  const [loading, setLoading] = useState(false);
  const [selectedAdjustItem, setSelectedAdjustItem] = useState<any | null>(null);
  const [adjustStockValue, setAdjustStockValue] = useState<number>(10);
  
  const [showEventDeleteConfirm, setShowEventDeleteConfirm] = useState(false);
  const [removingMaterialId, setRemovingMaterialId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success', message: string } | null>(null);

  useEffect(() => {
    setSelectedAdjustItem(null);
    setAdjustStockValue(10);
    setShowEventDeleteConfirm(false);
    setRemovingMaterialId(null);
    setFeedback(null);

    if (event) {
      let dateStr = '';
      if (event.date) {
        const d = event.date.toDate ? event.date.toDate() : new Date(event.date);
        dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
      setFormData({
        name: event.name || '',
        date: dateStr,
        location: event.location || '',
        materialsDistributed: event.materialsDistributed || 0,
        status: event.status || 'Scheduled'
      });

      // Subscribe to materials
      const unsub = subscribeToEventMaterials(event.id, (data) => {
        setMaterials(data);
        setOptimisticMaterials(data);
      });
      return () => unsub();
    } else {
      setFormData({
        name: '',
        date: new Date().toLocaleDateString('en-CA'), // Formats as YYYY-MM-DD
        location: '',
        materialsDistributed: 0,
        status: 'Scheduled'
      });
      setMaterials([]);
      setOptimisticMaterials([]);
      setBeforeCountMaterials([]);
      setActiveTab('details');
      setEditingMaterialId(null);
      setIsAddingMaterial(false);
      setSearchQuery('');
    }
  }, [event]);

  const handleAdjustAndAdd = async (item: any) => {
    setLoading(true);
    try {
      const thresholds = {
        warning: settings?.warningThreshold || 250,
        critical: settings?.criticalThreshold || 75
      };

      // 1. Update system stock to the new actual shelf stock level first
      await updateInventoryItem(item.id, {
        ...item,
        stockLevel: adjustStockValue
      }, thresholds);

      // 2. Prepare the updated item reference
      const updatedItem = {
        ...item,
        stockLevel: adjustStockValue
      };

      setSelectedAdjustItem(null);
      setAdjustStockValue(10);

      // 3. Immediately add it to the event materials
      await handleAddMaterial(updatedItem);
    } catch (error) {
      console.error("Failed to adjust and add stock", error);
      setFeedback({ type: 'error', message: "Failed to adjust inventory stock. Please check your permissions." });
    } finally {
      setLoading(false);
    }
  };

  const handleAddMaterial = async (item: any) => {
    if (!event?.id) {
      if (beforeCountMaterials.find(m => m.itemId === item.id)) {
        setFeedback({ type: 'error', message: "This item is already in your Before Count list." });
        return;
      }
      const isOutOfStock = (item.stockLevel || 0) <= 0;
      const qtyToAdd = isOutOfStock ? 1 : Math.min(10, item.stockLevel || 0);
      setBeforeCountMaterials(prev => [...prev, {
        itemId: item.id,
        sku: item.sku,
        title: item.title,
        language: item.language || '',
        quantity: qtyToAdd,
        systemStock: item.stockLevel || 0,
        newStockLevel: isOutOfStock ? 10 : (item.stockLevel || 0),
        correctStock: isOutOfStock
      }]);
      setIsAddingMaterial(false);
      setSearchQuery('');
      return;
    }
    
    // Default to adding 10 units or remaining stock if less
    const qtyToAdd = Math.min(10, item.stockLevel || 0);
    
    if (qtyToAdd <= 0) {
      setFeedback({ type: 'error', message: "This item is out of stock. Please adjust shelf stock first using the inline tool." });
      return;
    }

    // Optimistic Update
    const tempId = `temp-${Date.now()}`;
    const newItem = {
      id: tempId,
      itemId: item.id,
      sku: item.sku,
      title: item.title,
      language: item.language,
      quantity: qtyToAdd,
      isOptimistic: true
    };
    
    setOptimisticMaterials(prev => [...prev, newItem]);
    setIsAddingMaterial(false);
    setSearchQuery('');

    try {
      const thresholds = {
        warning: settings?.warningThreshold || 250,
        critical: settings?.criticalThreshold || 75
      };
      
      await distributeItems(event.id, [{
        itemId: item.id,
        quantity: qtyToAdd,
        title: item.title,
        sku: item.sku,
        language: item.language
      }], thresholds);
    } catch (error) {
      console.error("Failed to add material", error);
      // Rollback
      setOptimisticMaterials(prev => prev.filter(m => m.id !== tempId));
      setFeedback({ type: 'error', message: "Failed to add resource. Please check stock availability." });
    }
  };

  const handleUpdateMaterialCounts = async (materialId: string, newPreCount: number, newPostCount: number) => {
    if (!event?.id) return;
    if (newPreCount < newPostCount) {
      setFeedback({ type: 'error', message: "Pre-Count (Checked Out) cannot be less than Post-Count (Returned)." });
      return;
    }
    
    const originalMaterial = optimisticMaterials.find(m => m.id === materialId);
    if (!originalMaterial) return;

    const newDist = Math.max(0, newPreCount - newPostCount);

    // Optimistic Update
    setOptimisticMaterials(prev => prev.map(m => 
      m.id === materialId ? { ...m, preCount: newPreCount, postCount: newPostCount, quantity: newDist, isOptimistic: true } : m
    ));
    setEditingMaterialId(null);

    try {
      const thresholds = {
        warning: settings?.warningThreshold || 250,
        critical: settings?.criticalThreshold || 75
      };
      await updateEventMaterialCounts(event.id, materialId, newPreCount, newPostCount, thresholds);
      setFeedback({ type: 'success', message: "Resource counts updated successfully." });
    } catch (error: any) {
      console.error("Failed to update material counts", error);
      // Rollback
      setOptimisticMaterials(prev => prev.map(m => 
        m.id === materialId ? originalMaterial : m
      ));
      setFeedback({ type: 'error', message: error?.message || "Failed to update counts. Check inventory stock." });
    }
  };

  const handleRemoveMaterial = async (materialId: string) => {
    if (!event?.id) return;
    
    const originalMaterial = optimisticMaterials.find(m => m.id === materialId);
    if (!originalMaterial) return;

    // Optimistic Update
    setOptimisticMaterials(prev => prev.filter(m => m.id !== materialId));
    setFeedback(null);

    try {
      const thresholds = {
        warning: settings?.warningThreshold || 250,
        critical: settings?.criticalThreshold || 75
      };
      await removeEventMaterial(event.id, materialId, thresholds);
      setFeedback({ type: 'success', message: "Item removed from event and restored to inventory." });
    } catch (error: any) {
      console.error("Failed to remove material", error);
      // Rollback
      setOptimisticMaterials(prev => [...prev, originalMaterial]);
      let errMsg = "Failed to remove item. Insufficient permissions or connection error.";
      try {
        if (error?.message) {
          const parsed = JSON.parse(error.message);
          if (parsed.error) errMsg = parsed.error;
        }
      } catch (_) {}
      setFeedback({ type: 'error', message: errMsg });
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!formData.name.trim()) {
      setFeedback({ type: 'error', message: "Please enter an Event Name / Designation." });
      setActiveTab('details');
      return;
    }
    if (!formData.date) {
      setFeedback({ type: 'error', message: "Please select an Event Date." });
      setActiveTab('details');
      return;
    }
    if (!formData.location.trim()) {
      setFeedback({ type: 'error', message: "Please specify a Location or Venue." });
      setActiveTab('details');
      return;
    }

    setLoading(true);
    setFeedback(null);
    try {
      const [year, month, day] = formData.date.split('-').map(Number);
      const localDate = new Date(year, month - 1, day, 12, 0, 0);
      
      const thresholds = {
        warning: settings?.warningThreshold || 250,
        critical: settings?.criticalThreshold || 75
      };

      if (event?.id) {
        const submissionData = {
          ...formData,
          date: Timestamp.fromDate(localDate)
        };
        await updateEvent(event.id, submissionData);
      } else {
        // 1. Perform stock balance corrections first (if requested)
        for (const item of beforeCountMaterials) {
          if (item.correctStock && item.newStockLevel !== undefined) {
            const originalItem = inventory.find(i => i.id === item.itemId);
            if (originalItem) {
              await updateInventoryItem(item.itemId, {
                ...originalItem,
                stockLevel: item.newStockLevel
              }, thresholds);
            }
          }
        }

        // 2. Add the Event and distribute items inside atomic transaction
        const totalAllocated = beforeCountMaterials.reduce((sum, item) => sum + item.quantity, 0);
        const submissionData = {
          ...formData,
          materialsDistributed: totalAllocated,
          date: Timestamp.fromDate(localDate)
        };
        
        const itemsToDistribute = beforeCountMaterials.map(m => ({
          itemId: m.itemId,
          quantity: m.quantity,
          preCount: m.quantity,
          postCount: 0,
          title: m.title,
          sku: m.sku,
          language: m.language || ''
        }));
        
        await createEventWithDistributions(submissionData, itemsToDistribute, thresholds);
      }
      onBack();
    } catch (error: any) {
      console.error("Failed to save event", error);
      let errMsg = "Failed to save event. Check your role/permissions or logs.";
      try {
        if (error?.message) {
          const parsed = JSON.parse(error.message);
          if (parsed.error) errMsg = parsed.error;
        }
      } catch (_) {}
      setFeedback({ type: 'error', message: errMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!event?.id) return;
    setLoading(true);
    setFeedback(null);
    try {
      await deleteEvent(event.id);
      onBack();
    } catch (error: any) {
      console.error("Failed to delete event", error);
      let errMsg = "Failed to delete event. Check your role/permissions.";
      try {
        if (error?.message) {
          const parsed = JSON.parse(error.message);
          if (parsed.error) errMsg = parsed.error;
        }
      } catch (_) {}
      setFeedback({ type: 'error', message: errMsg });
      setShowEventDeleteConfirm(false);
    } finally {
      setLoading(false);
    }
  };

  const currentTotalDistributed = isEditing 
    ? optimisticMaterials.reduce((sum, m) => sum + (m.quantity || 0), 0)
    : beforeCountMaterials.reduce((sum, m) => sum + m.quantity, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Breadcrumb & Page Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs font-headline font-bold uppercase tracking-wider text-on-surface-variant hover:text-primary transition-colors py-1 px-2.5 -ml-2 rounded-full hover:bg-surface-container"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Events</span>
          </button>

          {isEditing && (
            <div className="flex items-center gap-2">
              <span className={cn(
                "px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-wider rounded-full border",
                formData.status === 'Scheduled' ? "bg-secondary/15 text-secondary border-secondary/30" :
                formData.status === 'Stock Alert' ? "bg-tertiary/15 text-tertiary border-tertiary/30" :
                "bg-surface-container text-on-surface-variant border-outline-variant"
              )}>
                {formData.status}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-outline-variant/30">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-headline font-bold text-[11px] uppercase tracking-[2px] text-on-surface-variant">
                {isEditing ? 'Event Record Management' : 'Planning & Distribution'}
              </span>
            </div>
            <h1 className="font-headline font-extrabold text-2xl sm:text-3xl text-primary tracking-tight mt-1">
              {isEditing ? (formData.name || 'Edit Event') : 'Schedule New Distribution Event'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2.5 border border-outline-variant/50 text-on-surface-variant font-headline font-bold text-xs uppercase tracking-wider rounded-full hover:bg-surface-container transition-colors"
            >
              Cancel
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={loading}
                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-white font-headline font-bold text-xs uppercase tracking-wider rounded-full hover:bg-primary/90 transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{loading ? 'Saving...' : (isEditing ? 'Save Changes' : 'Schedule Event')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Global Feedback Banner */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            onClick={() => setFeedback(null)}
            className={cn(
              "p-4 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer shadow-xs",
              feedback.type === 'error'
                ? "bg-tertiary/10 border-tertiary/20 text-tertiary font-medium text-xs"
                : "bg-secondary/15 border-secondary/30 text-secondary font-medium text-xs"
            )}
          >
            <div className="flex items-center gap-2.5">
              {feedback.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 shrink-0 text-tertiary" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-secondary" />
              )}
              <span>{feedback.message}</span>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider opacity-60 font-bold">Dismiss</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Grid: Left Column (Logistics & Status), Right Column (Materials & Reconciliation) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Event Details Form */}
        <div className="lg:col-span-5 space-y-6">
          <div className="ledger-card p-6 sm:p-7 rounded-[24px]">
            <h2 className="font-headline font-bold text-sm text-primary uppercase tracking-wider mb-6 flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-primary" />
              Event Logistics
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="font-headline font-bold text-[10px] text-on-surface-variant uppercase tracking-widest block">
                  Event Name / Designation <span className="text-tertiary">*</span>
                </label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-surface-container-low border border-outline-variant/40 rounded-xl px-4 py-3 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all text-on-surface"
                  placeholder="e.g. Regional Youth Conference"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="font-headline font-bold text-[10px] text-on-surface-variant uppercase tracking-widest block">
                    Event Date <span className="text-tertiary">*</span>
                  </label>
                  <input
                    required
                    type="date"
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-surface-container-low border border-outline-variant/40 rounded-xl px-4 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all text-on-surface"
                  />
                </div>

                <div className="space-y-2">
                  <label className="font-headline font-bold text-[10px] text-on-surface-variant uppercase tracking-widest block">
                    Total Handed Out
                  </label>
                  <div className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-2.5 text-xs font-mono font-bold text-primary flex items-center justify-between">
                    <span>{currentTotalDistributed}</span>
                    <span className="text-[10px] text-on-surface-variant uppercase font-sans">units</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="font-headline font-bold text-[10px] text-on-surface-variant uppercase tracking-widest block">
                  Location / Venue <span className="text-tertiary">*</span>
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                  <input
                    required
                    type="text"
                    value={formData.location}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                    className="w-full bg-surface-container-low border border-outline-variant/40 rounded-xl pl-10 pr-4 py-3 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all text-on-surface"
                    placeholder="e.g. Central Park Pavilion"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <label className="font-headline font-bold text-[10px] text-on-surface-variant uppercase tracking-widest block">
                  Operational Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['Scheduled', 'Stock Alert', 'Completed'].map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setFormData({ ...formData, status: s })}
                      className={cn(
                        "py-2.5 px-2 text-[10px] font-bold uppercase tracking-wider rounded-xl border transition-all text-center",
                        formData.status === s
                          ? "bg-secondary text-white border-secondary shadow-xs"
                          : "border-outline-variant/40 bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {event?.categoryStats && (
                <div className="p-4 bg-surface-container-low border border-outline-variant/30 rounded-2xl space-y-3 mt-4">
                  <h4 className="font-headline font-bold text-[10px] text-primary uppercase tracking-widest border-b border-outline-variant/30 pb-2">
                    Coverage Breakdown
                  </h4>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="font-headline font-bold text-base text-primary">{event.categoryStats.bibles || 0}</p>
                      <p className="text-[9px] font-mono text-on-surface-variant uppercase">Bibles</p>
                      {(event.categoryStats.bibles_en > 0 || event.categoryStats.bibles_es > 0) && (
                        <div className="flex justify-center gap-1 mt-0.5 text-[8px] font-bold text-slate-400 uppercase">
                          <span>EN:{event.categoryStats.bibles_en || 0}</span>
                          <span>•</span>
                          <span>ES:{event.categoryStats.bibles_es || 0}</span>
                        </div>
                      )}
                    </div>
                    <div className="border-l border-r border-outline-variant/30">
                      <p className="font-headline font-bold text-base text-primary">{event.categoryStats.tracts || 0}</p>
                      <p className="text-[9px] font-mono text-on-surface-variant uppercase">Tracts</p>
                      {(event.categoryStats.tracts_en > 0 || event.categoryStats.tracts_es > 0) && (
                        <div className="flex justify-center gap-1 mt-0.5 text-[8px] font-bold text-slate-400 uppercase">
                          <span>EN:{event.categoryStats.tracts_en || 0}</span>
                          <span>•</span>
                          <span>ES:{event.categoryStats.tracts_es || 0}</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-headline font-bold text-base text-primary">{event.categoryStats.booklets || 0}</p>
                      <p className="text-[9px] font-mono text-on-surface-variant uppercase">Booklets</p>
                      {(event.categoryStats.booklets_en > 0 || event.categoryStats.booklets_es > 0) && (
                        <div className="flex justify-center gap-1 mt-0.5 text-[8px] font-bold text-slate-400 uppercase">
                          <span>EN:{event.categoryStats.booklets_en || 0}</span>
                          <span>•</span>
                          <span>ES:{event.categoryStats.booklets_es || 0}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* Delete Danger Zone */}
          {isEditing && isAdmin && (
            <div className="p-6 bg-tertiary/5 border border-tertiary/20 rounded-[24px] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-headline font-bold text-xs uppercase tracking-wider text-tertiary">Delete Event</h3>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">Permanently remove this event record and reconcile materials.</p>
                </div>
              </div>

              {showEventDeleteConfirm ? (
                <div className="flex gap-2 pt-2 animate-in fade-in">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={loading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-tertiary text-white font-headline font-bold text-xs uppercase tracking-wider hover:bg-tertiary/90 transition-all rounded-full shadow-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    Confirm Permanent Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEventDeleteConfirm(false)}
                    className="px-4 py-2.5 border border-outline-variant text-on-surface-variant font-headline font-bold text-xs uppercase tracking-wider hover:bg-surface-container transition-colors rounded-full"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowEventDeleteConfirm(true)}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 px-4 py-2 border-2 border-tertiary/40 text-tertiary font-headline font-bold text-xs uppercase tracking-wider hover:bg-tertiary/10 transition-colors rounded-full"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete This Event
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Materials, Pre-Counting & Reconciliation */}
        <div className="lg:col-span-7 space-y-6">
          <div className="ledger-card p-6 sm:p-7 rounded-[24px] space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-outline-variant/30">
              <div>
                <h2 className="font-headline font-bold text-sm text-primary uppercase tracking-wider flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" />
                  {isEditing ? `Assigned Materials (${optimisticMaterials.length})` : `Before Count Items (${beforeCountMaterials.length})`}
                </h2>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {isEditing 
                    ? "Manage checked out versus returned quantities with real-time inventory reconciliation." 
                    : "Plan and allocate materials from warehouse stock prior to event departure."}
                </p>
              </div>

              {isAdmin && !isAddingMaterial && (
                <button
                  onClick={() => setIsAddingMaterial(true)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary font-headline font-bold text-xs uppercase tracking-wider rounded-full transition-all shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Resource</span>
                </button>
              )}
            </div>

            {/* Inline Add Material Drawer / Box */}
            {isAddingMaterial && (
              <div className="p-4 sm:p-5 bg-surface-container rounded-2xl border border-primary/20 space-y-4 animate-in fade-in">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-headline font-bold text-primary uppercase tracking-widest">
                    Select Catalog Resource to Add
                  </h4>
                  <button 
                    onClick={() => {
                      setIsAddingMaterial(false);
                      setSelectedAdjustItem(null);
                    }} 
                    className="p-1 text-on-surface-variant hover:text-primary rounded-full"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                  <input
                    autoFocus
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by title, SKU, or language..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-outline-variant/40 rounded-xl text-xs text-on-surface focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                  />
                </div>

                <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                  {inventory
                    .filter(i => 
                      (i.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                       i.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       i.language?.toLowerCase().includes(searchQuery.toLowerCase())) &&
                      (isEditing 
                        ? !optimisticMaterials.find(m => m.sku === i.sku) 
                        : !beforeCountMaterials.find(m => m.itemId === i.id))
                    )
                    .map(i => {
                      const isOutOfStock = (i.stockLevel || 0) <= 0;
                      const isAdjusting = selectedAdjustItem?.id === i.id;
                      return (
                        <div
                          key={i.id}
                          className="w-full p-3 bg-white hover:bg-surface-container-high rounded-xl border border-outline-variant/30 flex flex-col gap-2 transition-colors"
                        >
                          <div className="flex justify-between items-center gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                if (isOutOfStock) {
                                  setSelectedAdjustItem(isAdjusting ? null : i);
                                  setAdjustStockValue(10);
                                } else {
                                  handleAddMaterial(i);
                                }
                              }}
                              className="flex-1 text-left"
                            >
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-xs font-bold text-primary">{i.title}</p>
                                <span className="font-mono text-[9px] text-slate-500 bg-slate-100 px-1 py-0.5 rounded tracking-tight border border-outline-variant/60">
                                  {i.sku}
                                </span>
                                {i.language && (
                                  <span className="text-[9px] px-1.5 py-0.5 bg-surface-container text-on-surface-variant font-bold rounded-md uppercase">
                                    {i.language}
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] font-mono text-on-surface-variant mt-0.5">
                                {isOutOfStock ? (
                                  <span className="text-tertiary font-bold bg-tertiary/10 px-1.5 py-0.5 rounded">OUT OF STOCK</span>
                                ) : (
                                  <span>{i.stockLevel} in stock</span>
                                )}
                              </p>
                            </button>

                            <div className="flex items-center gap-2">
                              {isOutOfStock ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedAdjustItem(isAdjusting ? null : i);
                                    setAdjustStockValue(10);
                                  }}
                                  className="px-3 py-1.5 bg-tertiary/10 hover:bg-tertiary hover:text-white text-tertiary font-headline font-bold text-[10px] uppercase tracking-wider rounded-full transition-all"
                                >
                                  {isAdjusting ? "Cancel" : "Adjust Stock"}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleAddMaterial(i)}
                                  className="p-2 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-full transition-all"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          {isAdjusting && (
                            <div className="p-3 bg-surface-container-low rounded-xl border border-tertiary/30 flex flex-wrap items-center justify-between gap-3 mt-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-headline font-bold text-on-surface-variant uppercase tracking-widest">
                                  Shelf Stock:
                                </span>
                                <input
                                  type="number"
                                  min={1}
                                  value={adjustStockValue}
                                  onChange={e => setAdjustStockValue(Math.max(1, parseInt(e.target.value) || 0))}
                                  className="w-16 bg-white border border-outline-variant px-2 py-1 font-mono text-xs text-center rounded-lg focus:ring-1 focus:ring-tertiary"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAdjustAndAdd(i)}
                                disabled={loading}
                                className="px-4 py-1.5 bg-tertiary hover:bg-tertiary/90 text-white font-headline font-bold text-[10px] uppercase tracking-widest rounded-full transition-all shadow-xs"
                              >
                                {loading ? "Updating..." : "Verify & Add"}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* List of Materials: CASE 1 (Creation / Before-Count) */}
            {!isEditing && (
              <div className="space-y-4">
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-headline font-bold text-primary uppercase tracking-wider">
                      Pre-Counting & Reservation Phase
                    </p>
                    <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
                      Select materials and specify the checked-out quantities (Pre-Count) for transport. Inventory levels will be reserved upon scheduling.
                    </p>
                  </div>
                </div>

                {beforeCountMaterials.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center space-y-3 bg-surface-container-low rounded-2xl border border-dashed border-outline-variant/50">
                    <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
                      <Package className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-headline font-bold text-xs uppercase tracking-wider text-primary">Before Count Is Empty</p>
                      <p className="text-xs text-on-surface-variant mt-1 max-w-sm">
                        Click "Add Resource" above to include bibles, tracts, or booklets in this event allocation.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {beforeCountMaterials.map(m => (
                      <div key={m.itemId} className="p-4 bg-surface rounded-2xl border border-outline-variant/40 hover:border-primary/40 flex flex-col gap-3 transition-all">
                        <div className="flex justify-between items-center gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0">
                              <Package className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="font-headline font-bold text-sm text-primary">{m.title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="font-mono text-[9.5px] text-slate-500 bg-slate-100 px-1 py-0.5 rounded tracking-tight border border-outline-variant/60">{m.sku}</span>
                                {m.language && (
                                  <>
                                    <span className="text-slate-300">•</span>
                                    <span className="text-[9px] font-bold text-on-surface-variant uppercase bg-surface-container px-1.5 py-0.2 rounded">
                                      {m.language}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setBeforeCountMaterials(prev => prev.filter(item => item.itemId !== m.itemId))}
                            className="p-2 text-on-surface-variant hover:text-tertiary hover:bg-surface-container rounded-full transition-colors"
                            title="Remove from event"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="pt-3 border-t border-dashed border-outline-variant/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`correct-${m.itemId}`}
                              checked={m.correctStock}
                              onChange={e => {
                                setBeforeCountMaterials(prev => prev.map(item =>
                                  item.itemId === m.itemId ? { ...item, correctStock: e.target.checked } : item
                                ));
                              }}
                              className="rounded border-outline-variant text-primary focus:ring-primary w-4 h-4"
                            />
                            <label htmlFor={`correct-${m.itemId}`} className="text-[10px] font-headline font-bold text-on-surface-variant uppercase tracking-widest cursor-pointer">
                              Correct Shelf Stock First
                            </label>
                            {m.correctStock && (
                              <input
                                type="number"
                                min={0}
                                value={m.newStockLevel}
                                onChange={e => {
                                  const val = Math.max(0, parseInt(e.target.value) || 0);
                                  setBeforeCountMaterials(prev => prev.map(item => {
                                    if (item.itemId === m.itemId) {
                                      const qty = Math.min(item.quantity, val);
                                      return { ...item, newStockLevel: val, quantity: qty };
                                    }
                                    return item;
                                  }));
                                }}
                                className="w-16 bg-surface-container-low border border-outline-variant px-2 py-1 font-mono text-xs text-center rounded-lg ml-2"
                              />
                            )}
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-auto bg-surface-container-low p-2 rounded-xl border border-outline-variant/30">
                            <span className="text-[10px] font-headline font-bold text-on-surface-variant uppercase tracking-widest mr-1">
                              Pre-Count:
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setBeforeCountMaterials(prev => prev.map(item => {
                                  if (item.itemId === m.itemId) {
                                    return { ...item, quantity: Math.max(1, item.quantity - 1) };
                                  }
                                  return item;
                                }));
                              }}
                              className="px-2 py-1 text-xs font-bold font-mono bg-white border border-outline-variant rounded-md hover:bg-surface-container"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={m.correctStock ? m.newStockLevel : m.systemStock}
                              value={m.quantity}
                              onChange={e => {
                                const val = Math.max(1, parseInt(e.target.value) || 0);
                                const limit = m.correctStock ? m.newStockLevel : m.systemStock;
                                setBeforeCountMaterials(prev => prev.map(item =>
                                  item.itemId === m.itemId ? { ...item, quantity: Math.min(val, limit) } : item
                                ));
                              }}
                              className="w-14 bg-white border border-outline-variant text-xs text-center font-mono py-1 rounded-md"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setBeforeCountMaterials(prev => prev.map(item => {
                                  if (item.itemId === m.itemId) {
                                    const limit = item.correctStock ? item.newStockLevel : item.systemStock;
                                    return { ...item, quantity: Math.min(limit, item.quantity + 1) };
                                  }
                                  return item;
                                }));
                              }}
                              className="px-2 py-1 text-xs font-bold font-mono bg-white border border-outline-variant rounded-md hover:bg-surface-container"
                            >
                              +
                            </button>
                            <span className="text-[10px] font-mono text-on-surface-variant ml-1 font-bold">
                              / {m.correctStock ? m.newStockLevel : m.systemStock}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* List of Materials: CASE 2 (Editing / Active Reconciliation) */}
            {isEditing && (
              <div className="space-y-4">
                <div className="p-4 bg-secondary/15 border border-secondary/30 rounded-2xl flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-secondary/30 flex items-center justify-center text-secondary shrink-0">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-headline font-bold text-primary uppercase tracking-wider">
                      Post-Event Reconciliation Mode
                    </p>
                    <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
                      Log returned quantities (Post-Count). The ledger computes total distributed units and automatically returns leftover materials to warehouse stock.
                    </p>
                  </div>
                </div>

                {optimisticMaterials.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center space-y-3 bg-surface-container-low rounded-2xl border border-dashed border-outline-variant/50">
                    <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
                      <Package className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-headline font-bold text-xs uppercase tracking-wider text-primary">No Resources Assigned Yet</p>
                      <p className="text-xs text-on-surface-variant mt-1 max-w-sm">
                        Add items using the "Add Resource" button to assign materials to this event ledger.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {optimisticMaterials.map(m => {
                      const itemPreCount = m.preCount !== undefined ? m.preCount : m.quantity;
                      const itemPostCount = m.postCount !== undefined ? m.postCount : 0;
                      const itemDistributed = Math.max(0, itemPreCount - itemPostCount);
                      const isEditingThis = editingMaterialId === m.id;

                      const liveNewDist = Math.max(0, editPreCount - editPostCount);
                      const liveInventoryDiff = liveNewDist - (m.quantity || 0);

                      return (
                        <div
                          key={m.id}
                          className={cn(
                            "p-4 bg-surface rounded-2xl border flex flex-col gap-3 transition-all",
                            m.isOptimistic ? "opacity-60 border-dashed border-primary" : "border-outline-variant/40 hover:border-primary/40"
                          )}
                        >
                          <div className="flex justify-between items-start gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0">
                                <Package className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="font-headline font-bold text-sm text-primary">
                                  {m.title}
                                  {m.isOptimistic && <span className="ml-2 text-[10px] text-primary italic font-normal">(Syncing...)</span>}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="font-mono text-[9.5px] text-slate-500 bg-slate-100 px-1 py-0.5 rounded tracking-tight border border-outline-variant/60">{m.sku}</span>
                                  {m.language && (
                                    <>
                                      <span className="text-slate-300">•</span>
                                      <span className="text-[9px] font-bold text-on-surface-variant uppercase bg-surface-container px-1.5 py-0.2 rounded">
                                        {m.language}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {isAdmin && !isEditingThis && (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingMaterialId(m.id);
                                    setEditPreCount(itemPreCount);
                                    setEditPostCount(itemPostCount);
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-container hover:bg-primary hover:text-white text-primary text-[11px] font-headline font-bold uppercase tracking-wider rounded-full transition-all"
                                >
                                  <Edit2 className="w-3 h-3" />
                                  <span>Reconcile</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRemovingMaterialId(m.id)}
                                  className="p-1.5 text-on-surface-variant hover:text-tertiary hover:bg-surface-container rounded-full transition-colors"
                                  title="Remove from event"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Reconciliation Numbers Display */}
                          <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/30">
                            {isEditingThis ? (
                              <div className="space-y-4 animate-in fade-in">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div>
                                    <label className="text-[10px] font-headline font-bold text-on-surface-variant uppercase tracking-widest block mb-1.5">
                                      Pre-Count (Checked Out):
                                    </label>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setEditPreCount(prev => Math.max(0, prev - 1))}
                                        className="w-8 h-8 flex items-center justify-center font-mono font-bold bg-white border border-outline-variant rounded-lg hover:bg-surface-container"
                                      >
                                        -
                                      </button>
                                      <input
                                        type="number"
                                        value={editPreCount}
                                        onChange={e => setEditPreCount(Math.max(0, parseInt(e.target.value) || 0))}
                                        className="w-16 bg-white border border-outline-variant py-1.5 text-xs text-center font-mono rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setEditPreCount(prev => prev + 1)}
                                        className="w-8 h-8 flex items-center justify-center font-mono font-bold bg-white border border-outline-variant rounded-lg hover:bg-surface-container"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>

                                  <div>
                                    <label className="text-[10px] font-headline font-bold text-on-surface-variant uppercase tracking-widest block mb-1.5">
                                      Post-Count (Returned Leftover):
                                    </label>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setEditPostCount(prev => Math.max(0, prev - 1))}
                                        className="w-8 h-8 flex items-center justify-center font-mono font-bold bg-white border border-outline-variant rounded-lg hover:bg-surface-container"
                                      >
                                        -
                                      </button>
                                      <input
                                        type="number"
                                        value={editPostCount}
                                        onChange={e => setEditPostCount(Math.max(0, parseInt(e.target.value) || 0))}
                                        className="w-16 bg-white border border-outline-variant py-1.5 text-xs text-center font-mono rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setEditPostCount(prev => prev + 1)}
                                        className="w-8 h-8 flex items-center justify-center font-mono font-bold bg-white border border-outline-variant rounded-lg hover:bg-surface-container"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                <div className="pt-3 border-t border-dashed border-outline-variant/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                  <div className="text-xs">
                                    <p className="font-sans font-bold text-primary">
                                      Calculated Handout: <span className="font-mono text-sm">{liveNewDist}</span> units
                                    </p>
                                    <p className="text-[10px] text-on-surface-variant mt-0.5">
                                      {liveInventoryDiff > 0 ? (
                                        <span className="text-amber-600 font-bold">⚠️ Will reserve {liveInventoryDiff} additional units from warehouse.</span>
                                      ) : liveInventoryDiff < 0 ? (
                                        <span className="text-green-600 font-bold">🍀 Will return {Math.abs(liveInventoryDiff)} unclaimed units back to warehouse.</span>
                                      ) : (
                                        <span>No additional warehouse stock impact.</span>
                                      )}
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-2 self-end sm:self-auto">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateMaterialCounts(m.id, editPreCount, editPostCount)}
                                      disabled={loading}
                                      className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary text-white text-xs font-headline font-bold uppercase tracking-wider rounded-full hover:bg-primary/90 transition-all shadow-xs"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Save Count</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingMaterialId(null)}
                                      className="px-3 py-1.5 border border-outline-variant text-on-surface-variant text-xs font-headline font-bold uppercase tracking-wider rounded-full hover:bg-surface-container"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="grid grid-cols-3 gap-4 sm:gap-8 text-center divide-x divide-outline-variant/40">
                                  <div>
                                    <p className="font-mono text-base font-bold text-on-surface">{itemPreCount}</p>
                                    <p className="text-[9px] font-headline font-bold text-on-surface-variant uppercase tracking-wider mt-0.5">Checked Out</p>
                                  </div>
                                  <div className="pl-4">
                                    <p className="font-mono text-base font-bold text-on-surface">{itemPostCount}</p>
                                    <p className="text-[9px] font-headline font-bold text-on-surface-variant uppercase tracking-wider mt-0.5">Returned</p>
                                  </div>
                                  <div className="pl-4">
                                    <p className="font-mono text-base font-bold text-primary">{itemDistributed}</p>
                                    <p className="text-[9px] font-headline font-bold text-primary uppercase tracking-wider mt-0.5">Distributed</p>
                                  </div>
                                </div>

                                <div className="self-end sm:self-auto">
                                  {itemDistributed > 0 ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-full">
                                      ✓ {itemDistributed} Distributed
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2.5 py-1 text-[10px] font-medium uppercase bg-surface-container text-on-surface-variant rounded-full">
                                      0 Handed Out
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Removal confirmation banner */}
                          {removingMaterialId === m.id && (
                            <div className="p-3 bg-tertiary/10 border border-tertiary/20 rounded-xl flex items-center justify-between gap-3 animate-in fade-in">
                              <span className="text-xs text-tertiary font-medium">Remove item and restore unconsumed units to warehouse?</span>
                              <div className="flex gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRemovingMaterialId(null);
                                    handleRemoveMaterial(m.id);
                                  }}
                                  className="px-3 py-1 bg-tertiary text-white font-headline font-bold text-[10px] uppercase tracking-wider rounded-full shadow-xs"
                                >
                                  Remove
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRemovingMaterialId(null)}
                                  className="px-3 py-1 border border-outline-variant bg-white text-on-surface-variant font-headline font-bold text-[10px] uppercase tracking-wider rounded-full"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventEditorView;
