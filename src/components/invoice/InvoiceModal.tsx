import React, { useState } from 'react';
import { Bill, HotelSettings } from '../../types';
import { InvoiceView } from './InvoiceView';
import { downloadInvoicePDF } from '../../utils/pdfGenerator';
import { Printer, Download, X, AlertTriangle, Check } from 'lucide-react';

interface InvoiceModalProps {
  bill: Bill | null;
  settings?: HotelSettings;
  onClose: () => void;
  onVoid?: (billId: string, reason: string) => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  bill,
  settings,
  onClose,
  onVoid,
}) => {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [voidReason, setVoidReason] = useState('');

  if (!bill) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    try {
      setIsGeneratingPdf(true);
      const filename = `RELAX-RESTO-INN-INV-${bill.billNo || bill.billId}.pdf`;
      await downloadInvoicePDF('printable-invoice-target', filename);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleConfirmVoid = () => {
    if (onVoid && voidReason.trim()) {
      onVoid(bill.billId, voidReason.trim());
      setShowVoidDialog(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-stone-900/70 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static print:overflow-visible">
      <div className="relative w-full max-w-4xl bg-[#FFFDF9] rounded-xl shadow-2xl border border-amber-200/80 flex flex-col max-h-[96vh] print:max-h-none print:border-none print:shadow-none print:rounded-none">
        {/* Modal Toolbar (hidden in print) */}
        <div className="no-print flex items-center justify-between px-5 py-3 border-b border-amber-100 bg-gradient-to-r from-amber-50/80 via-orange-50/50 to-amber-50/80 shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-amber-950 font-['Outfit',sans-serif] text-base sm:text-lg">
              Tax Invoice #{bill.billNo}
            </span>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
              bill.status === 'paid' 
                ? 'bg-emerald-100 text-emerald-800' 
                : bill.status === 'void' 
                ? 'bg-red-100 text-red-800'
                : 'bg-amber-100 text-amber-800'
            }`}>
              {bill.status.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-800 hover:bg-stone-900 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-amber-400" />
              <span>Print A4</span>
            </button>

            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPdf}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 hover:from-amber-700 hover:to-red-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isGeneratingPdf ? 'Exporting PDF...' : 'Download PDF'}</span>
            </button>

            {onVoid && bill.status !== 'void' && (
              <button
                onClick={() => setShowVoidDialog(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Void</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Void confirmation form if clicked */}
        {showVoidDialog && (
          <div className="no-print p-4 bg-red-50/90 border-b border-red-200 text-xs">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-red-900">Mark Invoice #{bill.billNo} as VOID?</p>
                <p className="text-red-700 text-[11px] mt-0.5">This will invalidate the tax invoice while preserving it in audit history.</p>
                <input
                  type="text"
                  placeholder="Reason for voiding (e.g. Booking cancelled / Billing error)"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="mt-2 w-full max-w-md px-2.5 py-1.5 bg-white border border-red-300 rounded text-stone-900 text-xs focus:ring-1 focus:ring-red-500"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={handleConfirmVoid}
                    disabled={!voidReason.trim()}
                    className="px-3 py-1 bg-red-700 text-white rounded font-medium disabled:opacity-50 cursor-pointer"
                  >
                    Confirm Void
                  </button>
                  <button
                    onClick={() => setShowVoidDialog(false)}
                    className="px-3 py-1 bg-stone-200 text-stone-700 rounded font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Invoice View Body */}
        <div className="overflow-y-auto p-4 sm:p-6 bg-stone-100/70 print:p-0 print:bg-white print:overflow-visible flex-1">
          <InvoiceView 
            bill={bill} 
            settings={settings} 
            id="printable-invoice-target" 
          />
        </div>
      </div>
    </div>
  );
};
