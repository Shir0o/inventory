import React, { useState, useRef } from 'react';
import { X, Upload, FileText, Check, AlertCircle, Loader2, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import { parseInventoryData, ParsedInventoryItem } from '../services/aiService';
import { addInventoryItem } from '../services/firestoreService';
import { cn } from '../lib/utils';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BulkImportModal = ({ isOpen, onClose }: BulkImportModalProps) => {
  const [step, setStep] = useState<'upload' | 'parsing' | 'review' | 'success'>('upload');
  const [rawData, setRawData] = useState('');
  const [parsedItems, setParsedItems] = useState<ParsedInventoryItem[]>([]);
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
      const items = await parseInventoryData(content);
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
        await addInventoryItem(parsedItems[i]);
        setImportProgress(prev => ({ ...prev, current: i + 1 }));
      }
      setStep('success');
    } catch (err: any) {
      setError("Import failed mid-way. Some items may have been added.");
    } finally {
      setLoading(false);
    }
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
            className="relative w-full max-w-4xl bg-background ledger-card overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="indicator-primary" />
            <div className="px-8 py-6 border-b border-outline-variant flex justify-between items-center bg-surface-container">
              <div className="flex items-center gap-3">
                <Upload className="w-6 h-6 text-primary" />
                <h2 className="font-headline font-bold text-lg text-primary uppercase tracking-wider">
                  Bulk Inventory Import
                </h2>
              </div>
              <button onClick={onClose} className="text-on-surface-variant hover:text-primary transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
              {step === 'upload' && (
                <div className="space-y-8">
                  <div className="text-center space-y-2">
                    <h3 className="font-headline font-bold text-xl text-primary">Upload your data</h3>
                    <p className="text-on-surface-variant text-sm">Upload a CSV, Excel export, or even a plain text list. Our AI will handle the formatting.</p>
                  </div>

                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-outline-variant rounded-sharp p-12 text-center hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group"
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                      className="hidden" 
                      accept=".csv,.txt,.tsv"
                    />
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                        <FileText className="w-8 h-8 text-primary" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-headline font-bold text-primary uppercase tracking-widest text-xs">Click to browse files</p>
                        <p className="text-[10px] font-mono text-slate-400 uppercase">Supports CSV, TSV, TXT</p>
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div className="p-4 bg-tertiary/10 border border-tertiary/20 rounded-sharp flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-tertiary" />
                      <p className="text-sm font-bold text-tertiary">{error}</p>
                    </div>
                  )}

                  <div className="bg-surface-container p-6 rounded-sharp border border-outline-variant">
                    <h4 className="font-headline font-bold text-[11px] uppercase tracking-widest text-primary mb-4">How it works</h4>
                    <ul className="space-y-3">
                      {[
                        "Upload your existing spreadsheet or list.",
                        "Gemini AI analyzes the content and maps it to our system.",
                        "Review the proposed changes in a clear table.",
                        "Confirm to bulk-add everything to your inventory."
                      ].map((text, i) => (
                        <li key={i} className="flex gap-3 text-sm text-on-surface-variant">
                          <span className="font-mono font-bold text-primary">{i + 1}.</span>
                          {text}
                        </li>
                      ))}
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
                    <h3 className="font-headline font-bold text-xl text-primary animate-pulse">AI is analyzing your data...</h3>
                    <p className="text-on-surface-variant text-sm font-mono uppercase tracking-widest">Mapping columns and validating schema</p>
                  </div>
                </div>
              )}

              {step === 'review' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-end">
                    <div>
                      <h3 className="font-headline font-bold text-xl text-primary">Review Proposed Changes</h3>
                      <p className="text-on-surface-variant text-sm">We found {parsedItems.length} items. Please verify before importing.</p>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={reset}
                        className="px-4 py-2 border border-outline-variant text-on-surface-variant font-headline font-bold text-[12px] uppercase tracking-wider rounded-sharp hover:bg-surface-container transition-colors"
                      >
                        Start Over
                      </button>
                    </div>
                  </div>

                  <div className="border border-outline-variant rounded-sharp overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-surface-container border-b border-outline-variant">
                          <th className="px-4 py-3 font-headline text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">SKU</th>
                          <th className="px-4 py-3 font-headline text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Title</th>
                          <th className="px-4 py-3 font-headline text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Category</th>
                          <th className="px-4 py-3 font-headline text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Stock</th>
                          <th className="px-4 py-3 font-headline text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant">
                        {parsedItems.map((item, i) => (
                          <tr key={i} className="hover:bg-surface-container transition-colors">
                            <td className="px-4 py-3 font-mono text-[12px] font-bold">{item.sku}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <span className="font-bold text-[13px] text-primary">{item.title}</span>
                                {item.subtitle && <span className="text-[10px] text-slate-400">{item.subtitle}</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold uppercase rounded-sharp">
                                {item.category}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-[12px]">{item.stockLevel}</td>
                            <td className="px-4 py-3">
                              <span className={cn(
                                "text-[10px] font-bold uppercase tracking-wider",
                                item.status === 'Healthy' ? 'text-secondary' : item.status === 'Low' ? 'text-primary' : 'text-tertiary'
                              )}>
                                {item.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="pt-6 border-t border-outline-variant flex justify-end gap-4">
                    <button
                      onClick={onClose}
                      className="px-6 py-3 text-on-surface-variant font-headline font-bold text-[12px] uppercase tracking-wider hover:bg-surface-container transition-colors rounded-sharp"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleImport}
                      disabled={loading}
                      className="flex items-center gap-2 px-8 py-3 bg-primary text-white font-headline font-bold text-[12px] uppercase tracking-wider hover:bg-primary-container transition-all rounded-sharp shadow-lg disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Importing ({importProgress.current}/{importProgress.total})
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Confirm & Import All
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
                    <h3 className="font-headline font-bold text-2xl text-primary">Import Complete!</h3>
                    <p className="text-on-surface-variant text-sm">Successfully added {parsedItems.length} items to your inventory.</p>
                  </div>
                  <button
                    onClick={onClose}
                    className="px-8 py-3 bg-primary text-white font-headline font-bold text-[12px] uppercase tracking-wider hover:bg-primary-container transition-all rounded-sharp shadow-lg"
                  >
                    Back to Inventory
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
