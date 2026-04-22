import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  ArrowUpRight, 
  TrendingUp,
  Package,
  Calendar,
  Info
} from 'lucide-react';
import { motion } from 'motion/react';
import { getInventoryPredictions, InventoryNeed } from '../services/geminiService';
import { cn } from '../lib/utils';

interface AIInsightsViewProps {
  inventory: any[];
  events: any[];
  auditLogs: any[];
}

const AIInsightsView = ({ inventory, events, auditLogs }: AIInsightsViewProps) => {
  const [predictions, setPredictions] = useState<InventoryNeed[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPredictions = async () => {
    if (!process.env.GEMINI_API_KEY) {
      setError("Gemini API Key is missing. Please configure it in the settings to enable AI Insights.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await getInventoryPredictions(inventory, events, auditLogs);
      setPredictions(result);
    } catch (err) {
      setError("Failed to generate AI insights. Please check your connection and try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (inventory.length > 0) {
      fetchPredictions();
    }
  }, [inventory.length]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'text-tertiary bg-tertiary/10 border-tertiary/20';
      case 'Medium': return 'text-secondary bg-secondary/10 border-secondary/20';
      case 'Low': return 'text-primary bg-primary/10 border-primary/20';
      default: return 'text-slate-500 bg-slate-100 border-slate-200';
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-headline font-bold text-2xl tracking-tight text-primary flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-secondary" />
            AI PREDICTIVE REPLENISHMENT
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Gemini-powered analysis of distribution trends and upcoming event needs.
          </p>
        </div>
        <button 
          onClick={fetchPredictions}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white font-headline font-bold text-xs rounded-sharp hover:bg-primary/90 transition-all disabled:opacity-50"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          REFRESH ANALYSIS
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-surface border border-outline-variant rounded-sharp space-y-4">
          <div className="relative">
            <Sparkles className="w-12 h-12 text-secondary animate-pulse" />
            <div className="absolute inset-0 w-12 h-12 bg-secondary/20 rounded-full animate-ping" />
          </div>
          <div className="text-center">
            <p className="font-headline font-bold text-primary">Analyzing Inventory Trends...</p>
            <p className="text-slate-500 text-xs mt-1">Consulting Gemini for predictive insights</p>
          </div>
        </div>
      ) : error ? (
        <div className="p-8 bg-tertiary/5 border border-tertiary/20 rounded-sharp flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-tertiary shrink-0" />
          <div>
            <p className="font-headline font-bold text-tertiary">Analysis Error</p>
            <p className="text-slate-600 text-sm mt-1">{error}</p>
          </div>
        </div>
      ) : predictions.length === 0 ? (
        <div className="p-12 bg-surface border border-outline-variant rounded-sharp text-center">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="font-headline font-bold text-primary">No Procurement Recommendations</p>
          <p className="text-slate-500 text-sm mt-1">Your current stock levels appear healthy for upcoming events.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {predictions.map((prediction, idx) => (
            <motion.div 
              key={prediction.itemId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-surface border border-outline-variant rounded-sharp overflow-hidden flex flex-col"
            >
              <div className="p-6 flex-1">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <span className={cn(
                      "text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider",
                      getPriorityColor(prediction.priority)
                    )}>
                      {prediction.priority} Priority
                    </span>
                    <h3 className="font-headline font-bold text-lg text-primary mt-2">{prediction.title}</h3>
                    <p className="text-slate-400 font-mono text-[11px]">{prediction.sku}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-mono font-bold text-primary">{prediction.predictedNeed}</div>
                    <div className="text-[10px] font-headline font-bold text-slate-400 uppercase tracking-widest">Predicted Need</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-3 bg-surface-container rounded-sharp border border-outline-variant">
                    <div className="text-slate-500 text-[10px] font-headline font-bold uppercase tracking-widest mb-1">Current Stock</div>
                    <div className="text-lg font-mono font-bold text-primary">{prediction.currentStock}</div>
                  </div>
                  <div className="p-3 bg-surface-container rounded-sharp border border-outline-variant">
                    <div className="text-slate-500 text-[10px] font-headline font-bold uppercase tracking-widest mb-1">Confidence</div>
                    <div className="text-lg font-mono font-bold text-secondary">{(prediction.confidence * 100).toFixed(0)}%</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-slate-600 text-sm leading-relaxed italic">
                      "{prediction.reasoning}"
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-surface-container-low border-t border-outline-variant flex items-center justify-between">
                <div className="flex items-center gap-2 text-secondary">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-[11px] font-headline font-bold uppercase tracking-wider">AI Recommendation</span>
                </div>
                <button className="flex items-center gap-2 text-primary font-headline font-bold text-xs hover:underline">
                  VIEW ITEM DETAILS
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <div className="p-6 bg-primary/5 border border-primary/10 rounded-sharp">
        <h4 className="font-headline font-bold text-primary text-sm flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-secondary" />
          How it works
        </h4>
        <p className="text-slate-600 text-xs leading-relaxed">
          Our AI model analyzes your historical distribution logs, current stock levels, and upcoming event schedules to identify items at risk of stockouts. 
          It looks for patterns in distribution volume and frequency to provide data-driven procurement targets for the next 30 days.
        </p>
      </div>
    </div>
  );
};

export default AIInsightsView;
