import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, Calendar as CalendarIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { addEvent, updateEvent, deleteEvent } from '../services/firestoreService';
import { Timestamp } from 'firebase/firestore';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event?: any;
}

const EventModal = ({ isOpen, onClose, event }: EventModalProps) => {
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
    } else {
      setFormData({
        name: '',
        date: new Date().toISOString().split('T')[0],
        location: '',
        materialsAssigned: 0,
        status: 'Scheduled'
      });
    }
  }, [event, isOpen]);

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
                      required
                      type="number" 
                      value={formData.materialsAssigned}
                      onChange={e => setFormData({...formData, materialsAssigned: parseInt(e.target.value) || 0})}
                      className="w-full border-0 border-b-2 border-surface-container bg-surface-container-low px-4 py-3 font-mono text-[14px] focus:ring-0 focus:border-primary transition-all"
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
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default EventModal;
