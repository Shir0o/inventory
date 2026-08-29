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
  onLogMovement?: (item: any) => void;
}

const StockHistoryModal = ({ isOpen, onClose, item, settings, onLogMovement }: StockHistoryModalProps) => {
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
    if (log.metadata?.isDirectMovement) {
      if (log.metadata.movementType === 'SUBTRACT') {
        return { label: 'Direct Outflow / Giving', color: 'bg-amber-100 text-amber-800 border-amber-300' };
      }
      return { label: 'Direct Inflow / Restock', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    }
    if (log.metadata?.isDirectDistribution) {
      return { label: 'Direct Distribution', color: 'bg-amber-100 text-amber-800 border-amber-300' };
    }
    switch (log.action) {
      case 'ITEM_CREATED':
        return { label: 'Created', color: 'bg-green-100 text-green-700 border-green-200' };
      case 'STOCK_UPDATE':
        return { label: 'Manual Adjustment', color: 'bg-blue-100 text-blue-700 border-blue-200' };
      case 'DISTRIBUTION':
        return { label: 'Event Distribution', color: 'bg-purple-100 text-purple-700 border-purple-200' };
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
            className="relative w-full max-w-2xl bg-surface m3-elevated-card rounded-[28px] overflow-hidden flex flex-col max-h-[85vh] border border-outline-variant/40"
          >
            <div className="indicator-secondary" />
            <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container shrink-0">
              <div className="flex items-center gap-3">
                <History className="w-5 h-5 text-secondary" />
                <div>
                  <h2 className="font-headline font-bold text-base text-primary uppercase tracking-wider">
                    Stock History & Outflow Log
                  </h2>
                  <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest">{item?.sku} • {item?.title}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onLogMovement && (
                  <button
                    onClick={() => {
                      onLogMovement(item);
                      onClose();
                    }}
                    className="px-3 py-1.5 bg-primary text-white text-[10px] font-headline font-bold uppercase tracking-wider rounded-sharp hover:bg-primary-container transition-all"
                  >
                    + Log Movement
                  </button>
                )}
                <button onClick={onClose} className="text-on-surface-variant hover:text-primary transition-colors p-1.5">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {loading ? (
                <div className="space-y-4 py-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="m3-filled-card p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="skeleton-box h-4 w-24 rounded-full" />
                        <div className="skeleton-box h-3 w-32 rounded-full" />
                      </div>
                      <div className="skeleton-box h-4 w-3/4 rounded-lg" />
                      <div className="skeleton-box h-3 w-1/2 rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                  <Package className="w-12 h-12 text-outline-variant" />
                  <div>
                    <p className="font-headline font-bold text-on-surface-variant uppercase tracking-widest text-[11px]">No history found</p>
                    <p className="text-[12px] text-slate-400 mt-1 max-w-[250px]">Direct giving, retrospective movement, and distributions will appear here.</p>
                  </div>
                  {onLogMovement && (
                    <button
                      onClick={() => {
                        onLogMovement(item);
                        onClose();
                      }}
                      className="px-4 py-2 bg-primary text-white text-xs font-headline font-bold uppercase tracking-wider rounded-sharp hover:bg-primary-container transition-all"
                    >
                      Record First Movement
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {logs.map((log) => {
                    const info = getLogTypeInfo(log);
                    let changeAmount = null;
                    let isPositive = false;
                    let isNegative = false;
                    
                    if (log.action === 'DISTRIBUTION') {
                      const itemData = log.metadata?.items?.find((i: any) => i.itemId === item.id);
                      if (itemData) {
                        changeAmount = `-${itemData.quantity} units`;
                        isNegative = true;
                      }
                    } else if (log.action === 'STOCK_UPDATE' && log.metadata) {
                      const prev = log.metadata.previousStock;
                      const next = log.metadata.newStock ?? log.metadata.item?.stockLevel;
                      const delta = log.metadata.delta !== undefined 
                        ? log.metadata.delta 
                        : (next !== undefined && prev !== undefined ? next - prev : null);

                      if (delta !== null && delta !== undefined) {
                        if (delta > 0) {
                          changeAmount = `+${delta} units (${prev ?? '?'} → ${next ?? '?'})`;
                          isPositive = true;
                        } else if (delta < 0) {
                          changeAmount = `${delta} units (${prev ?? '?'} → ${next ?? '?'})`;
                          isNegative = true;
                        } else {
                          changeAmount = `Stock balance confirmed (${next ?? '?'})`;
                        }
                      } else if (next !== undefined) {
                        changeAmount = `New balance: ${next}`;
                      }
                    }

                    const note = log.metadata?.note;
                    const recipient = log.metadata?.recipient;
                    const occurredAt = log.metadata?.occurredAt;
                    const category = log.metadata?.category;

                    return (
                      <div key={log.id} className="relative pl-6 pb-6 border-l border-outline-variant last:pb-0">
                        <div className="absolute left-[-5px] top-1.5 w-2.5 h-2.5 rounded-full bg-outline-variant border-2 border-background" />
                        <div className="ledger-card p-4 bg-surface hover:border-primary/30 transition-colors space-y-2.5">
                          <div className="flex flex-wrap justify-between items-start gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={cn(
                                "px-2 py-0.5 rounded-sharp border text-[9px] font-bold uppercase tracking-wider",
                                info.color
                              )}>
                                {info.label}
                              </span>
                              {category && (
                                <span className="px-1.5 py-0.5 rounded-sharp bg-surface-container text-on-surface-variant text-[9px] font-mono border border-outline-variant/60">
                                  {category}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-on-surface-variant">
                              <Calendar className="w-3 h-3" />
                              <span className="text-[10px] font-mono leading-none">{formatDate(log.timestamp)}</span>
                            </div>
                          </div>
                          
                          <p className="text-[13px] text-primary font-medium leading-snug">{log.details}</p>

                          {/* Retrospective Context Card */}
                          {(note || recipient || occurredAt) && (
                            <div className="p-3 bg-surface-container-low rounded-sharp border border-outline-variant/70 space-y-1.5">
                              {note && (
                                <div className="text-[12px] text-on-surface leading-normal flex items-start gap-2">
                                  <span className="text-xs select-none mt-0.5">💬</span>
                                  <div className="italic text-on-surface-variant">
                                    "{note}"
                                  </div>
                                </div>
                              )}
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-mono text-on-surface-variant pt-1 border-t border-outline-variant/40">
                                {recipient && (
                                  <div>
                                    <strong className="text-primary font-sans">Recipient / Handled by:</strong> {recipient}
                                  </div>
                                )}
                                {occurredAt && (
                                  <div>
                                    <strong className="text-primary font-sans">Occurred:</strong> {occurredAt}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {changeAmount && (
                            <div className="flex items-center gap-2">
                              {log.action === 'DISTRIBUTION' ? (
                                <div className="flex items-center gap-1 text-tertiary font-mono font-bold text-[12px]">
                                  <ArrowRight className="w-3 h-3 rotate-45" />
                                  <span>{changeAmount}</span>
                                </div>
                              ) : (
                                <div className={cn(
                                  "font-mono font-bold text-[12px]",
                                  isPositive ? "text-secondary" : isNegative ? "text-tertiary" : "text-primary"
                                )}>
                                  {changeAmount}
                                </div>
                              )}
                            </div>
                          )}

                          <div className="pt-2 border-t border-outline-variant/60 flex items-center gap-2 text-on-surface-variant text-[9px]">
                            <User className="w-3 h-3" />
                            <span className="font-bold uppercase tracking-widest">
                              Logged by {log.userName || 'Admin'} {log.userEmail ? `(${log.userEmail})` : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-surface-container border-t border-outline-variant flex justify-between items-center shrink-0">
              <span className="text-[10px] font-mono text-on-surface-variant">
                {logs.length} logged records
              </span>
              <button 
                onClick={onClose}
                className="px-6 py-2 bg-primary text-white font-headline font-bold text-[11px] uppercase tracking-wider rounded-sharp hover:bg-primary-container transition-all"
              >
                Close History
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default StockHistoryModal;
