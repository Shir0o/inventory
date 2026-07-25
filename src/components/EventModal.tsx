import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, Calendar as CalendarIcon, Package, Edit2, Check, RotateCcw, Plus, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { addEvent, updateEvent, deleteEvent, subscribeToEventMaterials, updateEventMaterialQuantity, removeEventMaterial, distributeItems, updateInventoryItem, createEventWithDistributions, updateEventMaterialCounts } from '../services/firestoreService';
import { Timestamp } from 'firebase/firestore';
import { cn } from '../lib/utils';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event?: any;
  settings?: any;
  isAdmin?: boolean;
  inventory?: any[];
}

const EventModal = ({ isOpen, onClose, event, settings, isAdmin = false, inventory = [] }: EventModalProps) => {
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
  const [modalFeedback, setModalFeedback] = useState<{ type: 'error' | 'success', message: string } | null>(null);

  useEffect(() => {
    setSelectedAdjustItem(null);
    setAdjustStockValue(10);
    setShowEventDeleteConfirm(false);
    setRemovingMaterialId(null);
    setModalFeedback(null);
    if (event) {
      let dateStr = '';
      if (event.date) {
        const d = event.date.toDate ? event.date.toDate() : new Date(event.date);
        // Use local parts to avoid UTC shift issues in date input
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
  }, [event, isOpen]);

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
      alert("Failed to adjust inventory stock. Please check your role/permissions.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddMaterial = async (item: any) => {
    if (!event?.id) {
      if (beforeCountMaterials.find(m => m.itemId === item.id)) {
        alert("This item is already added.");
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
      alert("This item is out of stock. Please adjust shelf stock first using the inline tool.");
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
      alert("Failed to add resource. Please check stock availability.");
    }
  };

  const handleUpdateMaterial = async (materialId: string) => {
    if (!event?.id) return;
    
    const originalMaterial = optimisticMaterials.find(m => m.id === materialId);
    if (!originalMaterial) return;

    // Optimistic Update
    setOptimisticMaterials(prev => prev.map(m => 
      m.id === materialId ? { ...m, quantity: editQuantity, isOptimistic: true } : m
    ));
    setEditingMaterialId(null);

    try {
      const thresholds = {
        warning: settings?.warningThreshold || 250,
        critical: settings?.criticalThreshold || 75
      };
      await updateEventMaterialQuantity(event.id, materialId, editQuantity, thresholds);
    } catch (error) {
      console.error("Failed to update material quantity", error);
      // Rollback
      setOptimisticMaterials(prev => prev.map(m => 
        m.id === materialId ? originalMaterial : m
      ));
      alert("Failed to update quantity. Insufficient stock or connection error.");
    }
  };

  const handleUpdateMaterialCounts = async (materialId: string, newPreCount: number, newPostCount: number) => {
    if (!event?.id) return;
    if (newPreCount < newPostCount) {
      alert("Pre-Count (Checked Out) cannot be less than Post-Count (Returned).");
      return;
    }
    
    const originalMaterial = optimisticMaterials.find(m => m.id === materialId);
    if (!originalMaterial) return;

    const originalPreCount = originalMaterial.preCount !== undefined ? originalMaterial.preCount : originalMaterial.quantity;
    const originalPostCount = originalMaterial.postCount !== undefined ? originalMaterial.postCount : 0;
    const originalQuantity = originalMaterial.quantity || 0;
    
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
    } catch (error: any) {
      console.error("Failed to update material counts", error);
      // Rollback
      setOptimisticMaterials(prev => prev.map(m => 
        m.id === materialId ? originalMaterial : m
      ));
      alert(error?.message || "Failed to update counts. Make sure you have sufficient inventory stock.");
    }
  };

  const handleRemoveMaterial = async (materialId: string) => {
    if (!event?.id) return;
    
    const originalMaterial = optimisticMaterials.find(m => m.id === materialId);
    if (!originalMaterial) return;

    // Optimistic Update
    setOptimisticMaterials(prev => prev.filter(m => m.id !== materialId));
    setModalFeedback(null);

    try {
      const thresholds = {
        warning: settings?.warningThreshold || 250,
        critical: settings?.criticalThreshold || 75
      };
      await removeEventMaterial(event.id, materialId, thresholds);
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
      setModalFeedback({ type: 'error', message: errMsg });
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!formData.name.trim()) {
      setModalFeedback({ type: 'error', message: "Please specify an Event Name / Designation." });
      setActiveTab('details');
      return;
    }
    if (!formData.date) {
      setModalFeedback({ type: 'error', message: "Please specify an Event Date." });
      setActiveTab('details');
      return;
    }
    if (!formData.location.trim()) {
      setModalFeedback({ type: 'error', message: "Please specify a Location/Venue." });
      setActiveTab('details');
      return;
    }

    setLoading(true);
    setModalFeedback(null);
    try {
      // Parse YYYY-MM-DD as a local date at noon to prevent day shifting
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

        // 2. Add the Event and distribute items inside a single atomic transaction
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
      onClose();
    } catch (error: any) {
      console.error("Failed to save event", error);
      let errMsg = "Failed to save event. Check your role/permissions or logs.";
      try {
        if (error?.message) {
          const parsed = JSON.parse(error.message);
          if (parsed.error) errMsg = parsed.error;
        }
      } catch (_) {}
      setModalFeedback({ type: 'error', message: errMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!event?.id) return;
    setLoading(true);
    setModalFeedback(null);
    try {
      await deleteEvent(event.id);
      onClose();
    } catch (error: any) {
      console.error("Failed to delete event", error);
      let errMsg = "Failed to delete event. Check your role/permissions.";
      try {
        if (error?.message) {
          const parsed = JSON.parse(error.message);
          if (parsed.error) errMsg = parsed.error;
        }
      } catch (_) {}
      setModalFeedback({ type: 'error', message: errMsg });
      setShowEventDeleteConfirm(false);
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
            <div className="indicator-secondary" />
            <div className="px-6 sm:px-8 py-4 sm:py-6 border-b border-outline-variant flex justify-between items-center bg-surface-container shrink-0">
              <h2 className="font-headline font-bold text-base sm:text-lg text-primary uppercase tracking-wider line-clamp-1">
                {event ? 'Edit Distribution Event' : 'Schedule New Event'}
              </h2>
              <button onClick={onClose} className="text-on-surface-variant hover:text-primary transition-colors p-2">
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            <div className="flex border-b border-outline-variant bg-surface-container-low shrink-0">
              <button 
                onClick={() => setActiveTab('details')}
                className={cn(
                  "flex-1 py-3 sm:py-4 font-headline font-bold text-[10px] sm:text-[11px] uppercase tracking-widest transition-all border-b-2",
                  activeTab === 'details' ? "border-primary text-primary bg-white" : "border-transparent text-on-surface-variant hover:bg-surface-container"
                )}
              >
                Details
              </button>
              <button 
                onClick={() => setActiveTab('materials')}
                className={cn(
                  "flex-1 py-3 sm:py-4 font-headline font-bold text-[10px] sm:text-[11px] uppercase tracking-widest transition-all border-b-2",
                  activeTab === 'materials' ? "border-primary text-primary bg-white" : "border-transparent text-on-surface-variant hover:bg-surface-container"
                )}
              >
                {event ? `Materials (${materials.length})` : `Before Count (${beforeCountMaterials.length})`}
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

            {activeTab === 'details' ? (
              <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6 overflow-y-auto custom-scrollbar">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="font-headline font-bold text-[10px] sm:text-[11px] text-on-surface-variant uppercase tracking-widest block">Event Name / Designation</label>
                    <input 
                      required
                      type="text" 
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full border-0 border-b-2 border-surface-container bg-surface-container-low px-4 py-2 sm:py-3 font-sans text-sm focus:ring-0 focus:border-primary transition-all"
                      placeholder="e.g. Regional Youth Conference"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-2">
                      <label className="font-headline font-bold text-[10px] sm:text-[11px] text-on-surface-variant uppercase tracking-widest block">Event Date</label>
                      <input 
                        required
                        type="date" 
                        value={formData.date}
                        onChange={e => setFormData({...formData, date: e.target.value})}
                        className="w-full border-0 border-b-2 border-surface-container bg-surface-container-low px-4 py-2 sm:py-3 font-mono text-sm focus:ring-0 focus:border-primary transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="font-headline font-bold text-[10px] sm:text-[11px] text-on-surface-variant uppercase tracking-widest block">Distributed Count</label>
                      <input 
                        readOnly
                        type="number" 
                        value={formData.materialsDistributed}
                        className="w-full border-0 border-b-2 border-surface-container bg-surface-container-low px-4 py-2 sm:py-3 font-mono text-sm focus:ring-0 focus:border-primary transition-all opacity-70 cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {event?.categoryStats && (
                    <div className="p-4 bg-surface-container-low border border-outline-variant rounded-sharp space-y-3">
                      <h4 className="font-headline font-bold text-[10px] text-primary uppercase tracking-widest border-b border-outline-variant pb-2">Coverage Overview</h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <p className="font-headline font-bold text-lg text-primary">{event.categoryStats.bibles || 0}</p>
                          <p className="text-[9px] font-mono text-on-surface-variant uppercase tracking-tighter">Bibles</p>
                          {(event.categoryStats.bibles_en > 0 || event.categoryStats.bibles_es > 0) && (
                            <div className="flex justify-center gap-1 mt-1 text-[8px] font-bold text-slate-400 uppercase">
                              <span>EN:{event.categoryStats.bibles_en || 0}</span>
                              <span className="opacity-30">•</span>
                              <span>ES:{event.categoryStats.bibles_es || 0}</span>
                            </div>
                          )}
                        </div>
                        <div className="text-center border-l border-r border-outline-variant">
                          <p className="font-headline font-bold text-lg text-primary">{event.categoryStats.tracts || 0}</p>
                          <p className="text-[9px] font-mono text-on-surface-variant uppercase tracking-tighter">Tracts</p>
                          {(event.categoryStats.tracts_en > 0 || event.categoryStats.tracts_es > 0) && (
                            <div className="flex justify-center gap-1 mt-1 text-[8px] font-bold text-slate-400 uppercase">
                              <span>EN:{event.categoryStats.tracts_en || 0}</span>
                              <span className="opacity-30">•</span>
                              <span>ES:{event.categoryStats.tracts_es || 0}</span>
                            </div>
                          )}
                        </div>
                        <div className="text-center">
                          <p className="font-headline font-bold text-lg text-primary">{event.categoryStats.booklets || 0}</p>
                          <p className="text-[9px] font-mono text-on-surface-variant uppercase tracking-tighter">Booklets</p>
                          {(event.categoryStats.booklets_en > 0 || event.categoryStats.booklets_es > 0) && (
                            <div className="flex justify-center gap-1 mt-1 text-[8px] font-bold text-slate-400 uppercase">
                              <span>EN:{event.categoryStats.booklets_en || 0}</span>
                              <span className="opacity-30">•</span>
                              <span>ES:{event.categoryStats.booklets_es || 0}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-2">
                      <label className="font-headline font-bold text-[10px] sm:text-[11px] text-on-surface-variant uppercase tracking-widest block">Location / Venue</label>
                      <input 
                        required
                        type="text" 
                        value={formData.location}
                        onChange={e => setFormData({...formData, location: e.target.value})}
                        className="w-full border-0 border-b-2 border-surface-container bg-surface-container-low px-4 py-2 sm:py-3 font-sans text-sm focus:ring-0 focus:border-primary transition-all"
                        placeholder="e.g. Central Park Pavilion"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="font-headline font-bold text-[10px] sm:text-[11px] text-on-surface-variant uppercase tracking-widest block">Operational Status</label>
                    <div className="flex flex-wrap gap-2">
                      {['Scheduled', 'Stock Alert', 'Completed'].map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setFormData({...formData, status: s})}
                          className={`flex-1 min-w-[100px] py-1.5 sm:py-2 text-[9px] sm:text-[11px] font-bold uppercase tracking-wider border-2 rounded-sharp transition-all ${
                            formData.status === s 
                              ? 'bg-secondary text-primary border-secondary' 
                              : 'border-outline-variant text-on-surface-variant hover:border-secondary/50'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-outline-variant flex flex-col-reverse sm:flex-row justify-between gap-4 shrink-0">
                  {event && isAdmin && (
                    showEventDeleteConfirm ? (
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
                          onClick={() => setShowEventDeleteConfirm(false)}
                          className="px-4 py-3 border border-outline-variant text-on-surface-variant font-headline font-bold text-[11px] uppercase tracking-wider hover:bg-surface-container transition-colors rounded-sharp w-full sm:w-auto text-center"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowEventDeleteConfirm(true)}
                        disabled={loading}
                        className="flex items-center justify-center gap-2 px-6 py-3 border-2 border-tertiary text-tertiary font-headline font-bold text-[11px] uppercase tracking-wider hover:bg-tertiary/5 transition-colors rounded-sharp disabled:opacity-50 w-full sm:w-auto"
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
                        {loading ? 'Processing...' : (event ? 'Update Record' : 'Schedule')}
                      </button>
                    )}
                  </div>
                </div>
              </form>
            ) : (
              <div className="p-4 sm:p-8 flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto space-y-4 pr-1 sm:pr-2 custom-scrollbar">
                  {isAdmin && (
                    <div className="mb-4">
                      {isAddingMaterial ? (
                        <div className="space-y-3 p-4 bg-surface-container rounded-sharp border border-primary/20">
                          <div className="flex justify-between items-center mb-2">
                             <h4 className="text-[10px] font-headline font-bold text-primary uppercase tracking-widest">Select Resource to Add</h4>
                             <button onClick={() => setIsAddingMaterial(false)} className="text-on-surface-variant hover:text-tertiary">
                                <RotateCcw className="w-3.5 h-3.5" />
                             </button>
                          </div>
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input 
                              autoFocus
                              type="text"
                              value={searchQuery}
                              onChange={e => setSearchQuery(e.target.value)}
                              placeholder="Search inventory..."
                              className="w-full pl-10 pr-4 py-2 bg-white border border-outline-variant rounded-sharp text-xs focus:border-primary focus:ring-0 transition-all"
                            />
                          </div>
                          <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                            {inventory
                              .filter(i => 
                                (i.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                 i.sku?.toLowerCase().includes(searchQuery.toLowerCase())) &&
                                (event ? !optimisticMaterials.find(m => m.sku === i.sku) : !beforeCountMaterials.find(m => m.itemId === i.id))
                              )
                              .map(i => {
                                const isOutOfStock = (i.stockLevel || 0) <= 0;
                                const isAdjusting = selectedAdjustItem?.id === i.id;
                                return (
                                  <div
                                    key={i.id}
                                    className="w-full text-left p-2 hover:bg-primary/5 rounded-sharp border-b border-outline-variant/10 flex flex-col gap-2 transition-colors"
                                  >
                                    <div className="flex justify-between items-center w-full">
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
                                        <div className="flex items-center gap-2">
                                          <p className="text-[11px] font-bold text-primary">{i.title}</p>
                                          {i.language && (
                                            <span className="text-[8px] px-1 bg-surface-container-high text-on-surface-variant font-bold rounded uppercase">
                                              {i.language}
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-[9px] font-mono text-on-surface-variant">
                                          {i.sku} • {isOutOfStock ? (
                                            <span className="text-tertiary text-tertiary font-bold bg-tertiary/10 px-1 py-0.5 rounded">OUT OF STOCK</span>
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
                                            className="px-2 py-1 bg-tertiary/10 hover:bg-tertiary hover:text-white text-tertiary font-headline font-bold text-[9px] uppercase tracking-wider rounded-sharp transition-all"
                                          >
                                            {isAdjusting ? "Cancel" : "Adjust Shelf"}
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => handleAddMaterial(i)}
                                            className="p-1 text-primary hover:bg-primary/10 rounded-sharp"
                                          >
                                            <Plus className="w-4 h-4" />
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {isAdjusting && (
                                      <div className="p-2 bg-surface-container-low rounded-sharp border border-tertiary/30 shadow-inner flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[9px] font-headline font-bold text-on-surface-variant uppercase tracking-widest shrink-0">
                                            Actual Shelf Stock:
                                          </span>
                                          <input
                                            type="number"
                                            min={1}
                                            value={adjustStockValue}
                                            onChange={e => setAdjustStockValue(Math.max(1, parseInt(e.target.value) || 0))}
                                            className="w-16 bg-white border border-outline-variant px-1.5 py-0.5 font-mono text-xs text-center focus:ring-1 focus:ring-tertiary rounded-sharp"
                                          />
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => handleAdjustAndAdd(i)}
                                          disabled={loading}
                                          className="px-3 py-1 bg-tertiary hover:bg-tertiary-container text-white font-headline font-bold text-[9px] uppercase tracking-widest rounded-sharp transition-all shadow-sm"
                                        >
                                          {loading ? "Saving..." : "Verify & Add"}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            }
                          </div>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setIsAddingMaterial(true)}
                          className="w-full py-3 border-2 border-dashed border-outline-variant hover:border-primary hover:bg-primary/5 text-on-surface-variant hover:text-primary transition-all rounded-sharp flex items-center justify-center gap-2 font-headline font-bold text-[10px] uppercase tracking-widest"
                        >
                          <Plus className="w-4 h-4" />
                          {event ? "Add Resource to Distribution" : "Add Resource to Before Count"}
                        </button>
                      )}
                    </div>
                  )}

                  {!event ? (
                    /* CASE 1: Planning / Pre-Counting */
                    <>
                      <div className="p-3.5 bg-primary/5 border border-primary/20 rounded-sharp text-on-surface flex items-start gap-3 animate-in fade-in duration-200">
                        <span className="text-base select-none shrink-0 text-primary">📝</span>
                        <div>
                          <p className="text-[10px] font-headline font-bold text-primary uppercase tracking-wider">Planning Phase (Pre-Counting)</p>
                          <p className="text-[11px] text-on-surface-variant mt-0.5 leading-relaxed">Specify the quantities packed/checked out (Pre-Count) for transport to this event. System stock levels will be reserved upon scheduling.</p>
                        </div>
                      </div>

                      {beforeCountMaterials.length === 0 && !isAddingMaterial ? (
                        <div className="h-full py-12 flex flex-col items-center justify-center text-center space-y-4">
                          <Package className="w-10 sm:w-12 h-10 sm:h-12 text-outline-variant" />
                          <div>
                            <p className="font-headline font-bold text-on-surface-variant uppercase tracking-widest text-[10px] sm:text-[11px]">Before Count Is Empty</p>
                            <p className="text-[11px] sm:text-[12px] text-slate-400 mt-1 max-w-[200px]">Add materials and define how many you checked out for transport.</p>
                          </div>
                        </div>
                      ) : (
                        beforeCountMaterials.map((m) => (
                          <div key={m.itemId} className="p-3 sm:p-4 bg-surface rounded-sharp border border-outline-variant hover:border-primary flex flex-col gap-3 transition-colors">
                            <div className="flex justify-between items-center gap-3">
                              <div className="flex items-center gap-3 sm:gap-4">
                                <div className="w-8 h-8 bg-surface-container shrink-0 rounded-sharp flex items-center justify-center border border-outline-variant">
                                  <Package className="w-4 h-4 sm:w-5 h-5 text-primary" />
                                </div>
                                <div>
                                  <p className="font-headline font-bold text-primary text-[13px] sm:text-[14px] line-clamp-1">{m.title}</p>
                                  <div className="flex items-center gap-2">
                                    <p className="font-mono text-[9px] sm:text-[10px] text-on-surface-variant uppercase tracking-wider">{m.sku}</p>
                                    {m.language && (
                                      <>
                                        <span className="text-[8px] text-slate-300">•</span>
                                        <span className="text-[9px] font-bold text-on-surface-variant uppercase bg-surface-container px-1 rounded">{m.language}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <button 
                                type="button"
                                onClick={() => {
                                  setBeforeCountMaterials(prev => prev.filter(item => item.itemId !== m.itemId));
                                }}
                                className="p-1.5 text-slate-400 hover:text-tertiary hover:bg-surface-container rounded-sharp transition-all"
                                title="Remove Item"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="pt-2 border-t border-dashed border-outline-variant flex flex-col gap-3">
                              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                <div className="flex items-center gap-2 select-none">
                                  <input 
                                    type="checkbox"
                                    id={`correct-${m.itemId}`}
                                    checked={m.correctStock}
                                    onChange={e => {
                                      setBeforeCountMaterials(prev => prev.map(item => 
                                        item.itemId === m.itemId ? { ...item, correctStock: e.target.checked } : item
                                      ));
                                    }}
                                    className="rounded border-outline-variant text-primary focus:ring-primary w-4 h-4 transition-colors"
                                  />
                                  <label htmlFor={`correct-${m.itemId}`} className="text-[10px] font-headline font-bold text-on-surface-variant uppercase tracking-widest cursor-pointer">
                                    Correct System Stock level first
                                  </label>
                                </div>

                                {m.correctStock && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-headline font-bold text-on-surface-variant uppercase tracking-widest">Actual Shelf Total:</span>
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
                                      className="w-20 bg-surface-container-low border border-outline-variant px-2 py-1 font-mono text-xs text-center focus:ring-1 focus:ring-primary rounded-sharp"
                                    />
                                    <span className="text-[9px] font-mono text-slate-400 font-bold">(System: {m.systemStock})</span>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center justify-between bg-surface-container-low p-2 rounded-sharp border border-outline-variant">
                                <div className="text-[10px] font-headline font-bold text-on-surface-variant uppercase tracking-widest">
                                  Pre-Count Checked Out (Taken):
                                </div>
                                <div className="flex items-center gap-2">
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
                                    className="px-2 py-1 text-xs font-bold font-mono bg-surface border border-outline-variant hover:bg-surface-container text-on-surface rounded-sharp transition-colors"
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
                                      const limitStock = m.correctStock ? m.newStockLevel : m.systemStock;
                                      const finalVal = Math.min(val, limitStock);
                                      setBeforeCountMaterials(prev => prev.map(item => 
                                        item.itemId === m.itemId ? { ...item, quantity: finalVal } : item
                                      ));
                                    }}
                                    className="w-16 bg-white border border-outline-variant px-1 py-0.5 font-mono text-xs text-center focus:ring-1 focus:ring-primary rounded-sharp"
                                  />
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      setBeforeCountMaterials(prev => prev.map(item => {
                                        if (item.itemId === m.itemId) {
                                          const limitStock = item.correctStock ? item.newStockLevel : item.systemStock;
                                          return { ...item, quantity: Math.min(limitStock, item.quantity + 1) };
                                        }
                                        return item;
                                      }));
                                    }}
                                    className="px-2 py-1 text-xs font-bold font-mono bg-surface border border-outline-variant hover:bg-surface-container text-on-surface rounded-sharp transition-colors"
                                  >
                                    +
                                  </button>
                                  <span className="text-[10px] font-mono text-slate-400 font-bold">
                                    / {m.correctStock ? m.newStockLevel : m.systemStock} available
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </>
                  ) : (
                    /* CASE 2: Active Reconciliation / Post-Counting */
                    <>
                      <div className="p-3.5 bg-secondary/10 border border-secondary/20 rounded-sharp text-on-surface flex items-start gap-3 animate-in fade-in duration-205">
                        <span className="text-base select-none shrink-0 text-primary">📊</span>
                        <div>
                          <p className="text-[10px] font-headline font-bold text-primary uppercase tracking-wider">Post-Event Reconciliation (Post-Counting)</p>
                          <p className="text-[11px] text-on-surface-variant mt-0.5 leading-relaxed">Log the returned quantities (Post-Count) below. The system automatically calculates distributed items and returns any unused materials back into warehouse stock.</p>
                        </div>
                      </div>

                      {optimisticMaterials.length === 0 && !isAddingMaterial ? (
                        <div className="h-full py-12 flex flex-col items-center justify-center text-center space-y-4">
                          <Package className="w-10 sm:w-12 h-10 sm:h-12 text-outline-variant" />
                          <div>
                            <p className="font-headline font-bold text-on-surface-variant uppercase tracking-widest text-[10px] sm:text-[11px]">No distribution data</p>
                            <p className="text-[11px] sm:text-[12px] text-slate-400 mt-1 max-w-[200px]">Resources must be allocated via the primary distribution interface.</p>
                          </div>
                        </div>
                      ) : (
                        optimisticMaterials.map((m) => {
                          const itemPreCount = m.preCount !== undefined ? m.preCount : m.quantity;
                          const itemPostCount = m.postCount !== undefined ? m.postCount : 0;
                          const itemDistributed = Math.max(0, itemPreCount - itemPostCount);

                          const isEditingThisMaterial = editingMaterialId === m.id;
                          
                          // Inline validation logic
                          const liveNewDist = Math.max(0, editPreCount - editPostCount);
                          const liveInventoryDiff = liveNewDist - (m.quantity || 0);

                          return (
                            <div key={m.id} className={cn(
                              "p-3.5 bg-surface rounded-sharp border flex flex-col gap-3 group transition-all",
                              m.isOptimistic ? "opacity-60 border-dashed border-primary animate-pulse" : "border-outline-variant hover:border-primary/50"
                            )}>
                              {/* Material General Info Card */}
                              <div className="flex justify-between items-start gap-2">
                                <div className="flex items-center gap-3">
                                  <div className="w-7 h-7 sm:w-8 sm:h-8 bg-surface-container shrink-0 rounded-sharp flex items-center justify-center border border-outline-variant">
                                    <Package className={cn("w-3.5 h-3.5 sm:w-4 h-4", m.isOptimistic ? "text-slate-400" : "text-primary")} />
                                  </div>
                                  <div>
                                    <p className="font-headline font-bold text-primary text-[12px] sm:text-[13px] line-clamp-1">
                                      {m.title}
                                      {m.isOptimistic && <span className="ml-2 text-[9px] text-primary italic font-normal">(Syncing...)</span>}
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <p className="font-mono text-[9px] text-on-surface-variant uppercase tracking-wider">{m.sku}</p>
                                      {m.language && (
                                        <>
                                          <span className="text-[8px] text-slate-300">•</span>
                                          <span className="text-[9px] font-bold text-on-surface-variant uppercase bg-surface-container px-1 py-0.2 rounded">
                                            {m.language}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {isAdmin && !isEditingThisMaterial && (
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                      type="button"
                                      onClick={() => {
                                        setEditingMaterialId(m.id);
                                        setEditPreCount(itemPreCount);
                                        setEditPostCount(itemPostCount);
                                      }}
                                      className="p-1 px-1.5 bg-surface border border-outline-variant text-[10px] font-bold font-sans text-primary hover:bg-slate-50 hover:border-primary shrink-0 rounded-sharp flex items-center gap-1 transition-all"
                                      title="Edit pre/post counts"
                                    >
                                      <Edit2 className="w-2.5 h-2.5" /> Reconcile
                                    </button>
                                    <button 
                                      type="button"
                                      onClick={() => setRemovingMaterialId(m.id)}
                                      className="p-1 text-slate-400 hover:text-tertiary hover:bg-slate-50 border border-transparent hover:border-outline-variant rounded-sharp transition-all"
                                      title="Remove Item"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Material Numbers / Reconciliation Block */}
                              <div className="p-2 sm:p-3 bg-surface-container-low rounded-sharp border border-outline-variant/60">
                                {isEditingThisMaterial ? (
                                  /* Reconciliation inline entry form */
                                  <div className="space-y-3 animate-in fade-in zoom-in-95 duration-150">
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <label className="text-[9px] font-headline font-bold text-on-surface-variant uppercase tracking-widest block mb-1">
                                          Pre-Count (Checked Out):
                                        </label>
                                        <div className="flex items-center gap-1">
                                          <button 
                                            type="button"
                                            onClick={() => setEditPreCount(prev => Math.max(0, prev - 1))}
                                            className="px-1.5 py-0.5 text-xs font-mono bg-white border border-outline-variant rounded-sharp"
                                          >
                                            -
                                          </button>
                                          <input 
                                            type="number"
                                            value={editPreCount}
                                            onChange={e => setEditPreCount(Math.max(0, parseInt(e.target.value) || 0))}
                                            className="w-14 bg-white border border-outline-variant py-0.5 text-xs text-center font-mono focus:ring-1 focus:ring-primary rounded-sharp"
                                          />
                                          <button 
                                            type="button"
                                            onClick={() => setEditPreCount(prev => prev + 1)}
                                            className="px-1.5 py-0.5 text-xs font-mono bg-white border border-outline-variant rounded-sharp"
                                          >
                                            +
                                          </button>
                                        </div>
                                      </div>

                                      <div>
                                        <label className="text-[9px] font-headline font-bold text-on-surface-variant uppercase tracking-widest block mb-1">
                                          Post-Count (Returned Leftover):
                                        </label>
                                        <div className="flex items-center gap-1">
                                          <button 
                                            type="button"
                                            onClick={() => setEditPostCount(prev => Math.max(0, prev - 1))}
                                            className="px-1.5 py-0.5 text-xs font-mono bg-white border border-outline-variant rounded-sharp"
                                          >
                                            -
                                          </button>
                                          <input 
                                            type="number"
                                            value={editPostCount}
                                            onChange={e => setEditPostCount(Math.max(0, parseInt(e.target.value) || 0))}
                                            className="w-14 bg-white border border-outline-variant py-0.5 text-xs text-center font-mono focus:ring-1 focus:ring-primary rounded-sharp"
                                          />
                                          <button 
                                            type="button"
                                            onClick={() => setEditPostCount(prev => prev + 1)}
                                            className="px-1.5 py-0.5 text-xs font-mono bg-white border border-outline-variant rounded-sharp"
                                          >
                                            +
                                          </button>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Calculated output and warehouse indicators */}
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pt-2 border-t border-dashed border-outline-variant">
                                      <div className="text-[10px]">
                                        <p className="font-sans font-bold">
                                          Auto-Calculated Distributed: <span className="text-primary font-mono">{liveNewDist}</span> units
                                        </p>
                                        <p className="text-[9px] mt-0.5 font-sans">
                                          {liveInventoryDiff > 0 ? (
                                            <span className="text-amber-600 font-bold">⚠️ Will reserve {liveInventoryDiff} additional units from warehouse.</span>
                                          ) : liveInventoryDiff < 0 ? (
                                            <span className="text-green-600 font-bold">🍀 Will return {Math.abs(liveInventoryDiff)} unclaimed units back to warehouse.</span>
                                          ) : (
                                            <span className="text-slate-400 font-medium">No warehouse inventory changes.</span>
                                          )}
                                        </p>
                                      </div>

                                      <div className="flex items-center gap-1.5 self-end sm:self-auto">
                                        <button 
                                          type="button"
                                          onClick={() => handleUpdateMaterialCounts(m.id, editPreCount, editPostCount)}
                                          disabled={loading}
                                          className="p-1 px-2.5 bg-primary hover:bg-primary-container text-white rounded-sharp text-[10px] font-bold uppercase transition-colors disabled:opacity-50 flex items-center gap-1"
                                        >
                                          <Check className="w-3 h-3" /> Save Count
                                        </button>
                                        <button 
                                          type="button"
                                          onClick={() => setEditingMaterialId(null)}
                                          className="p-1 px-2 border border-outline-variant text-[10px] text-on-surface-variant bg-white font-bold uppercase hover:bg-surface-container rounded-sharp transition-colors"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  /* Normal inline snapshot display */
                                  <div className="flex justify-between items-center flex-wrap gap-2">
                                    <div className="grid grid-cols-3 gap-3 sm:gap-6 text-center divide-x divide-outline-variant">
                                      <div className="pr-1.5 sm:pr-4">
                                        <p className="font-mono text-sm sm:text-base font-bold text-on-surface">{itemPreCount}</p>
                                        <p className="text-[8px] font-headline font-bold text-on-surface-variant uppercase tracking-widest mt-0.5 whitespace-nowrap">Checked Out</p>
                                      </div>
                                      <div className="px-1.5 sm:px-4">
                                        <p className="font-mono text-sm sm:text-base font-bold text-on-surface">{itemPostCount}</p>
                                        <p className="text-[8px] font-headline font-bold text-on-surface-variant uppercase tracking-widest mt-0.5 whitespace-nowrap">Returned</p>
                                      </div>
                                      <div className="pl-1.5 sm:pl-4">
                                        <p className="font-mono text-sm sm:text-base font-bold text-primary">{itemDistributed}</p>
                                        <p className="text-[8px] font-headline font-bold text-on-surface-variant uppercase tracking-widest mt-0.5 whitespace-nowrap text-primary justify-center flex items-center">Distributed</p>
                                      </div>
                                    </div>

                                    <div>
                                      {itemDistributed > 0 ? (
                                        <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 text-emerald-600 rounded-sharp">
                                          ✓ Active Handout ({itemDistributed})
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-medium uppercase bg-slate-100 text-slate-500 rounded-sharp">
                                          0 Distributed
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Material confirmation for delete state */}
                              {removingMaterialId === m.id && (
                                <div className="p-2 border border-tertiary-container bg-tertiary-container/10 rounded-sharp flex items-center justify-between gap-2 animate-in slide-in-from-top-1">
                                  <span className="text-[10px] text-tertiary select-none font-bold">Confirm removing from this event ledger? Unused items return to warehouse.</span>
                                  <div className="flex gap-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRemovingMaterialId(null);
                                        handleRemoveMaterial(m.id);
                                      }}
                                      className="px-2 py-0.5 bg-tertiary text-white font-bold text-[9px] uppercase tracking-wider rounded-sharp"
                                    >
                                      Remove
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setRemovingMaterialId(null)}
                                      className="px-2 py-0.5 border border-outline-variant bg-white text-on-surface-variant font-bold text-[9px] uppercase tracking-wider rounded-sharp"
                                    >
                                      Keep
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </>
                  )}
                </div>
                <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-outline-variant flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
                  <div className="font-mono text-[10px] sm:text-[11px] text-on-surface-variant uppercase tracking-wider">
                    TOTAL DISTRIBUTED: <span className="text-primary font-bold">
                      {event ? optimisticMaterials.reduce((sum, m) => sum + (m.quantity || 0), 0) : beforeCountMaterials.reduce((sum, m) => sum + m.quantity, 0)}
                    </span>
                  </div>
                  <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 sm:ml-auto w-full sm:w-auto mt-2 sm:mt-0">
                    <button
                      type="button"
                      onClick={() => setActiveTab('details')}
                      className="px-6 py-2 text-on-surface-variant font-headline font-bold text-[10px] sm:text-[11px] uppercase tracking-widest hover:bg-surface-container transition-colors rounded-sharp text-center"
                    >
                      Back to Details
                    </button>
                    {!event && (
                      <button
                        onClick={() => handleSubmit()}
                        disabled={loading}
                        className="flex items-center justify-center gap-2 px-8 py-2.5 bg-primary text-white font-headline font-bold text-[10px] sm:text-[11px] uppercase tracking-widest hover:bg-primary-container transition-all rounded-sharp shadow-lg disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        {loading ? 'Processing...' : 'Schedule Event'}
                      </button>
                    )}
                    {event && (
                      <button
                        onClick={onClose}
                        className="w-full sm:w-auto px-6 py-2 text-on-surface-variant font-headline font-bold text-[10px] sm:text-[11px] uppercase tracking-widest hover:bg-surface-container transition-colors rounded-sharp text-center"
                      >
                        Close Ledger
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default EventModal;
