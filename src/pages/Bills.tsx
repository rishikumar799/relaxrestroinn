import React, { useState, useEffect } from 'react';
import { 
  Receipt, 
  Search, 
  Filter, 
  Eye, 
  Printer, 
  Download, 
  Ban, 
  Trash2, 
  DownloadCloud, 
  Plus, 
  Calendar,
  Sparkles,
  FileSpreadsheet,
  AlertTriangle
} from 'lucide-react';
import { Bill, HotelSettings } from '../types';
import { getBills, searchBills, voidBill, deleteBill } from '../services/billService';
import { formatINR } from '../utils/currency';
import { formatDateForDisplay } from '../utils/date';
import { generateBillCSV } from '../services/reportService';
import { useToast } from '../components/common/Toast';
import { ConfirmationModal } from '../components/common/ConfirmationModal';

interface BillsProps {
  settings?: HotelSettings;
  onViewBill: (bill: Bill) => void;
  onNewManualBill: () => void;
}

export const Bills: React.FC<BillsProps> = ({
  settings,
  onViewBill,
  onNewManualBill,
}) => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState<Bill[]>([]);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals
  const [billToVoid, setBillToVoid] = useState<Bill | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);

  const [billToDelete, setBillToDelete] = useState<Bill | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadAllBills = async () => {
    try {
      setLoading(true);
      const data = await getBills(200);
      setBills(data);
    } catch (err) {
      console.error('Error fetching bills:', err);
      toast.error('Failed to load bills', 'Could not retrieve invoices list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllBills();
  }, []);

  const handleApplyFilter = async () => {
    try {
      setLoading(true);
      const results = await searchBills({
        searchTerm: searchTerm.trim() || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        billType: typeFilter !== 'all' ? typeFilter : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setBills(results);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Reset filters
  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setTypeFilter('all');
    setStartDate('');
    setEndDate('');
    loadAllBills();
  };

  // Void Handler
  const handleConfirmVoid = async () => {
    if (!billToVoid) return;
    if (!voidReason.trim()) {
      toast.warning('Reason Required', 'Please provide a valid reason for voiding this invoice.');
      return;
    }

    try {
      setVoiding(true);
      await voidBill(billToVoid.billId, voidReason.trim());
      toast.success('Invoice Voided', `Bill #${billToVoid.billNo} has been voided.`);
      setBillToVoid(null);
      setVoidReason('');
      loadAllBills();
    } catch (err: any) {
      toast.error('Void Failed', err.message || 'Could not void bill.');
    } finally {
      setVoiding(false);
    }
  };

  // Delete Handler
  const handleConfirmDelete = async () => {
    if (!billToDelete) return;
    try {
      setDeleting(true);
      await deleteBill(billToDelete.billId);
      toast.success('Invoice Deleted', `Bill #${billToDelete.billNo} has been deleted.`);
      setBillToDelete(null);
      loadAllBills();
    } catch (err: any) {
      toast.error('Delete Failed', err.message || 'Could not delete bill.');
    } finally {
      setDeleting(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (bills.length === 0) {
      toast.warning('No Records', 'There are no bills to export in current view.');
      return;
    }
    const csvStr = generateBillCSV(bills);
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relax_resto_inn_bills_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV Downloaded', `Exported ${bills.length} bills successfully.`);
  };

  // Aggregate stats
  const validBills = bills.filter(b => b.status !== 'void');
  const totalTaxable = validBills.reduce((sum, b) => sum + (b.taxableAmount || 0), 0);
  const totalGST = validBills.reduce((sum, b) => sum + (b.totalGST || 0), 0);
  const totalGross = validBills.reduce((sum, b) => sum + (b.grossTotal || 0), 0);

  return (
    <div className="max-w-7xl mx-auto pb-12 space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-amber-950 font-['Outfit',sans-serif]">
            Tax Invoices & Billing History
          </h1>
          <p className="text-xs text-stone-600 mt-0.5">
            Search, filter, reprint, export and manage all A4 Tax Invoices
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={onNewManualBill}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-orange-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Manual Bill</span>
          </button>
        </div>
      </div>

      {/* Aggregate KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#FFFDF9] p-3.5 rounded-2xl border border-amber-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Total Bills</span>
          <div className="text-xl font-black text-stone-900 font-['Outfit',sans-serif] mt-1">{bills.length}</div>
          <span className="text-[10px] text-stone-400">{validBills.length} active, {bills.length - validBills.length} void</span>
        </div>

        <div className="bg-[#FFFDF9] p-3.5 rounded-2xl border border-amber-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Taxable Sum</span>
          <div className="text-lg sm:text-xl font-black text-stone-900 font-mono mt-1">{formatINR(totalTaxable)}</div>
          <span className="text-[10px] text-stone-400">Excluding GST</span>
        </div>

        <div className="bg-[#FFFDF9] p-3.5 rounded-2xl border border-amber-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Total GST (12%)</span>
          <div className="text-lg sm:text-xl font-black text-orange-900 font-mono mt-1">{formatINR(totalGST)}</div>
          <span className="text-[10px] text-stone-400">CGST + SGST + IGST</span>
        </div>

        <div className="bg-[#FFFDF9] p-3.5 rounded-2xl border border-amber-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Gross Total</span>
          <div className="text-lg sm:text-xl font-black text-stone-950 font-mono mt-1">{formatINR(totalGross)}</div>
          <span className="text-[10px] text-emerald-800 font-bold">Total revenue</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200/80 shadow-xs p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Bill No, Guest, Room, Phone..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">All Statuses</option>
              <option value="paid">Paid</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="pending">Pending</option>
              <option value="void">Void</option>
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">All Bill Types</option>
              <option value="stay_checkout">Stay Checkouts</option>
              <option value="manual">Manual Invoices</option>
            </select>
          </div>

          {/* Filter Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleApplyFilter}
              className="flex-1 py-1.5 px-3 bg-stone-900 hover:bg-stone-800 text-amber-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Apply
            </button>
            <button
              onClick={handleResetFilters}
              className="py-1.5 px-3 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Date Filter Range */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-amber-100 text-xs">
          <span className="font-bold text-stone-700 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-orange-600" />
            <span>Date Range:</span>
          </span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2 py-1 bg-white border border-stone-300 rounded-lg text-xs"
            />
            <span className="text-stone-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2 py-1 bg-white border border-stone-300 rounded-lg text-xs"
            />
          </div>
        </div>
      </div>

      {/* Bills Table */}
      <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-stone-500">
            <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs">Loading tax invoices...</p>
          </div>
        ) : bills.length === 0 ? (
          <div className="py-16 text-center text-stone-500">
            <Receipt className="w-12 h-12 text-amber-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-stone-700">No invoices match your filter</p>
            <p className="text-xs text-stone-500 mt-0.5">Try changing search terms or add a new bill.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-amber-50/70 text-stone-700 font-bold uppercase text-[10px] tracking-wider border-b border-amber-200">
                <tr>
                  <th className="p-3">Bill No</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Guest Name</th>
                  <th className="p-3">Room</th>
                  <th className="p-3">Type</th>
                  <th className="p-3 text-right">Taxable</th>
                  <th className="p-3 text-right">GST</th>
                  <th className="p-3 text-right">Gross Total</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100/60 font-sans">
                {bills.map((bill) => {
                  const isVoid = bill.status === 'void';

                  return (
                    <tr 
                      key={bill.billId} 
                      className={`hover:bg-amber-50/40 transition-colors ${isVoid ? 'opacity-60 bg-red-50/30' : ''}`}
                    >
                      <td className="p-3 font-mono font-bold text-stone-900">
                        {bill.billNo}
                      </td>
                      <td className="p-3 text-stone-600">
                        {formatDateForDisplay(bill.billDate)}
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-stone-900 uppercase">{bill.guestName}</div>
                        {bill.companyDetails && (
                          <div className="text-[10px] text-stone-500 truncate max-w-[160px]">{bill.companyDetails}</div>
                        )}
                      </td>
                      <td className="p-3 font-mono font-semibold text-stone-800">
                        {bill.roomNumber}
                      </td>
                      <td className="p-3">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-700 font-medium">
                          {bill.billType === 'manual' ? 'Manual' : 'Checkout'}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono text-stone-700">
                        {formatINR(bill.taxableAmount)}
                      </td>
                      <td className="p-3 text-right font-mono text-stone-700">
                        {formatINR(bill.totalGST)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-stone-950">
                        {formatINR(bill.grossTotal)}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          isVoid 
                            ? 'bg-red-100 text-red-800' 
                            : bill.status === 'paid' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {bill.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onViewBill(bill)}
                            title="View Official Invoice"
                            className="p-1.5 bg-stone-900 hover:bg-stone-800 text-amber-300 rounded-lg transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {!isVoid && (
                            <button
                              onClick={() => {
                                setBillToVoid(bill);
                                setVoidReason('');
                              }}
                              title="Void Invoice"
                              className="p-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg transition-colors cursor-pointer"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => setBillToDelete(bill)}
                            title="Delete Record"
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Void Modal */}
      {billToVoid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[#FFFDF9] rounded-2xl border border-red-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 text-red-700 font-bold font-['Outfit',sans-serif] text-base">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span>Void Tax Invoice #{billToVoid.billNo}</span>
            </div>

            <p className="text-xs text-stone-600">
              Voiding this invoice will mark it as void in tax reports while preserving the record for auditing.
            </p>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                Reason for Voiding *
              </label>
              <textarea
                rows={3}
                required
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="e.g. Billing error, guest amended dates, duplicate manual entry..."
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBillToVoid(null)}
                className="px-4 py-2 text-xs font-bold text-stone-700 hover:bg-stone-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmVoid}
                disabled={voiding}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md cursor-pointer disabled:opacity-50"
              >
                {voiding ? 'Voiding...' : 'Confirm Void Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!billToDelete}
        title={`Permanently Delete Invoice #${billToDelete?.billNo}?`}
        message="Are you sure you want to delete this invoice record? This operation cannot be undone."
        confirmText={deleting ? 'Deleting...' : 'Delete Invoice'}
        isDanger={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setBillToDelete(null)}
      />
    </div>
  );
};
