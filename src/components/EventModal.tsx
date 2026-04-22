import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, Calendar as CalendarIcon, Package, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { addEvent, updateEvent, deleteEvent, subscribeToEventMaterials, restockItem } from '../services/firestoreService';
import { Timestamp } from 'firebase/firestore';
import { cn } from '../lib/utils';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event?: any;
}

const EventModal = ({ isOpen, onClose, event }: EventModalProps) => {
  const [activeTab, setActiveTab] = useState<'details' | 'materials'>('details');
  const [materials, setMaterials] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    date: '',
    location: '',
    materialsDistributed: 0,
    status: 'Scheduled'
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (event) {
      let dateStr = '';
      if (event.date) {
        const d = event.date.toDate ? event.date.toDate() : new Date(event.date);
        dateStr = d.toISOString().split('T')[0];
      }
      setFormData({
        name: event.name || '',
        date: dateStr,
        location: event.location || '',
        materialsDistributed: event.materialsDistributed || 0,
        status: event.status || 'Scheduled'
      });

      // Subscribe to materials
      const unsub = subscribeToEventMaterials(event.id, setMaterials);
      return () => unsub();
    } else {
      setFormData({
        name: '',
        date: new Date().toISOString().split('T')[0],
        location: '',
        materialsDistributed: 0,
        status: 'Scheduled'
      });
      setMaterials([]);
      setActiveTab('details');
    }
  }, [event, isOpen]);

  const handleRestock = async (material: any) => {
    const qty = prompt(`How many units of ${material.title} would you like to restock?`, material.quantity.toString());
    if (qty === null) return;
    
    const numQty = parseInt(qty);
    if (isNaN(numQty) || numQty <= 0 || numQty > material.quantity) {
      alert("Invalid quantity.");
      return;
    }

    try {
      await restockItem(event.id, material.id, material.itemId, numQty);
    } catch (error) {
      console.error("Failed to restock item", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const submissionData = {
        ...formData,
        date: Timestamp.fromDate(new Date(formData.date))
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
                  {event && (
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
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex items-center justify-center gap-2 px-8 py-3 bg-primary text-white font-headline font-bold text-[11px] uppercase tracking-wider hover:bg-primary-container transition-all rounded-sharp shadow-lg disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {loading ? 'Processing...' : (event ? 'Update Record' : 'Schedule')}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="p-4 sm:p-8 flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto space-y-4 pr-1 sm:pr-2 custom-scrollbar">
                  {materials.length === 0 ? (
                    <div className="h-full py-12 flex flex-col items-center justify-center text-center space-y-4">
                      <Package className="w-10 sm:w-12 h-10 sm:h-12 text-outline-variant" />
                      <div>
                        <p className="font-headline font-bold text-on-surface-variant uppercase tracking-widest text-[10px] sm:text-[11px]">No distribution data</p>
                        <p className="text-[11px] sm:text-[12px] text-slate-400 mt-1 max-w-[200px]">Resources must be allocated via the primary distribution interface.</p>
                      </div>
                    </div>
                  ) : (
                    materials.map((m) => (
                      <div key={m.id} className="p-3 sm:p-4 bg-surface-container rounded-sharp border border-outline-variant flex flex-col sm:flex-row justify-between sm:items-center gap-3 group hover:border-primary transition-colors bg-surface">
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-surface-container shrink-0 rounded-sharp flex items-center justify-center border border-outline-variant">
                            <Package className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-headline font-bold text-primary text-[13px] sm:text-[14px] line-clamp-1">{m.title}</p>
                            <p className="font-mono text-[9px] sm:text-[10px] text-on-surface-variant uppercase tracking-wider">{m.sku}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-6 sm:gap-8">
                          <div className="text-left sm:text-right">
                            <p className="font-mono font-bold text-base sm:text-lg text-primary">{m.quantity}</p>
                            <p className="text-[8px] sm:text-[9px] font-headline font-bold text-on-surface-variant uppercase tracking-widest">Distributed</p>
                          </div>
                          <button 
                            onClick={() => handleRestock(m)}
                            className="p-2 text-on-surface-variant hover:text-tertiary hover:bg-tertiary/10 rounded-sharp transition-all sm:opacity-0 sm:group-hover:opacity-100 flex items-center gap-2 sm:gap-0"
                            title="Restock Inventory"
                          >
                            <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
                            <span className="sm:hidden text-[10px] font-bold uppercase">Restock</span>
                          </button>
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
