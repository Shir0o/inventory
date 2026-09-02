import React, { useState, useMemo } from 'react';
import { 
  X, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Trash2, 
  ShieldCheck, 
  RefreshCw, 
  Database,
  Search,
  Check,
  Info,
  Clock,
  CheckCheck,
  Edit3,
  Sliders,
  History
} from 'lucide-react';
import { 
  analyzeInventory, 
  executeInventoryCleanup, 
  CleanupPlan, 
  ReconciliationStrategy 
} from '../services/inventoryCleanupService';
import { useFirebase } from '../context/FirebaseContext';

interface InventoryCleanupModalProps {
  isOpen: boolean;
  onClose: () => void;
  rawInventory: any[];
  rawEvents?: any[];
  rawLogs?: any[];
}

export const InventoryCleanupModal: React.FC<InventoryCleanupModalProps> = ({
  isOpen,
  onClose,
  rawInventory,
  rawEvents,
  rawLogs
}) => {
  const { user, login, events: contextEvents, auditLogs: contextLogs } = useFirebase();
  const effectiveEvents = rawEvents || contextEvents || [];
  const effectiveLogs = rawLogs || contextLogs || [];

  const [strategy, setStrategy] = useState<ReconciliationStrategy>('reconcile_latest');
  const [customCounts, setCustomCounts] = useState<Record<string, number>>({});
  const [editingSku, setEditingSku] = useState<string | null>(null);
  const [tempCountInput, setTempCountInput] = useState<string>('');

  const [filterMode, setFilterMode] = useState<'all' | 'issuesOnly'>('issuesOnly');
  const [searchQuery, setSearchQuery] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<{
    success: boolean;
    mergedCount: number;
    deletedCount: number;
    updatedCount: number;
    reconciledStock: number;
    varianceResolved: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Compute dry-run analysis with current strategy & custom overrides
  const plan: CleanupPlan = useMemo(() => {
    return analyzeInventory(rawInventory, {
      strategy,
      customCounts,
      events: effectiveEvents,
      auditLogs: effectiveLogs
    });
  }, [rawInventory, strategy, customCounts, effectiveEvents, effectiveLogs]);

  if (!isOpen) return null;

  const handleConfirmCleanup = async () => {
    if (!user) {
      setErrorMessage('Please sign in with your Google account (YilongWang05@gmail.com) to execute database modifications.');
      return;
    }
    setIsExecuting(true);
    setErrorMessage(null);
    try {
      const result = await executeInventoryCleanup(plan);
      setExecutionResult(result);
    } catch (err: any) {
      console.error('Cleanup execution error:', err);
      setErrorMessage(err.message || 'Failed to execute database cleanup. Please check permissions.');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSetCustomCount = (sku: string, value: number) => {
    setCustomCounts(prev => ({
      ...prev,
      [sku]: Math.max(0, value)
    }));
  };

  const handleResetCustomCount = (sku: string) => {
    setCustomCounts(prev => {
      const next = { ...prev };
      delete next[sku];
      return next;
    });
  };

  const handleStartEditing = (sku: string, currentVal: number) => {
    setEditingSku(sku);
    setTempCountInput(String(currentVal));
  };

  const handleSaveEditing = (sku: string) => {
    const val = parseInt(tempCountInput, 10);
    if (!isNaN(val) && val >= 0) {
      handleSetCustomCount(sku, val);
    }
    setEditingSku(null);
  };

  const filteredGroups = plan.groups.filter(g => {
    const hasIssue = g.redundantDocCount > 0 || g.reason.includes('Linked') || g.reason.includes('Merged') || g.hasCountVariance;
    if (filterMode === 'issuesOnly' && !hasIssue && plan.hasChanges) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      g.baseName.toLowerCase().includes(q) ||
      g.baseCode.toLowerCase().includes(q) ||
      g.category.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white rounded-xl shadow-2xl border border-[#dcdee3] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#dcdee3] flex items-center justify-between bg-[#fbfbfc]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#e9f1f7] text-[#1f5f8b] flex items-center justify-center flex-none border border-[#1f5f8b]/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[19px] font-bold text-[#191c20] tracking-tight">
                  Inventory Deduplication & Reconcile Count
                </h2>
                <span className="px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider bg-[#f0f4f8] text-[#1f5f8b] rounded-full border border-[#1f5f8b]/20">
                  Interactive Reconcile Preview
                </span>
              </div>
              <p className="text-[13px] text-[#6c6f77] mt-0.5">
                Consolidate duplicate records and update stock to the latest, most accurate count.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#8b8e96] hover:text-[#191c20] hover:bg-[#eef0f3] rounded-lg transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[#f8f9fa]/50">
          
          {executionResult ? (
            /* Success View */
            <div className="py-10 px-6 text-center space-y-4 max-w-md mx-auto">
              <div className="w-16 h-16 rounded-full bg-[#e6f4ea] text-[#137333] flex items-center justify-center mx-auto border border-[#c6ecd0]">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h3 className="text-[20px] font-bold text-[#191c20]">
                Inventory Reconciled & Merged Successfully!
              </h3>
              <p className="text-[13.5px] text-[#44474e] leading-relaxed">
                Database deduplication and count reconciliation completed. Duplicate documents have been removed and stock updated to the latest accurate counts.
              </p>
              
              <div className="p-4 bg-white border border-[#dcdee3] rounded-lg text-left text-[13px] space-y-2 text-[#44474e] shadow-xs">
                <div className="flex justify-between">
                  <span className="text-[#6c6f77]">Duplicate documents removed:</span>
                  <span className="font-bold text-[#b3261e]">−{executionResult.deletedCount} docs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6c6f77]">Canonical records updated:</span>
                  <span className="font-bold text-[#1f5f8b]">{executionResult.updatedCount} records</span>
                </div>
                {executionResult.varianceResolved > 0 && (
                  <div className="flex justify-between text-[#137333] font-medium">
                    <span>Duplicate overcount inflation prevented:</span>
                    <span>−{executionResult.varianceResolved.toLocaleString()} units</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-[#eef0f3] pt-2">
                  <span className="text-[#6c6f77]">Final Reconciled Stock:</span>
                  <span className="font-bold text-[#137333]">{executionResult.reconciledStock.toLocaleString()} units</span>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full py-2.5 bg-[#1f5f8b] hover:bg-[#17496c] text-white font-semibold text-[13.5px] rounded-lg transition-colors cursor-pointer shadow-xs"
              >
                Return to Inventory
              </button>
            </div>
          ) : (
            /* Normal Interactive Reconciliation View */
            <>
              {/* Reconciliation Mode Strategy Selector */}
              <div className="p-4 bg-white border border-[#dcdee3] rounded-xl shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-[#1f5f8b]" />
                    <span className="text-[13px] font-bold text-[#191c20] uppercase tracking-wider">
                      Count Reconciliation Strategy
                    </span>
                  </div>
                  <span className="text-[11.5px] text-[#6c6f77]">
                    Choose how duplicate counts are resolved
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Strategy Option 1: Reconcile to Latest (Recommended) */}
                  <button
                    type="button"
                    onClick={() => setStrategy('reconcile_latest')}
                    className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      strategy === 'reconcile_latest'
                        ? 'border-[#1f5f8b] bg-[#f0f7fc] ring-1 ring-[#1f5f8b]'
                        : 'border-[#dcdee3] bg-white hover:bg-[#fafafa]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Clock className={`w-4 h-4 ${strategy === 'reconcile_latest' ? 'text-[#1f5f8b]' : 'text-[#6c6f77]'}`} />
                        <span className="font-bold text-[13.5px] text-[#191c20]">
                          Reconcile Count (Latest Most Accurate)
                        </span>
                      </div>
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-[#e6f4ea] text-[#137333] border border-[#c6ecd0]">
                        Recommended
                      </span>
                    </div>
                    <p className="text-[12px] text-[#6c6f77] mt-1.5 leading-relaxed">
                      Updates stock to the latest verified record among duplicates, avoiding duplicate double-counting from re-imports or multiple entries.
                    </p>
                  </button>

                  {/* Strategy Option 2: Consolidate Sum */}
                  <button
                    type="button"
                    onClick={() => setStrategy('sum_all')}
                    className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      strategy === 'sum_all'
                        ? 'border-[#1f5f8b] bg-[#f0f7fc] ring-1 ring-[#1f5f8b]'
                        : 'border-[#dcdee3] bg-white hover:bg-[#fafafa]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Database className={`w-4 h-4 ${strategy === 'sum_all' ? 'text-[#1f5f8b]' : 'text-[#6c6f77]'}`} />
                        <span className="font-bold text-[13.5px] text-[#191c20]">
                          Consolidate Sum (Combine Quantities)
                        </span>
                      </div>
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-[#f4edf7] text-[#7a4a8b] border border-[#d6b7e0]">
                        Sum All
                      </span>
                    </div>
                    <p className="text-[12px] text-[#6c6f77] mt-1.5 leading-relaxed">
                      Sums the stock quantities of all duplicate records together. Best if separate documents represented distinct physical inventory boxes.
                    </p>
                  </button>
                </div>
              </div>

              {/* Summary Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-white border border-[#dcdee3] rounded-lg shadow-xs">
                  <div className="text-[11px] font-bold text-[#6c6f77] uppercase tracking-wider">
                    Total Database Docs
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-[20px] font-bold text-[#191c20] tabular-nums">
                      {plan.totalDocsBefore}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#8b8e96]" />
                    <span className="text-[20px] font-bold text-[#1f5f8b] tabular-nums">
                      {plan.totalDocsAfter}
                    </span>
                  </div>
                  <div className="text-[11.5px] text-[#8b8e96] mt-0.5">
                    {plan.docsToDelete.length > 0 ? `−${plan.docsToDelete.length} redundant docs` : 'No excess docs'}
                  </div>
                </div>

                <div className="p-3.5 bg-white border border-[#dcdee3] rounded-lg shadow-xs">
                  <div className="text-[11px] font-bold text-[#6c6f77] uppercase tracking-wider">
                    Duplicates to Merge
                  </div>
                  <div className="mt-1 text-[20px] font-bold text-[#b3261e] tabular-nums">
                    {plan.duplicateDocsCount}
                  </div>
                  <div className="text-[11.5px] text-[#8b8e96] mt-0.5">
                    Across {plan.duplicateGroupsCount} title groups
                  </div>
                </div>

                <div className="p-3.5 bg-white border border-[#dcdee3] rounded-lg shadow-xs">
                  <div className="text-[11px] font-bold text-[#6c6f77] uppercase tracking-wider">
                    Reconciled Total Stock
                  </div>
                  <div className="mt-1 text-[20px] font-bold text-[#1f5f8b] tabular-nums">
                    {plan.totalStockAfter.toLocaleString()}
                  </div>
                  <div className="text-[11.5px] text-[#6c6f77] mt-0.5">
                    {strategy === 'reconcile_latest' ? 'Latest verified counts' : 'Consolidated sum'}
                  </div>
                </div>

                <div className="p-3.5 bg-white border border-[#c6ecd0] rounded-lg bg-[#f9fdfa] shadow-xs">
                  <div className="text-[11px] font-bold text-[#137333] uppercase tracking-wider">
                    Accuracy & Variance
                  </div>
                  <div className="mt-1 text-[20px] font-bold text-[#137333] tabular-nums">
                    {strategy === 'reconcile_latest' && plan.totalVarianceResolved > 0 
                      ? `−${plan.totalVarianceResolved.toLocaleString()}` 
                      : 'Verified'}
                  </div>
                  <div className="text-[11.5px] text-[#137333] mt-0.5 flex items-center gap-1 font-medium">
                    <CheckCheck className="w-3.5 h-3.5" />
                    {strategy === 'reconcile_latest' && plan.totalVarianceResolved > 0 
                      ? 'Overcount inflation prevented' 
                      : 'Stock accuracy synchronized'}
                  </div>
                </div>
              </div>

              {!user && (
                <div className="p-4 bg-[#fef7e0] border border-[#f5e08b] rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[#7a5900] text-[13px]">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="w-5 h-5 flex-none text-[#b06000]" />
                    <span>You are not signed in. Sign in with your authorized admin Google account to apply changes to Firestore.</span>
                  </div>
                  <button
                    type="button"
                    onClick={login}
                    className="px-3.5 py-1.5 bg-[#1f5f8b] hover:bg-[#17496c] text-white font-semibold text-xs rounded-md transition-colors cursor-pointer flex-none self-start sm:self-auto"
                  >
                    Sign In with Google
                  </button>
                </div>
              )}

              {errorMessage && (
                <div className="p-4 bg-[#fdeceb] border border-[#f4cfcd] rounded-lg flex items-start gap-3 text-[#b3261e] text-[13px]">
                  <AlertTriangle className="w-5 h-5 flex-none mt-0.5" />
                  <div>
                    <span className="font-bold">Error applying cleanup: </span>
                    {errorMessage}
                  </div>
                </div>
              )}

              {/* Filtering and Search Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFilterMode('issuesOnly')}
                    className={`px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors cursor-pointer ${
                      filterMode === 'issuesOnly'
                        ? 'bg-[#1f5f8b] text-white'
                        : 'bg-white text-[#44474e] border border-[#c9cbd2] hover:bg-[#f6f7f9]'
                    }`}
                  >
                    Actionable / Duplicate Groups ({plan.groups.filter(g => g.redundantDocCount > 0 || g.reason.includes('Linked') || g.hasCountVariance).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode('all')}
                    className={`px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors cursor-pointer ${
                      filterMode === 'all'
                        ? 'bg-[#1f5f8b] text-white'
                        : 'bg-white text-[#44474e] border border-[#c9cbd2] hover:bg-[#f6f7f9]'
                    }`}
                  >
                    All Groups ({plan.groups.length})
                  </button>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8b8e96]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search titles or codes..."
                    className="w-full pl-9 pr-3 py-1.5 border border-[#c9cbd2] rounded-md text-[12.5px] bg-white text-[#191c20] focus:border-[#1f5f8b] outline-none"
                  />
                </div>
              </div>

              {/* Grouped Breakdown List */}
              <div className="space-y-4">
                {filteredGroups.length === 0 ? (
                  <div className="p-8 text-center bg-white border border-[#dcdee3] rounded-lg text-[#6c6f77]">
                    <CheckCircle2 className="w-8 h-8 text-[#137333] mx-auto mb-2" />
                    <p className="font-semibold text-[14px] text-[#191c20]">
                      {filterMode === 'issuesOnly' 
                        ? 'No duplicate issues in this view!' 
                        : 'No matching titles found.'}
                    </p>
                    <p className="text-[12.5px] mt-0.5">
                      {filterMode === 'issuesOnly' 
                        ? 'Click "All Groups" above to inspect all catalog titles.' 
                        : 'Try searching for a different keyword.'}
                    </p>
                  </div>
                ) : (
                  filteredGroups.map(group => (
                    <div 
                      key={group.id} 
                      className="p-4 bg-white border border-[#dcdee3] rounded-xl shadow-xs space-y-3.5"
                    >
                      {/* Group Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f0f2f5] pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-xs bg-[#eef0f3] text-[#44474e]">
                            {group.category}
                          </span>
                          <span className="font-bold text-[15px] text-[#191c20]">
                            {group.baseName}
                          </span>
                          <span className="font-mono text-[11px] text-[#8b8e96] bg-[#f6f7f9] px-1.5 py-0.5 rounded border border-[#e8eaed]">
                            {group.baseCode}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {group.redundantDocCount > 0 ? (
                            <span className="text-[11px] font-semibold text-[#b3261e] bg-[#fdeceb] border border-[#f4cfcd] px-2.5 py-0.5 rounded-full flex items-center gap-1">
                              <Trash2 className="w-3 h-3" />
                              {group.redundantDocCount} duplicate doc(s) to remove
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-[#137333] bg-[#e6f4ea] border border-[#c6ecd0] px-2.5 py-0.5 rounded-full flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              Standardized Title
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Editions Breakdown */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {group.editions.map(ed => {
                          const isEditing = editingSku === ed.canonicalSku;
                          const hasCustom = customCounts[ed.canonicalSku] !== undefined;

                          return (
                            <div 
                              key={ed.lang} 
                              className={`p-3.5 rounded-lg border space-y-3 text-[12.5px] transition-all ${
                                ed.hasDuplicates 
                                  ? 'bg-[#fcfdfd] border-[#d8e0ea] ring-1 ring-[#1f5f8b]/10' 
                                  : 'bg-[#fafbfc] border-[#e8ebf0]'
                              }`}
                            >
                              {/* Edition title and canonical SKU */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-xs ${
                                    ed.lang === 'EN' ? 'text-[#1f5f8b] bg-[#e9f1f7]' : 'text-[#7a4a8b] bg-[#f4edf7]'
                                  }`}>
                                    {ed.lang}
                                  </span>
                                  <span className="font-semibold text-[#191c20] truncate max-w-[200px]" title={ed.title}>
                                    {ed.title}
                                  </span>
                                </div>
                                <span className="font-mono text-[11px] text-[#6c6f77] bg-white px-1.5 py-0.5 rounded border border-[#e3e6eb]">
                                  {ed.canonicalSku}
                                </span>
                              </div>

                              {/* Reconcile Count Action Bar */}
                              {ed.hasDuplicates ? (
                                <div className="p-2.5 rounded-lg bg-white border border-[#c6d7e6] space-y-2">
                                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#1f5f8b]">
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3.5 h-3.5" /> Reconciled Stock Count:
                                    </span>
                                    <span className="text-[13.5px] font-mono text-[#191c20]">
                                      {ed.stockLevel} units
                                    </span>
                                  </div>

                                  {/* Quick selection pills */}
                                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => handleSetCustomCount(ed.canonicalSku, ed.latestStock)}
                                      className={`px-2 py-1 rounded text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1 ${
                                        ed.stockLevel === ed.latestStock && !hasCustom
                                          ? 'bg-[#1f5f8b] text-white shadow-xs'
                                          : 'bg-[#f0f4f8] text-[#1f5f8b] hover:bg-[#e1eaf2] border border-[#c6d7e6]'
                                      }`}
                                      title="Set to latest verified count"
                                    >
                                      <Clock className="w-3 h-3" />
                                      Latest: {ed.latestStock}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleSetCustomCount(ed.canonicalSku, ed.sumStock)}
                                      className={`px-2 py-1 rounded text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1 ${
                                        ed.stockLevel === ed.sumStock && !hasCustom
                                          ? 'bg-[#1f5f8b] text-white shadow-xs'
                                          : 'bg-[#f0f4f8] text-[#1f5f8b] hover:bg-[#e1eaf2] border border-[#c6d7e6]'
                                      }`}
                                      title="Combine stock quantities from all duplicate documents"
                                    >
                                      <Database className="w-3 h-3" />
                                      Sum: {ed.sumStock}
                                    </button>

                                    {isEditing ? (
                                      <div className="flex items-center gap-1 ml-auto">
                                        <input
                                          type="number"
                                          min="0"
                                          value={tempCountInput}
                                          onChange={(e) => setTempCountInput(e.target.value)}
                                          className="w-16 px-1.5 py-0.5 text-[11.5px] border border-[#1f5f8b] rounded text-[#191c20] outline-none"
                                          autoFocus
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleSaveEditing(ed.canonicalSku)}
                                          className="px-2 py-0.5 bg-[#137333] text-white text-[11px] font-bold rounded cursor-pointer"
                                        >
                                          Save
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setEditingSku(null)}
                                          className="px-1.5 py-0.5 text-[#6c6f77] text-[11px] hover:text-[#191c20] cursor-pointer"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleStartEditing(ed.canonicalSku, ed.stockLevel)}
                                        className="px-2 py-1 rounded text-[11px] font-medium text-[#44474e] bg-[#f6f7f9] hover:bg-[#eef0f3] border border-[#dcdee3] transition-all cursor-pointer flex items-center gap-1 ml-auto"
                                        title="Manually enter a physical count"
                                      >
                                        <Edit3 className="w-3 h-3 text-[#6c6f77]" />
                                        Custom
                                      </button>
                                    )}

                                    {hasCustom && (
                                      <button
                                        type="button"
                                        onClick={() => handleResetCustomCount(ed.canonicalSku)}
                                        className="text-[10px] text-[#b3261e] hover:underline cursor-pointer ml-1"
                                      >
                                        Reset to Auto
                                      </button>
                                    )}
                                  </div>

                                  {/* Overcount resolution notice */}
                                  {ed.countVariance > 0 && ed.stockLevel === ed.latestStock && (
                                    <div className="text-[11px] text-[#137333] flex items-center gap-1 bg-[#e6f4ea] px-2 py-1 rounded border border-[#c6ecd0]">
                                      <CheckCheck className="w-3.5 h-3.5 flex-none" />
                                      <span>Updated to latest count (prevented +{ed.countVariance} duplicate units).</span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center justify-between text-[11.5px] text-[#6c6f77] py-1 border-t border-[#f0f2f5]">
                                  <span>Current Stock:</span>
                                  <span className="font-bold text-[#191c20] font-mono text-[13px]">
                                    {ed.stockLevel} units
                                  </span>
                                </div>
                              )}

                              {/* Recent physical event or audit log hint if available */}
                              {ed.recentEventCount && (
                                <div className="text-[11px] text-[#1f5f8b] bg-[#eef4f9] px-2 py-1 rounded flex items-center gap-1.5 border border-[#d2e2ef]">
                                  <History className="w-3.5 h-3.5 flex-none" />
                                  <span>Verified in {ed.recentEventCount.eventName} ({ed.recentEventCount.date}): {ed.recentEventCount.count} units</span>
                                </div>
                              )}

                              {/* Source documents list */}
                              <div className="space-y-1.5 pt-1 border-t border-[#f0f2f5]">
                                <div className="text-[11px] font-semibold text-[#6c6f77] flex items-center justify-between">
                                  <span>Source Database Documents ({ed.sourceDocs.length}):</span>
                                </div>
                                <div className="space-y-1">
                                  {ed.sourceDocs.map(sd => (
                                    <div 
                                      key={sd.id}
                                      className={`px-2.5 py-1.5 rounded text-[11px] flex flex-col sm:flex-row sm:items-center justify-between gap-1 font-mono ${
                                        sd.isRedundant 
                                          ? 'bg-[#fff5f5] text-[#8e2823] border border-[#fad2d2]' 
                                          : 'bg-white text-[#191c20] border border-[#c6d7e6] shadow-xs'
                                      }`}
                                    >
                                      <div className="flex items-center gap-1.5 truncate">
                                        {sd.isLatest ? (
                                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-[#e6f4ea] text-[#137333] border border-[#c6ecd0]">
                                            Latest Record
                                          </span>
                                        ) : (
                                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-[#fdeceb] text-[#b3261e] border border-[#f4cfcd]">
                                            Duplicate
                                          </span>
                                        )}
                                        <span className="truncate max-w-[170px]" title={`ID: ${sd.id} | SKU: ${sd.sku}`}>
                                          doc: {sd.id.slice(0, 8)}... ({sd.sku})
                                        </span>
                                      </div>
                                      
                                      <div className="flex items-center gap-2 flex-none self-end sm:self-auto">
                                        <span className="text-[10px] text-[#6c6f77]" title={sd.updatedAtFormatted}>
                                          {sd.updatedAtFormatted}
                                        </span>
                                        <span className={`font-bold tabular-nums text-[11.5px] ${
                                          sd.isRedundant ? 'line-through text-[#b3261e]' : 'text-[#191c20]'
                                        }`}>
                                          {sd.stockLevel} units
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Reason text */}
                      <div className="text-[11.5px] text-[#6c6f77] flex items-center gap-1.5 pt-0.5">
                        <Info className="w-3.5 h-3.5 text-[#8b8e96] flex-none" />
                        <span>{group.reason}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

        </div>

        {/* Footer Actions */}
        {!executionResult && (
          <div className="px-6 py-4 border-t border-[#dcdee3] bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-[12px] text-[#6c6f77] flex items-center gap-1.5">
              <Database className="w-4 h-4 text-[#8b8e96]" />
              <span>
                {plan.hasChanges 
                  ? `${plan.docsToDelete.length} redundant documents will be cleaned, ${plan.docsToUpdate.length} documents updated to reconciled count.`
                  : 'Your inventory is already completely deduplicated and clean.'
                }
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isExecuting}
                className="px-4 py-2 border border-[#c9cbd2] bg-white hover:bg-[#f6f7f9] text-[#44474e] font-semibold text-[13px] rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCleanup}
                disabled={isExecuting || !plan.hasChanges}
                className={`px-5 py-2 font-semibold text-[13px] rounded-lg transition-all flex items-center gap-2 shadow-xs cursor-pointer ${
                  !plan.hasChanges 
                    ? 'bg-[#eef0f3] text-[#a8abb3] cursor-not-allowed border border-[#dcdee3]' 
                    : isExecuting
                      ? 'bg-[#1f5f8b]/70 text-white cursor-wait'
                      : 'bg-[#1f5f8b] hover:bg-[#17496c] text-white'
                }`}
              >
                {isExecuting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Applying Reconciled Count...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Confirm & Apply Reconciled Count</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
