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
            className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]"
          >
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
                  <Camera className="w-5 h-5 text-primary-600" />
                </div>
                <h2 className="font-display font-semibold text-lg text-gray-900">Scanner</h2>
              </div>
              <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-6 overflow-y-auto">
              <div className="flex bg-gray-100 p-1 rounded-xl shrink-0">
                <button
                  onClick={() => setMode('camera')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                    mode === 'camera' ? 'bg-primary-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  Camera
                </button>
                <button
                  onClick={() => setMode('manual')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                    mode === 'manual' ? 'bg-primary-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <Keyboard className="w-3.5 h-3.5" />
                  Manual Entry
                </button>
              </div>

              {mode === 'camera' ? (
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-xl border-2 border-gray-200 bg-black min-h-[250px] sm:min-h-[300px]">
                    <div id="qr-reader" className="w-full" />
                  </div>
                  {error && (
                    <div className="p-4 bg-accent-50 border border-accent-200 rounded-xl flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-accent-600" />
                      <p className="text-xs sm:text-sm font-bold text-accent-700">{error}</p>
                    </div>
                  )}
                  <p className="text-center text-[10px] sm:text-[11px] font-mono text-gray-500 uppercase tracking-widest">
                    Position QR / Barcode in frame
                  </p>
                </div>
              ) : (
                <form onSubmit={handleManualSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="font-display font-bold text-[10px] sm:text-[11px] text-gray-500 uppercase tracking-widest block">SKU / QR Value</label>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        autoFocus
                        type="text"
                        value={manualValue}
                        onChange={e => setManualValue(e.target.value)}
                        className="w-full border-0 border-b-2 border-gray-200 bg-gray-50 pl-12 pr-4 py-3 sm:py-4 font-mono text-base focus:ring-0 focus:border-primary-500 transition-all rounded-t-none"
                        placeholder="Enter SKU..."
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3 sm:py-4 bg-primary-600 text-white font-display font-bold text-[11px] sm:text-[12px] uppercase tracking-wider hover:bg-primary-700 transition-all rounded-xl shadow-lg flex items-center justify-center gap-2"
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
