import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, Calendar as CalendarIcon, Package, Edit2, Check, RotateCcw, Plus, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { addEvent, updateEvent, deleteEvent, subscribeToEventMaterials, updateEventMaterialQuantity, removeEventMaterial, distributeItems } from '../services/firestoreService';
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
  const [materials, setMaterials] = useState<any[]>([]);
  const [optimisticMaterials, setOptimisticMaterials] = useState<any[]>([]);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState<number>(0);
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    date: '',
    location: '',
    region: 'Central',
    materialsDistributed: 0,
    status: 'Scheduled'
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
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
        region: event.region || 'Central',
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
        region: 'Central',
        materialsDistributed: 0,
        status: 'Scheduled'
      });
      setMaterials([]);
      setOptimisticMaterials([]);
      setActiveTab('details');
      setEditingMaterialId(null);
      setIsAddingMaterial(false);
      setSearchQuery('');
    }
  }, [event, isOpen]);

  const handleAddMaterial = async (item: any) => {
    if (!event?.id) return;
    
    // Default to adding 10 units or remaining stock if less
    const qtyToAdd = Math.min(10, item.stockLevel || 0);
    
    if (qtyToAdd <= 0) {
      alert("This item is out of stock.");
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

  const handleRemoveMaterial = async (materialId: string) => {
    if (!event?.id || !confirm("Remove this item from distribution? This will return stock to inventory.")) return;
    
    const originalMaterial = optimisticMaterials.find(m => m.id === materialId);
    if (!originalMaterial) return;

    // Optimistic Update
    setOptimisticMaterials(prev => prev.filter(m => m.id !== materialId));

    try {
      const thresholds = {
        warning: settings?.warningThreshold || 250,
        critical: settings?.criticalThreshold || 75
      };
      await removeEventMaterial(event.id, materialId, thresholds);
    } catch (error) {
      console.error("Failed to remove material", error);
      // Rollback
      setOptimisticMaterials(prev => [...prev, originalMaterial]);
      alert("Failed to remove item. Please try again.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Parse YYYY-MM-DD as a local date at noon to prevent day shifting
      const [year, month, day] = formData.date.split('-').map(Number);
      const localDate = new Date(year, month - 1, day, 12, 0, 0);
      
      const submissionData = {
        ...formData,
        date: Timestamp.fromDate(localDate)
      };
      if (event?.id) {
        await updateEvent(event.id, submissionData);
      } else {
        await addEvent(submissionData);
      }
      onClose();
    } catch (error) {
      console.error("Failed to save event", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!event?.id || !confirm("Are you sure you want to delete this event?")) return;
    setLoading(true);
    try {
      await deleteEvent(event.id);
      onClose();
    } catch (error) {
      console.error("Failed to delete event", error);
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
            <div className="indicator-secondary" />
            <div className="px-6 sm:px-8 py-4 sm:py-6 border-b border-outline-variant flex justify-between items-center bg-surface-container shrink-0">
              <h2 className="font-headline font-bold text-base sm:text-lg text-primary uppercase tracking-wider line-clamp-1">
                {event ? 'Edit Distribution Event' : 'Schedule New Event'}
              </h2>
              <button onClick={onClose} className="text-on-surface-variant hover:text-primary transition-colors p-2">
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            {event && (
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
                  Materials ({materials.length})
                </button>
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
                    <div className="space-y-2">
                      <label className="font-headline font-bold text-[10px] sm:text-[11px] text-on-surface-variant uppercase tracking-widest block">Region</label>
                      <select 
                        required
                        value={formData.region}
                        onChange={e => setFormData({...formData, region: e.target.value})}
                        className="w-full border-0 border-b-2 border-surface-container bg-surface-container-low px-4 py-2 sm:py-3 font-headline font-bold text-[11px] uppercase tracking-wider focus:ring-0 focus:border-primary transition-all appearance-none"
                      >
                        {['North', 'South', 'East', 'West', 'Central'].map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
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
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={loading}
                      className="flex items-center justify-center gap-2 px-6 py-3 border-2 border-tertiary text-tertiary font-headline font-bold text-[11px] uppercase tracking-wider hover:bg-tertiary/5 transition-colors rounded-sharp disabled:opacity-50 w-full sm:w-auto"
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
                                i.stockLevel > 0 &&
                                !optimisticMaterials.find(m => m.sku === i.sku)
                              )
                              .map(i => (
                                <button
                                  key={i.id}
                                  onClick={() => handleAddMaterial(i)}
                                  className="w-full text-left p-2 hover:bg-primary/5 rounded-sharp flex justify-between items-center group transition-colors"
                                >
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="text-[11px] font-bold text-primary">{i.title}</p>
                                      {i.language && (
                                        <span className="text-[8px] px-1 bg-surface-container-high text-on-surface-variant font-bold rounded uppercase">
                                          {i.language}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[9px] font-mono text-on-surface-variant">{i.sku} • {i.stockLevel} in stock</p>
                                  </div>
                                  <Plus className="w-3.5 h-3.5 text-slate-300 group-hover:text-primary" />
                                </button>
                              ))
                            }
                          </div>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setIsAddingMaterial(true)}
                          className="w-full py-3 border-2 border-dashed border-outline-variant hover:border-primary hover:bg-primary/5 text-on-surface-variant hover:text-primary transition-all rounded-sharp flex items-center justify-center gap-2 font-headline font-bold text-[10px] uppercase tracking-widest"
                        >
                          <Plus className="w-4 h-4" />
                          Add Resource to Distribution
                        </button>
                      )}
                    </div>
                  )}

                  {optimisticMaterials.length === 0 && !isAddingMaterial ? (
                    <div className="h-full py-12 flex flex-col items-center justify-center text-center space-y-4">
                      <Package className="w-10 sm:w-12 h-10 sm:h-12 text-outline-variant" />
                      <div>
                        <p className="font-headline font-bold text-on-surface-variant uppercase tracking-widest text-[10px] sm:text-[11px]">No distribution data</p>
                        <p className="text-[11px] sm:text-[12px] text-slate-400 mt-1 max-w-[200px]">Resources must be allocated via the primary distribution interface.</p>
                      </div>
                    </div>
                  ) : (
                    optimisticMaterials.map((m) => (
                      <div key={m.id} className={cn(
                        "p-3 sm:p-4 bg-surface rounded-sharp border border-outline-variant flex flex-col sm:flex-row justify-between sm:items-center gap-3 group transition-colors",
                        m.isOptimistic ? "opacity-60 border-dashed border-primary animate-pulse" : "hover:border-primary"
                      )}>
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-surface-container shrink-0 rounded-sharp flex items-center justify-center border border-outline-variant">
                            <Package className={cn("w-4 h-4 sm:w-5 sm:h-5", m.isOptimistic ? "text-slate-400" : "text-primary")} />
                          </div>
                          <div>
                            <p className="font-headline font-bold text-primary text-[13px] sm:text-[14px] line-clamp-1">
                              {m.title}
                              {m.isOptimistic && <span className="ml-2 text-[9px] text-primary italic font-normal">(Syncing...)</span>}
                            </p>
                            <div className="flex items-center gap-2">
                              <p className="font-mono text-[9px] sm:text-[10px] text-on-surface-variant uppercase tracking-wider">{m.sku}</p>
                              {m.language && (
                                <>
                                  <span className="text-[8px] text-slate-300">•</span>
                                  <span className="text-[9px] font-bold text-on-surface-variant uppercase bg-surface-container px-1 rounded">
                                    {m.language}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6">
                          {editingMaterialId === m.id ? (
                            <div className="flex items-center gap-2">
                              <input 
                                type="number"
                                value={editQuantity}
                                onChange={e => setEditQuantity(parseInt(e.target.value) || 0)}
                                className="w-16 sm:w-20 bg-surface-container-low border-0 border-b border-primary px-2 py-1 font-mono text-sm focus:ring-0"
                                autoFocus
                              />
                              <button 
                                onClick={() => handleUpdateMaterial(m.id)}
                                disabled={loading}
                                className="p-1.5 bg-primary text-white rounded-sharp hover:bg-primary-container transition-colors disabled:opacity-50"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => setEditingMaterialId(null)}
                                className="p-1.5 text-on-surface-variant hover:bg-surface-container rounded-sharp transition-colors"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="text-left sm:text-right">
                              <p className="font-mono font-bold text-base sm:text-lg text-primary">{m.quantity}</p>
                              <p className="text-[8px] sm:text-[9px] font-headline font-bold text-on-surface-variant uppercase tracking-widest">Distributed</p>
                            </div>
                          )}

                          {isAdmin && !editingMaterialId && (
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => {
                                  setEditingMaterialId(m.id);
                                  setEditQuantity(m.quantity);
                                }}
                                className="p-1.5 text-slate-400 hover:text-primary hover:bg-surface-container rounded-sharp transition-all"
                                title="Edit Quantity"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => handleRemoveMaterial(m.id)}
                                className="p-1.5 text-slate-400 hover:text-tertiary hover:bg-surface-container rounded-sharp transition-all"
                                title="Remove Item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-outline-variant flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
                  <div className="font-mono text-[10px] sm:text-[11px] text-on-surface-variant uppercase tracking-wider">
                    TOTAL ALLOCATION: <span className="text-primary font-bold">{formData.materialsDistributed}</span>
                  </div>
                  <button
                    onClick={onClose}
                    className="w-full sm:w-auto px-6 py-2 text-on-surface-variant font-headline font-bold text-[10px] sm:text-[11px] uppercase tracking-widest hover:bg-surface-container transition-colors rounded-sharp text-center"
                  >
                    Close Ledger
                  </button>
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
