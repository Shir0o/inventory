import React, { useEffect, useRef, useState } from 'react';
import { X, Camera, Keyboard, Search, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
}

const QRScannerModal = ({ isOpen, onClose, onScanSuccess }: QRScannerModalProps) => {
  const [mode, setMode] = useState<'camera' | 'manual'>('camera');
  const [manualValue, setManualValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (isOpen && mode === 'camera') {
      const startScanner = () => {
        try {
          const scanner = new Html5QrcodeScanner(
            "qr-reader",
            { 
              fps: 10, 
              qrbox: { width: 250, height: 250 },
              formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE, Html5QrcodeSupportedFormats.CODE_128 ]
            },
            /* verbose= */ false
          );

          scanner.render(
            (decodedText) => {
              onScanSuccess(decodedText);
              scanner.clear();
              onClose();
            },
            (errorMessage) => {
              // Silently handle scan errors (usually just "no QR code found in frame")
            }
          );
          scannerRef.current = scanner;
        } catch (err) {
          console.error("Scanner initialization failed", err);
          setError("Could not start camera. Please check permissions.");
        }
      };

      // Small delay to ensure the DOM element is ready
      const timer = setTimeout(startScanner, 100);
      return () => {
        clearTimeout(timer);
        if (scannerRef.current) {
          scannerRef.current.clear().catch(err => console.error("Failed to clear scanner", err));
        }
      };
    }
  }, [isOpen, mode, onScanSuccess, onClose]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualValue.trim()) {
      onScanSuccess(manualValue.trim());
      onClose();
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
            className="relative w-full max-w-md bg-background ledger-card overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh]"
          >
            <div className="indicator-primary" />
            <div className="px-6 sm:px-8 py-4 sm:py-6 border-b border-outline-variant flex justify-between items-center bg-surface-container shrink-0">
              <div className="flex items-center gap-3">
                <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                <h2 className="font-headline font-bold text-base sm:text-lg text-primary uppercase tracking-wider">
                  Inventory Scanner
                </h2>
              </div>
              <button onClick={onClose} className="text-on-surface-variant hover:text-primary transition-colors p-2">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 sm:p-8 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
              <div className="flex bg-surface-container p-1 rounded-sharp border border-outline-variant shrink-0">
                <button 
                  onClick={() => setMode('camera')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider rounded-sharp transition-all ${
                    mode === 'camera' ? 'bg-primary text-white shadow-md' : 'text-on-surface-variant hover:bg-surface'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  Camera
                </button>
                <button 
                  onClick={() => setMode('manual')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider rounded-sharp transition-all ${
                    mode === 'manual' ? 'bg-primary text-white shadow-md' : 'text-on-surface-variant hover:bg-surface'
                  }`}
                >
                  <Keyboard className="w-3.5 h-3.5" />
                  Manual Entry
                </button>
              </div>

              {mode === 'camera' ? (
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-sharp border-2 border-outline-variant bg-black min-h-[250px] sm:min-h-[300px]">
                    <div id="qr-reader" className="w-full" />
                  </div>
                  {error && (
                    <div className="p-4 bg-tertiary/10 border border-tertiary/20 rounded-sharp flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-tertiary" />
                      <p className="text-xs sm:text-sm font-bold text-tertiary">{error}</p>
                    </div>
                  )}
                  <p className="text-center text-[10px] sm:text-[11px] font-mono text-on-surface-variant uppercase tracking-widest">
                    Position QR / Barcode in frame
                  </p>
                </div>
              ) : (
                <form onSubmit={handleManualSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="font-headline font-bold text-[10px] sm:text-[11px] text-on-surface-variant uppercase tracking-widest block">SKU / QR Value</label>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        autoFocus
                        type="text" 
                        value={manualValue}
                        onChange={e => setManualValue(e.target.value)}
                        className="w-full border-0 border-b-2 border-surface-container bg-surface-container-low pl-12 pr-4 py-3 sm:py-4 font-mono text-base focus:ring-0 focus:border-primary transition-all rounded-t-none"
                        placeholder="Enter SKU..."
                      />
                    </div>
                  </div>
                  <button 
                    type="submit"
                    className="w-full py-3 sm:py-4 bg-primary text-white font-headline font-bold text-[11px] sm:text-[12px] uppercase tracking-wider hover:bg-primary-container transition-all rounded-sharp shadow-lg flex items-center justify-center gap-2"
                  >
                    <Search className="w-4 h-4" />
                    Lookup Resource
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default QRScannerModal;
