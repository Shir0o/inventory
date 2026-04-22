import React, { useState, useRef } from 'react';
import { X, Upload, FileText, Check, AlertCircle, Loader2, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import { parseInventoryData, parseEventData, ParsedInventoryItem, ParsedEvent } from '../services/aiService';
import { addInventoryItem, importEventWithMaterials } from '../services/firestoreService';
import { cn } from '../lib/utils';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BulkImportModal = ({ isOpen, onClose }: BulkImportModalProps) => {
  const [step, setStep] = useState<'upload' | 'parsing' | 'review' | 'success'>('upload');
  const [importType, setImportType] = useState<'inventory' | 'events'>('inventory');
  const [rawData, setRawData] = useState('');
  const [parsedItems, setParsedItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRawData(content);
      startParsing(content);
    };
    reader.readAsText(file);
  };

  const startParsing = async (content: string) => {
    setStep('parsing');
    setLoading(true);
    setError(null);
    try {
      let items: any[] = [];
      if (importType === 'inventory') {
        items = await parseInventoryData(content);
      } else {
        items = await parseEventData(content);
      }
      setParsedItems(items);
      setStep('review');
    } catch (err: any) {
      setError(err.message || "Failed to parse data");
      setStep('upload');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setLoading(true);
    setImportProgress({ current: 0, total: parsedItems.length });
    
    try {
      for (let i = 0; i < parsedItems.length; i++) {
        if (importType === 'inventory') {
          await addInventoryItem(parsedItems[i]);
        } else {
          await importEventWithMaterials(parsedItems[i], parsedItems[i].materials);
        }
        setImportProgress(prev => ({ ...prev, current: i + 1 }));
      }
      setStep('success');
    } catch (err: any) {
      console.error("Import error:", err);
      setError("Import failed mid-way. Some items may have been added.");
    } finally {
      setLoading(false);
    }
  };

  const updateParsedItem = (index: number, field: string, value: any) => {
    const newItems = [...parsedItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setParsedItems(newItems);
  };

  const reset = () => {
    setStep('upload');
    setRawData('');
    setParsedItems([]);
    setError(null);
    setImportProgress({ current: 0, total: 0 });
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
            className="relative w-full max-w-4xl bg-background ledger-card overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh]"
          >
            <div className="indicator-primary" />
            <div className="px-6 sm:px-8 py-4 sm:py-6 border-b border-outline-variant flex justify-between items-center bg-surface-container shrink-0">
              <div className="flex items-center gap-3">
                <Upload className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                <h2 className="font-headline font-bold text-base sm:text-lg text-primary uppercase tracking-wider">
                  Bulk {importType === 'inventory' ? 'Inventory' : 'Event'} Import
                </h2>
              </div>
              <button onClick={onClose} className="text-on-surface-variant hover:text-primary transition-colors p-2">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
              {step === 'upload' && (
                <div className="space-y-6 sm:y-8">
                  <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <button 
                      onClick={() => setImportType('inventory')}
                      className={cn(
                        "flex-1 py-3 px-6 rounded-sharp font-headline font-bold text-[11px] uppercase tracking-widest transition-all border-2",
                        importType === 'inventory' ? "bg-primary text-white border-primary" : "bg-surface-container text-on-surface-variant border-outline-variant hover:border-primary/50"
                      )}
                    >
                      Resources
                    </button>
                    <button 
                      onClick={() => setImportType('events')}
                      className={cn(
                        "flex-1 py-3 px-6 rounded-sharp font-headline font-bold text-[11px] uppercase tracking-widest transition-all border-2",
                        importType === 'events' ? "bg-primary text-white border-primary" : "bg-surface-container text-on-surface-variant border-outline-variant hover:border-primary/50"
                      )}
                    >
                      Events & Distributions
                    </button>
                  </div>

                  <div className="text-center space-y-2">
                    <h3 className="font-headline font-bold text-lg sm:text-xl text-primary">Upload your {importType} list</h3>
                    <p className="text-on-surface-variant text-xs sm:text-sm">Gemini AI will parse your {importType === 'inventory' ? 'stock items' : 'events and material distributions'} automatically.</p>
                  </div>

                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-outline-variant rounded-sharp p-8 sm:p-12 text-center hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group"
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                      className="hidden" 
                      accept=".csv,.txt,.tsv"
                    />
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 bg-primary/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                        <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-headline font-bold text-primary uppercase tracking-widest text-[10px] sm:text-xs">Click to browse files</p>
                        <p className="text-[9px] sm:text-[10px] font-mono text-slate-400 uppercase">Supports CSV, TSV, TXT</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-surface-container p-4 sm:p-6 rounded-sharp border border-outline-variant">
                    <h4 className="font-headline font-bold text-[10px] sm:text-[11px] uppercase tracking-widest text-primary mb-4">AI Processing Instructions</h4>
                    <ul className="space-y-3">
                      {importType === 'inventory' ? (
                        [
                          "List your item names, SKUs, and current stock.",
                          "Categories should be Bibles, Tracts, or Booklets.",
                          "AI performs atomic mapping to our schema."
                        ].map((text, i) => (
                          <li key={i} className="flex gap-3 text-xs sm:text-sm text-on-surface-variant">
                            <span className="font-mono font-bold text-primary">{i + 1}.</span>
                            {text}
                          </li>
                        ))
                      ) : (
                        [
                          "Include event name, date, and location.",
                          "List materials distributed (SKU and quantity).",
                          "AI groups materials into discrete events."
                        ].map((text, i) => (
                          <li key={i} className="flex gap-3 text-xs sm:text-sm text-on-surface-variant">
                            <span className="font-mono font-bold text-primary">{i + 1}.</span>
                            {text}
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>
              )}

              {step === 'parsing' && (
                <div className="h-64 flex flex-col items-center justify-center gap-6">
                  <div className="relative">
                    <Loader2 className="w-16 h-16 text-primary animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-8 h-8 bg-secondary rounded-full animate-pulse" />
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="font-headline font-bold text-xl text-primary animate-pulse">AI is parsing your {importType}...</h3>
                    <p className="text-on-surface-variant text-sm font-mono uppercase tracking-widest">Constructing matrix schema</p>
                  </div>
                </div>
              )}

              {step === 'review' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 px-1">
                    <div>
                      <h3 className="font-headline font-bold text-lg sm:text-xl text-primary">Review AI Proposal</h3>
                      <p className="text-on-surface-variant text-xs sm:text-sm">Successfully mapped {parsedItems.length} {importType}.</p>
                    </div>
                    <button 
                      onClick={reset}
                      className="px-3 py-1.5 border border-outline-variant text-on-surface-variant font-headline font-bold text-[10px] sm:text-[11px] uppercase tracking-wider rounded-sharp hover:bg-surface-container transition-colors"
                    >
                      Reset AI
                    </button>
                  </div>

                  <div className="border border-outline-variant rounded-sharp overflow-hidden bg-surface">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[600px]">
                        <thead>
                          <tr className="bg-surface-container border-b border-outline-variant">
                            {importType === 'inventory' ? (
                              <>
                                <th className="px-4 py-3 font-headline text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">SKU</th>
                                <th className="px-4 py-3 font-headline text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Details</th>
                                <th className="px-4 py-3 font-headline text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Category</th>
                                <th className="px-4 py-3 font-headline text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Level</th>
                              </>
                            ) : (
                              <>
                                <th className="px-4 py-3 font-headline text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Event</th>
                                <th className="px-4 py-3 font-headline text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Context</th>
                                <th className="px-4 py-3 font-headline text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Distributions</th>
                                <th className="px-4 py-3 font-headline text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Status</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant">
                          {parsedItems.map((item, i) => (
                            <tr key={i} className="hover:bg-surface-container transition-colors group">
                              {importType === 'inventory' ? (
                                <>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    <input 
                                      type="text"
                                      value={item.sku}
                                      onChange={(e) => updateParsedItem(i, 'sku', e.target.value)}
                                      className="w-24 bg-transparent font-mono text-xs font-bold border-b border-transparent focus:border-primary outline-none focus:bg-surface px-1 py-0.5 rounded"
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex flex-col gap-1">
                                      <input 
                                        type="text"
                                        value={item.title}
                                        onChange={(e) => updateParsedItem(i, 'title', e.target.value)}
                                        className="w-full bg-transparent font-bold text-xs sm:text-[13px] text-primary border-b border-transparent focus:border-primary outline-none focus:bg-surface px-1 py-0.5 rounded"
                                      />
                                      <input 
                                        type="text"
                                        placeholder="Subtitle (Optional)"
                                        value={item.subtitle || ''}
                                        onChange={(e) => updateParsedItem(i, 'subtitle', e.target.value)}
                                        className="w-full bg-transparent text-[9px] sm:text-[10px] text-slate-400 border-b border-transparent focus:border-primary outline-none focus:bg-surface px-1 py-0.5 rounded"
                                      />
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <select 
                                      value={item.category}
                                      onChange={(e) => updateParsedItem(i, 'category', e.target.value)}
                                      className="bg-primary/10 text-primary text-[9px] sm:text-[10px] font-bold uppercase rounded-sharp border-none outline-none cursor-pointer hover:bg-primary/20 p-1"
                                    >
                                      <option value="Bibles">Bibles</option>
                                      <option value="Tracts">Tracts</option>
                                      <option value="Booklets">Booklets</option>
                                    </select>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    <input 
                                      type="number"
                                      value={item.stockLevel}
                                      onChange={(e) => updateParsedItem(i, 'stockLevel', parseInt(e.target.value) || 0)}
                                      className="w-16 bg-transparent font-mono text-xs font-bold border-b border-transparent focus:border-primary outline-none focus:bg-surface px-1 py-0.5 rounded text-center"
                                    />
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="px-4 py-3">
                                    <div className="flex flex-col gap-1">
                                      <input 
                                        type="text"
                                        value={item.name}
                                        onChange={(e) => updateParsedItem(i, 'name', e.target.value)}
                                        className="w-full bg-transparent font-bold text-xs sm:text-[13px] text-primary border-b border-transparent focus:border-primary outline-none focus:bg-surface px-1 py-0.5 rounded"
                                      />
                                      <input 
                                        type="date"
                                        value={item.date}
                                        onChange={(e) => updateParsedItem(i, 'date', e.target.value)}
                                        className="w-full bg-transparent font-mono text-[9px] text-on-surface-variant border-b border-transparent focus:border-primary outline-none focus:bg-surface px-1 py-0.5 rounded"
                                      />
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <input 
                                      type="text"
                                      value={item.location}
                                      onChange={(e) => updateParsedItem(i, 'location', e.target.value)}
                                      className="w-full bg-transparent text-xs text-on-surface-variant line-clamp-1 border-b border-transparent focus:border-primary outline-none focus:bg-surface px-1 py-0.5 rounded"
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex flex-wrap gap-1">
                                      {item.materials.slice(0, 3).map((m: any, idx: number) => (
                                        <span key={idx} className="bg-surface-container border border-outline-variant px-1.5 py-0.5 rounded text-[8px] font-mono group-hover:bg-surface transition-colors">
                                          {m.sku}×{m.quantity}
                                        </span>
                                      ))}
                                      {item.materials.length > 3 && (
                                        <span className="text-[8px] font-bold text-slate-400">+{item.materials.length - 3} more</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <select 
                                      value={item.status}
                                      onChange={(e) => updateParsedItem(i, 'status', e.target.value)}
                                      className="bg-secondary/10 text-secondary text-[9px] font-bold uppercase rounded-sharp border-none outline-none cursor-pointer hover:bg-secondary/20 p-1"
                                    >
                                      <option value="Scheduled">Scheduled</option>
                                      <option value="Completed">Completed</option>
                                      <option value="Stock Alert">Stock Alert</option>
                                    </select>
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-outline-variant flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4 shrink-0">
                    <button
                      onClick={onClose}
                      className="px-6 py-3 text-on-surface-variant font-headline font-bold text-[11px] uppercase tracking-wider hover:bg-surface-container transition-colors rounded-sharp text-center"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleImport}
                      disabled={loading}
                      className="flex items-center justify-center gap-2 px-8 py-3 bg-primary text-white font-headline font-bold text-[11px] uppercase tracking-wider hover:bg-primary-container transition-all rounded-sharp shadow-lg disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing ({importProgress.current}/{importProgress.total})
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Commit Batch to Matrix
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {step === 'success' && (
                <div className="h-64 flex flex-col items-center justify-center gap-6">
                  <div className="w-20 h-20 bg-secondary/20 rounded-full flex items-center justify-center">
                    <Check className="w-10 h-10 text-secondary" />
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="font-headline font-bold text-2xl text-primary">Reconciliation Success!</h3>
                    <p className="text-on-surface-variant text-sm">Successfully synced {importProgress.total} records to the {importType} ledger.</p>
                  </div>
                  <button
                    onClick={onClose}
                    className="px-8 py-3 bg-primary text-white font-headline font-bold text-[12px] uppercase tracking-wider hover:bg-primary-container transition-all rounded-sharp shadow-lg"
                  >
                    Finish
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default BulkImportModal;
