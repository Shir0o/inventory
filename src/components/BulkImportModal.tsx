import React, { useState, useRef } from 'react';
import { X, Upload, FileText, Check, AlertCircle, Loader2, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import { parseInventoryData, parseEventData, ParsedInventoryItem, ParsedEvent } from '../services/aiService';
import { addInventoryItem, importEventWithMaterials, subscribeToSettings, getInventoryItemBySku } from '../services/firestoreService';
import { cn } from '../lib/utils';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: 'inventory' | 'events';
  isAdmin?: boolean;
}

const BulkImportModal = ({ isOpen, onClose, initialType = 'inventory', isAdmin = false }: BulkImportModalProps) => {
  const [step, setStep] = useState<'upload' | 'parsing' | 'review' | 'success'>('upload');
  const [importType, setImportType] = useState<'inventory' | 'events'>(initialType);
  const [rawData, setRawData] = useState('');
  const [parsedItems, setParsedItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [settings, setSettings] = useState<any>({});
  const [existingSkus, setExistingSkus] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Subscribe to settings for dynamic categories
  React.useEffect(() => {
    return subscribeToSettings((data) => {
      setSettings(data);
    });
  }, []);

  const categories = settings.categories || ['Bibles', 'Tracts', 'Booklets'];

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
    setExistingSkus(new Set());
    try {
      let items: any[] = [];
      if (importType === 'inventory') {
        items = await parseInventoryData(content, categories);
        
        // Check which SKUs already exist in the database
        const skuSet = new Set<string>();
        for (const item of items) {
          const existing = await getInventoryItemBySku(item.sku);
          if (existing) {
            skuSet.add(item.sku);
          }
        }
        setExistingSkus(skuSet);
      } else {
        items = await parseEventData(content);
        
        // Validate all SKUs found in event materials
        const skuSet = new Set<string>();
        const bulkSkus = ['GENERAL', 'BIBLES', 'TRACTS', 'BOOKLETS'];
        for (const item of items) {
          for (const m of item.materials) {
            if (bulkSkus.includes(m.sku)) continue;
            const existing = await getInventoryItemBySku(m.sku);
            if (existing) {
              skuSet.add(m.sku);
            }
          }
        }
        setExistingSkus(skuSet);
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
    if (!isAdmin) {
      alert("Only administrators can perform bulk imports.");
      return;
    }
    // Prevent import if there are existing SKUs
    if (importType === 'inventory' && hasValidationErrors) {
      setError("Please resolve all SKU conflicts before importing.");
      return;
    }

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

  const updateParsedItem = async (index: number, field: string, value: any) => {
    const newItems = [...parsedItems];
    let updatedItem = { ...newItems[index], [field]: value };

    // Auto-update SKU based on language extension rules
    if (field === 'language' && importType === 'inventory') {
      const lang = value.trim().toLowerCase();
      let currentSku = updatedItem.sku || '';
      
      // Clean existing extensions if they match our pattern
      if (currentSku.endsWith('-001') || currentSku.endsWith('-002')) {
        currentSku = currentSku.slice(0, -4);
      }

      if (lang === 'english') {
        updatedItem.sku = `${currentSku}-001`;
      } else if (lang === 'spanish') {
        updatedItem.sku = `${currentSku}-002`;
      }
    }

    newItems[index] = updatedItem;
    setParsedItems(newItems);

    if (importType === 'inventory' && (field === 'sku' || field === 'language')) {
      const skuToCheck = updatedItem.sku;
      const existing = await getInventoryItemBySku(skuToCheck);
      setExistingSkus(prev => {
        const next = new Set(prev);
        if (existing) next.add(skuToCheck);
        else next.delete(skuToCheck);
        return next;
      });
    }

    // For events, if materials change, validate the new SKUs
    if (importType === 'events' && field === 'materials') {
      const bulkSkus = ['GENERAL', 'BIBLES', 'TRACTS', 'BOOKLETS'];
      for (const m of updatedItem.materials) {
        if (bulkSkus.includes(m.sku)) continue;
        const existing = await getInventoryItemBySku(m.sku);
        setExistingSkus(prev => {
          const next = new Set(prev);
          if (existing) next.add(m.sku);
          else next.delete(m.sku);
          return next;
        });
      }
    }
  };

  const bulkSetLanguage = async (language: string) => {
    const langKey = language.toLowerCase();
    const newItems = parsedItems.map(item => {
      let currentSku = item.sku || '';
      
      // Clean existing extensions if they match our pattern
      if (currentSku.endsWith('-001') || currentSku.endsWith('-002')) {
        currentSku = currentSku.slice(0, -4);
      }

      let newSku = currentSku;
      if (langKey === 'english') newSku = `${currentSku}-001`;
      else if (langKey === 'spanish') newSku = `${currentSku}-002`;

      return { ...item, language, sku: newSku };
    });

    setParsedItems(newItems);

    // Refresh existing SKU check for the entire batch
    const newExistingSet = new Set<string>();
    for (const item of newItems) {
      const existing = await getInventoryItemBySku(item.sku);
      if (existing) {
        newExistingSet.add(item.sku);
      }
    }
    setExistingSkus(newExistingSet);
  };

  const stringifyMaterials = (materials: any[]) => {
    if (!materials || !materials.length) return '';
    return materials.map(m => `${m.sku}:${m.quantity}`).join(', ');
  };

  const parseMaterials = (str: string) => {
    const parts = str.split(',').map(p => p.trim()).filter(Boolean);
    return parts.map(p => {
      // 1. Precise Match (SKU:QTY)
      if (p.includes(':')) {
        const [sku, qty] = p.split(':');
        const s = sku.trim().toUpperCase();
        const q = parseInt(qty) || 0;
        
        // Map common names to categorical SKUs
        if (s.includes('SPANISH BIBLE') || s.includes('BIBLIA')) return { sku: 'BIBLES_ES', quantity: q, title: 'Spanish Bible' };
        if (s.includes('ENGLISH BIBLE')) return { sku: 'BIBLES_EN', quantity: q, title: 'English Bible' };
        if (s.includes('BIBLE')) return { sku: 'BIBLES', quantity: q, title: 'Bible' };
        
        if (s.includes('SPANISH TRACT')) return { sku: 'TRACTS_ES', quantity: q, title: 'Spanish Tracts' };
        if (s.includes('ENGLISH TRACT')) return { sku: 'TRACTS_EN', quantity: q, title: 'English Tracts' };
        if (s.includes('TRACT')) return { sku: 'TRACTS', quantity: q, title: 'Total Tracts' };
        
        if (s.includes('SPANISH BOOKLET') || s.includes('SPANISH BASIC ELEMENTS') || s.includes('ELEMENTOS BASICOS') || s.includes('ELEMENTOS BÁSICOS')) {
          return { sku: 'BOOKLETS_ES', quantity: q, title: 'Elementos básicos de la vida cristiana, tomo 1' };
        }
        if (s.includes('ENGLISH BOOKLET') || s.includes('ENGLISH BASIC ELEMENTS')) {
          return { sku: 'BOOKLETS_EN', quantity: q, title: 'Basic Elements of the Christian Life, vol. 1' };
        }
        if (s.includes('BOOKLET') || s.includes('BASIC ELEMENTS')) {
          return { sku: 'BOOKLETS', quantity: q, title: 'Basic Elements of the Christian Life, vol. 1' };
        }
        
        return { sku: s, quantity: q };
      }
      
      // 2. Natural Language Fallback (e.g., "50 Bibles")
      const lower = p.toLowerCase();
      const qtyMatch = p.match(/\d+/);
      const qty = qtyMatch ? parseInt(qtyMatch[0]) : 1;

      if (lower.includes('spanish bible') || lower.includes('biblia')) return { sku: 'BIBLES_ES', quantity: qty, title: 'Spanish Bible' };
      if (lower.includes('english bible')) return { sku: 'BIBLES_EN', quantity: qty, title: 'English Bible' };
      if (lower.includes('bible')) return { sku: 'BIBLES', quantity: qty, title: 'Bible' };
      
      if (lower.includes('spanish tract')) return { sku: 'TRACTS_ES', quantity: qty, title: 'Spanish Tracts' };
      if (lower.includes('english tract')) return { sku: 'TRACTS_EN', quantity: qty, title: 'English Tracts' };
      if (lower.includes('tract')) return { sku: 'TRACTS', quantity: qty, title: 'Total Tracts' };
      
      if (lower.includes('spanish booklet') || lower.includes('spanish basic elements') || lower.includes('elementos basicos') || lower.includes('elementos básicos')) {
        return { sku: 'BOOKLETS_ES', quantity: qty, title: 'Elementos básicos de la vida cristiana, tomo 1' };
      }
      if (lower.includes('english booklet') || lower.includes('english basic elements')) {
        return { sku: 'BOOKLETS_EN', quantity: qty, title: 'Basic Elements of the Christian Life, vol. 1' };
      }
      if (lower.includes('booklet') || lower.includes('basic elements')) {
        return { sku: 'BOOKLETS', quantity: qty, title: 'Basic Elements of the Christian Life, vol. 1' };
      }

      // 3. Simple Number (Total Items)
      if (!isNaN(parseInt(p))) {
        const val = parseInt(p);
        return { sku: 'GENERAL', quantity: val, title: 'Miscellaneous Distribution' };
      }
      
      return { sku: p.toUpperCase(), quantity: 1 };
    });
  };

  const reset = () => {
    setStep('upload');
    setRawData('');
    setParsedItems([]);
    setError(null);
    setExistingSkus(new Set());
    setImportProgress({ current: 0, total: 0 });
    setImportType(initialType);
  };

  // Reset state when modal is opened to allow fresh starts
  React.useEffect(() => {
    if (isOpen) {
      reset();
    }
  }, [isOpen]);

  // UI calculation for duplicates
  const duplicatesInBatch = new Set<string>();
  const conflictingSkusInMatrix = new Set<string>();
  
  if (importType === 'inventory') {
    const seen = new Set<string>();
    parsedItems.forEach(item => {
      if (seen.has(item.sku)) {
        duplicatesInBatch.add(item.sku);
      }
      seen.add(item.sku);
      
      if (existingSkus.has(item.sku)) {
        conflictingSkusInMatrix.add(item.sku);
      }
    });
  }

  const hasValidationErrors = conflictingSkusInMatrix.size > 0 || duplicatesInBatch.size > 0;

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
            className="relative w-full max-w-4xl bg-surface m3-elevated-card rounded-[28px] overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh] border border-outline-variant/40"
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
                    {importType === 'inventory' && hasValidationErrors && (
                      <div className="flex items-center gap-2 bg-tertiary/10 text-tertiary px-3 py-2 rounded-sharp border border-tertiary/20">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-[10px] font-headline font-bold uppercase tracking-wider">Duplicate SKUs Detected</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                      {importType === 'inventory' && (
                        <div className="flex items-center gap-1.5 p-1 bg-surface-container rounded-sharp border border-outline-variant mr-1">
                          <span className="text-[9px] font-headline font-bold uppercase tracking-widest text-on-surface-variant px-1.5">Apply All:</span>
                          <button 
                            onClick={() => bulkSetLanguage('English')}
                            className="px-2 py-1 bg-surface text-primary border border-outline-variant rounded-sharp font-headline font-bold text-[9px] uppercase hover:bg-primary/10 transition-colors"
                          >
                            EN
                          </button>
                          <button 
                            onClick={() => bulkSetLanguage('Spanish')}
                            className="px-2 py-1 bg-surface text-primary border border-outline-variant rounded-sharp font-headline font-bold text-[9px] uppercase hover:bg-primary/10 transition-colors"
                          >
                            ES
                          </button>
                        </div>
                      )}
                      <button 
                        onClick={reset}
                        className="px-3 py-1.5 border border-outline-variant text-on-surface-variant font-headline font-bold text-[10px] sm:text-[11px] uppercase tracking-wider rounded-sharp hover:bg-surface-container transition-colors"
                      >
                        Reset AI
                      </button>
                    </div>
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
                                <th className="px-4 py-3 font-headline text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Lang</th>
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
                          {parsedItems.map((item, i) => {
                            const isExisting = existingSkus.has(item.sku);
                            const isBatchDuplicate = duplicatesInBatch.has(item.sku);
                            const hasError = isExisting || isBatchDuplicate;

                            return (
                              <tr key={i} className={cn(
                                "transition-colors group",
                                hasError ? "bg-tertiary/5" : "hover:bg-surface-container"
                              )}>
                                {importType === 'inventory' ? (
                                  <>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <div className="flex flex-col gap-1">
                                        <input 
                                          type="text"
                                          value={item.sku}
                                          onChange={(e) => updateParsedItem(i, 'sku', e.target.value.toUpperCase())}
                                          className={cn(
                                            "w-24 bg-transparent font-mono text-xs font-bold border-b outline-none px-1 py-0.5 rounded",
                                            hasError ? "border-tertiary text-tertiary" : "border-transparent focus:border-primary focus:bg-surface"
                                          )}
                                        />
                                        {isExisting && <span className="text-[7px] text-tertiary font-bold uppercase tracking-wider">Already in Matrix</span>}
                                        {isBatchDuplicate && <span className="text-[7px] text-tertiary font-bold uppercase tracking-wider">Duplicate in Batch</span>}
                                      </div>
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
                                      value={item.language || 'English'}
                                      onChange={(e) => updateParsedItem(i, 'language', e.target.value)}
                                      className="bg-secondary/10 text-secondary text-[9px] font-bold uppercase rounded-sharp border-none outline-none cursor-pointer hover:bg-secondary/20 p-1"
                                    >
                                      <option value="English">EN</option>
                                      <option value="Spanish">ES</option>
                                    </select>
                                  </td>
                                  <td className="px-4 py-3">
                                    <select 
                                      value={item.category}
                                      onChange={(e) => updateParsedItem(i, 'category', e.target.value)}
                                      className="bg-primary/10 text-primary text-[9px] sm:text-[10px] font-bold uppercase rounded-sharp border-none outline-none cursor-pointer hover:bg-primary/20 p-1"
                                    >
                                      {categories.map((cat: string) => (
                                        <option key={cat} value={cat}>{cat}</option>
                                      ))}
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
                                    <div className="flex flex-col gap-1">
                                      <input 
                                        type="text"
                                        defaultValue={stringifyMaterials(item.materials)}
                                        onBlur={(e) => updateParsedItem(i, 'materials', parseMaterials(e.target.value))}
                                        className={cn(
                                          "w-full bg-transparent font-mono text-[10px] border-b outline-none focus:bg-surface px-1 py-0.5 rounded",
                                          item.materials.some((m: any) => !['GENERAL', 'BIBLES', 'TRACTS', 'BOOKLETS'].includes(m.sku) && !existingSkus.has(m.sku)) 
                                            ? "border-tertiary text-tertiary" 
                                            : "text-on-surface-variant border-transparent focus:border-primary"
                                        )}
                                        placeholder="SKU:QTY or Total"
                                      />
                                      {item.materials.some((m: any) => !['GENERAL', 'BIBLES', 'TRACTS', 'BOOKLETS'].includes(m.sku) && !existingSkus.has(m.sku)) && (
                                        <span className="text-[7px] text-tertiary font-bold uppercase tracking-wider">
                                          Unknown SKUs: {item.materials.filter((m: any) => !['GENERAL', 'BIBLES', 'TRACTS', 'BOOKLETS'].includes(m.sku) && !existingSkus.has(m.sku)).map((m: any) => m.sku).join(', ')}
                                        </span>
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
                          );
                        })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-outline-variant flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4 shrink-0">
                    <button
                      onClick={onClose}
                      className="px-6 py-3 text-on-surface-variant font-headline font-bold text-[11px] uppercase tracking-wider hover:bg-surface-container transition-colors rounded-sharp text-center"
                    >
                      {isAdmin ? 'Cancel' : 'Close'}
                    </button>
                    {isAdmin && (
                      <button
                        onClick={handleImport}
                        disabled={loading}
                        className="flex items-center justify-center gap-2 px-8 py-3 bg-primary text-white font-headline font-bold text-[11px] uppercase tracking-wider hover:bg-primary/90 transition-all rounded-sharp shadow-lg disabled:opacity-50"
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
                    )}
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
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={onClose}
                      className="px-8 py-3 border border-outline-variant text-on-surface-variant font-headline font-bold text-[12px] uppercase tracking-wider hover:bg-surface-container transition-all rounded-sharp shadow-lg"
                    >
                      Finish & Close
                    </button>
                    <button
                      onClick={reset}
                      className="px-8 py-3 bg-primary text-white font-headline font-bold text-[12px] uppercase tracking-wider hover:bg-primary/90 transition-all rounded-sharp shadow-lg flex items-center justify-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      Import Another Batch
                    </button>
                  </div>
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
