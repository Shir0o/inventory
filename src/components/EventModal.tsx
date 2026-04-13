import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, Calendar as CalendarIcon, Package, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { addEvent, updateEvent, deleteEvent, subscribeToEventMaterials, returnItem } from '../services/firestoreService';
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
    materialsAssigned: 0,
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
        materialsAssigned: event.materialsAssigned || 0,
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
        materialsAssigned: 0,
        status: 'Scheduled'
      });
      setMaterials([]);
      setActiveTab('details');
    }
  }, [event, isOpen]);

  const handleReturn = async (material: any) => {
    const qty = prompt(`How many units of ${material.title} would you like to return?`, material.quantity.toString());
    if (qty === null) return;
    
    const numQty = parseInt(qty);
    if (isNaN(numQty) || numQty <= 0 || numQty > material.quantity) {
      alert("Invalid quantity.");
      return;
    }

    try {
      await returnItem(event.id, material.id, material.itemId, numQty);
    } catch (error) {
      console.error("Failed to return item", error);
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
            className="relative w-full max-w-lg bg-background ledger-card overflow-hidden"
          >
            <div className="indicator-secondary" />
            <div className="px-8 py-6 border-b border-outline-variant flex justify-between items-center bg-surface-container">
              <h2 className="font-headline font-bold text-lg text-primary uppercase tracking-wider">
                {event ? 'Edit Distribution Event' : 'Schedule New Event'}
              </h2>
              <button onClick={onClose} className="text-on-surface-variant hover:text-primary transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            {event && (
              <div className="flex border-b border-outline-variant bg-surface-container-low">
                <button 
                  onClick={() => setActiveTab('details')}
                  className={cn(
                    "flex-1 py-4 font-headline font-bold text-[11px] uppercase tracking-widest transition-all border-b-2",
                    activeTab === 'details' ? "border-primary text-primary bg-white" : "border-transparent text-on-surface-variant hover:bg-surface-container"
                  )}
                >
                  Event Details
                </button>
                <button 
                  onClick={() => setActiveTab('materials')}
                  className={cn(
                    "flex-1 py-4 font-headline font-bold text-[11px] uppercase tracking-widest transition-all border-b-2",
                    activeTab === 'materials' ? "border-primary text-primary bg-white" : "border-transparent text-on-surface-variant hover:bg-surface-container"
                  )}
                >
                  Assigned Materials ({materials.length})
                </button>
              </div>
            )}

            {activeTab === 'details' ? (
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="font-headline font-bold text-[11px] text-on-surface-variant uppercase tracking-widest block">Event Name / Designation</label>
                    <input 
                      required
                      type="text" 
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full border-0 border-b-2 border-surface-container bg-surface-container-low px-4 py-3 font-sans text-[14px] focus:ring-0 focus:border-primary transition-all"
                      placeholder="e.g. Regional Youth Conference"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="font-headline font-bold text-[11px] text-on-surface-variant uppercase tracking-widest block">Event Date</label>
                      <div className="relative">
                        <input 
                          required
                          type="date" 
                          value={formData.date}
                          onChange={e => setFormData({...formData, date: e.target.value})}
                          className="w-full border-0 border-b-2 border-surface-container bg-surface-container-low px-4 py-3 font-mono text-[14px] focus:ring-0 focus:border-primary transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="font-headline font-bold text-[11px] text-on-surface-variant uppercase tracking-widest block">Materials Assigned</label>
                      <input 
                        readOnly
                        type="number" 
                        value={formData.materialsAssigned}
                        className="w-full border-0 border-b-2 border-surface-container bg-surface-container-low px-4 py-3 font-mono text-[14px] focus:ring-0 focus:border-primary transition-all opacity-70 cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="font-headline font-bold text-[11px] text-on-surface-variant uppercase tracking-widest block">Location / Venue</label>
                    <input 
                      required
                      type="text" 
                      value={formData.location}
                      onChange={e => setFormData({...formData, location: e.target.value})}
                      className="w-full border-0 border-b-2 border-surface-container bg-surface-container-low px-4 py-3 font-sans text-[14px] focus:ring-0 focus:border-primary transition-all"
                      placeholder="e.g. Central Park Pavilion"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="font-headline font-bold text-[11px] text-on-surface-variant uppercase tracking-widest block">Operational Status</label>
                    <div className="flex gap-4">
                      {['Scheduled', 'Stock Alert', 'Completed'].map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setFormData({...formData, status: s})}
                          className={`flex-1 py-2 text-[11px] font-bold uppercase tracking-wider border-2 rounded-sharp transition-all ${
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

                <div className="pt-6 border-t border-outline-variant flex justify-between gap-4">
                  {event && (
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
                      {loading ? 'Processing...' : (event ? 'Update Record' : 'Schedule Event')}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="p-8 h-[500px] flex flex-col">
                <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                  {materials.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                      <Package className="w-12 h-12 text-outline-variant" />
                      <div>
                        <p className="font-headline font-bold text-on-surface-variant uppercase tracking-widest text-[11px]">No materials assigned</p>
                        <p className="text-[12px] text-slate-400 mt-1">Use the Checkout system to link inventory items to this event.</p>
                      </div>
                    </div>
                  ) : (
                    materials.map((m) => (
                      <div key={m.id} className="p-4 bg-surface-container rounded-sharp border border-outline-variant flex justify-between items-center group hover:border-primary transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-white rounded-sharp flex items-center justify-center border border-outline-variant">
                            <Package className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-headline font-bold text-primary text-[14px]">{m.title}</p>
                            <p className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">{m.sku}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="font-mono font-bold text-lg text-primary">{m.quantity}</p>
                            <p className="text-[9px] font-headline font-bold text-on-surface-variant uppercase tracking-widest">Units Assigned</p>
                          </div>
                          <button 
                            onClick={() => handleReturn(m)}
                            className="p-2 text-on-surface-variant hover:text-tertiary hover:bg-tertiary/10 rounded-sharp transition-all opacity-0 group-hover:opacity-100"
                            title="Return Stock"
                          >
                            <RotateCcw className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-6 pt-6 border-t border-outline-variant flex justify-between items-center">
                  <div className="font-mono text-[11px] text-on-surface-variant">
                    TOTAL ASSIGNED: <span className="text-primary font-bold">{formData.materialsAssigned}</span>
                  </div>
                  <button
                    onClick={onClose}
                    className="px-6 py-2 text-on-surface-variant font-headline font-bold text-[11px] uppercase tracking-widest hover:bg-surface-container transition-colors rounded-sharp"
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
