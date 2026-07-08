import React, { useState, useEffect } from 'react';
import { X, History, ArrowRight, Package, Calendar, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { subscribeToItemHistory } from '../services/firestoreService';
import { cn } from '../lib/utils';

interface StockHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: any;
  settings?: any;
}

const StockHistoryModal = ({ isOpen, onClose, item, settings }: StockHistoryModalProps) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && item?.id) {
      setLoading(true);
      const unsubscribe = subscribeToItemHistory(item.id, (data) => {
        setLogs(data);
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [isOpen, item?.id]);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '---';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: settings?.timezone || 'UTC'
    }).format(date);
  };

  const getLogTypeInfo = (log: any) => {
    switch (log.action) {
      case 'ITEM_CREATED':
        return { label: 'Created', color: 'bg-green-100 text-green-700 border-green-200' };
      case 'STOCK_UPDATE':
        return { label: 'Manual Update', color: 'bg-blue-100 text-blue-700 border-blue-200' };
      case 'DISTRIBUTION':
        return { label: 'Distribution', color: 'bg-orange-100 text-orange-700 border-orange-200' };
      default:
        return { label: log.action, color: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
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
            className="relative w-full max-w-2xl bg-background ledger-card overflow-hidden flex flex-col max-h-[85vh]"
          >
            <div className="indicator-secondary" />
            <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container shrink-0">
              <div className="flex items-center gap-3">
                <History className="w-5 h-5 text-secondary" />
                <div>
                  <h2 className="font-headline font-bold text-base text-primary uppercase tracking-wider">
                    Stock History
                  </h2>
                  <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest">{item?.sku} • {item?.title}</p>
                </div>
              </div>
              <button onClick={onClose} className="text-on-surface-variant hover:text-primary transition-colors p-2">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-3">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-[11px] font-headline font-bold text-on-surface-variant uppercase tracking-widest">Loading Audit Trail...</p>
                </div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                  <Package className="w-12 h-12 text-outline-variant" />
                  <div>
                    <p className="font-headline font-bold text-on-surface-variant uppercase tracking-widest text-[11px]">No history found</p>
                    <p className="text-[12px] text-slate-400 mt-1 max-w-[250px]">Distributions and manual updates will appear here once recorded.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {logs.map((log) => {
                    const info = getLogTypeInfo(log);
                    let changeAmount = null;
                    
                    if (log.action === 'DISTRIBUTION') {
                      const itemData = log.metadata?.items?.find((i: any) => i.itemId === item.id);
                      if (itemData) {
                        changeAmount = `-${itemData.quantity}`;
                      }
                    } else if (log.action === 'STOCK_UPDATE' && log.metadata?.item) {
                      // Note: This assumes we logged the NEW stock level.
                      // For more precise history, we'd need to log the PREVIOUS stock level too.
                      changeAmount = `New: ${log.metadata.item.stockLevel}`;
                    }

                    return (
                      <div key={log.id} className="relative pl-6 pb-6 border-l border-outline-variant last:pb-0">
                        <div className="absolute left-[-5px] top-1.5 w-2.5 h-2.5 rounded-full bg-outline-variant border-2 border-background" />
                        <div className="ledger-card p-4 bg-surface hover:border-primary/30 transition-colors">
                          <div className="flex justify-between items-start gap-4 mb-2">
                            <span className={cn(
                              "px-2 py-0.5 rounded-sharp border text-[9px] font-bold uppercase tracking-wider",
                              info.color
                            )}>
                              {info.label}
                            </span>
                            <div className="flex items-center gap-1.5 text-on-surface-variant">
                              <Calendar className="w-3 h-3" />
                              <span className="text-[10px] font-mono leading-none">{formatDate(log.timestamp)}</span>
                            </div>
                          </div>
                          
                          <p className="text-[13px] text-primary font-medium">{log.details}</p>
                          
                          {changeAmount && (
                            <div className="mt-2 flex items-center gap-2">
                              {log.action === 'DISTRIBUTION' ? (
                                <div className="flex items-center gap-1 text-tertiary font-mono font-bold text-[12px]">
                                  <ArrowRight className="w-3 h-3 rotate-45" />
                                  <span>{changeAmount} units</span>
                                </div>
                              ) : (
                                <div className="text-secondary font-mono font-bold text-[12px]">
                                  {changeAmount}
                                </div>
                              )}
                            </div>
                          )}

                          <div className="mt-3 pt-3 border-t border-outline-variant flex items-center gap-2 text-on-surface-variant">
                            <User className="w-3 h-3" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">
                              {log.userName || 'System'} {log.userEmail ? `(${log.userEmail})` : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-surface-container border-t border-outline-variant flex justify-center shrink-0">
              <button 
                onClick={onClose}
                className="px-8 py-2 bg-primary text-white font-headline font-bold text-[11px] uppercase tracking-wider rounded-sharp hover:bg-primary-container transition-all"
              >
                Close Trail
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default StockHistoryModal;
