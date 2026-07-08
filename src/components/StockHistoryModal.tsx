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
        return { label: 'Created', color: 'bg-success-50 text-success-700 border-success-200' };
      case 'STOCK_UPDATE':
        return { label: 'Manual Update', color: 'bg-primary-50 text-primary-700 border-primary-200' };
      case 'DISTRIBUTION':
        return { label: 'Distribution', color: 'bg-accent-50 text-accent-700 border-accent-200' };
      default:
        return { label: log.action, color: 'bg-gray-100 text-gray-700 border-gray-200' };
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
            className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary-100 flex items-center justify-center">
                  <History className="w-5 h-5 text-secondary-600" />
                </div>
                <div>
                  <h2 className="font-display font-semibold text-lg text-gray-900">Stock History</h2>
                  <p className="text-xs text-gray-400 font-mono">{item?.sku} - {item?.title}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-3">
                  <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-gray-500">Loading...</p>
                </div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                  <Package className="w-12 h-12 text-gray-300" />
                  <div>
                    <p className="font-medium text-gray-500">No history found</p>
                    <p className="text-sm text-gray-400 mt-1">Updates will appear here.</p>
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
                      <div key={log.id} className="relative pl-6 pb-6 border-l border-gray-200 last:pb-0">
                        <div className="absolute left-[-5px] top-1.5 w-2.5 h-2.5 rounded-full bg-gray-300 border-2 border-white" />
                        <div className="bg-white p-4 rounded-xl border border-gray-200 hover:border-primary-300 transition-colors shadow-sm">
                          <div className="flex justify-between items-start gap-4 mb-2">
                            <span className={cn(
                              "px-2 py-0.5 rounded-lg border text-[9px] font-bold uppercase tracking-wider",
                              info.color
                            )}>
                              {info.label}
                            </span>
                            <div className="flex items-center gap-1.5 text-gray-500">
                              <Calendar className="w-3 h-3" />
                              <span className="text-[10px] font-mono leading-none">{formatDate(log.timestamp)}</span>
                            </div>
                          </div>

                          <p className="text-[13px] text-primary-600 font-medium">{log.details}</p>

                          {changeAmount && (
                            <div className="mt-2 flex items-center gap-2">
                              {log.action === 'DISTRIBUTION' ? (
                                <div className="flex items-center gap-1 text-accent-600 font-mono font-bold text-[12px]">
                                  <ArrowRight className="w-3 h-3 rotate-45" />
                                  <span>{changeAmount} units</span>
                                </div>
                              ) : (
                                <div className="text-secondary-600 font-mono font-bold text-[12px]">
                                  {changeAmount}
                                </div>
                              )}
                            </div>
                          )}

                          <div className="mt-3 pt-3 border-t border-gray-200 flex items-center gap-2 text-gray-500">
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

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-center shrink-0">
              <button
                onClick={onClose}
                className="px-8 py-2 bg-primary-600 text-white font-display font-bold text-[11px] uppercase tracking-wider rounded-xl hover:bg-primary-700 transition-all"
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
