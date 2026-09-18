import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Search, 
  Filter, 
  Plus, 
  Receipt, 
  TrendingUp, 
  Building, 
  Calendar,
  Sparkles,
  Wallet
} from 'lucide-react';
import { Payment, PaymentMethod, HotelSettings, Bill } from '../types';
import { getAllPayments, addPaymentToBill } from '../services/paymentService';
import { getBills } from '../services/billService';
import { formatINR } from '../utils/currency';
import { formatDateForDisplay } from '../utils/date';
import { useToast } from '../components/common/Toast';

interface PaymentsProps {
  settings?: HotelSettings;
  onViewBill: (bill: Bill) => void;
}

export const Payments: React.FC<PaymentsProps> = ({ settings, onViewBill }) => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Add Payment Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedBillId, setSelectedBillId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [paymentsData, billsData] = await Promise.all([
        getAllPayments(200),
        getBills(200),
      ]);
      setPayments(paymentsData);
      setBills(billsData);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load payments', 'Could not fetch payments list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    const unpaidBill = bills.find(b => b.balance > 0 && b.status !== 'void');
    if (unpaidBill) {
      setSelectedBillId(unpaidBill.billId);
      setPaymentAmount(unpaidBill.balance);
    } else if (bills.length > 0) {
      setSelectedBillId(bills[0].billId);
      setPaymentAmount(1000);
    }
    setPaymentMethod('Cash');
    setPaymentRef('');
    setPaymentNotes('');
    setShowAddModal(true);
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBillId) {
      toast.error('Bill Required', 'Please select a bill.');
      return;
    }
    if (paymentAmount <= 0) {
      toast.error('Invalid Amount', 'Payment amount must be greater than zero.');
      return;
    }

    try {
      setSubmitting(true);
      const targetBill = bills.find(b => b.billId === selectedBillId);

      await addPaymentToBill({
        billId: selectedBillId,
        billNo: targetBill?.billNo || 'BILL',
        guestName: targetBill?.guestName || 'Guest',
        amount: paymentAmount,
        paymentMethod,
        paymentType: 'settlement',
        referenceNumber: paymentRef.trim(),
        notes: paymentNotes.trim(),
      });

      toast.success('Payment Recorded', `Recorded ${formatINR(paymentAmount)} via ${paymentMethod}.`);
      setShowAddModal(false);
      loadData();
    } catch (err: any) {
      toast.error('Payment Error', err.message || 'Could not record payment.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered Payments
  const filteredPayments = payments.filter((p) => {
    const effectiveMethod = p.paymentMethod || p.paymentType;
    if (methodFilter !== 'all' && effectiveMethod !== methodFilter) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      return (
        (p.guestName && p.guestName.toLowerCase().includes(term)) ||
        (p.billNo && p.billNo.toLowerCase().includes(term)) ||
        (p.referenceNumber && p.referenceNumber.toLowerCase().includes(term))
      );
    }
    return true;
  });

  // Calculate Breakdown by Payment Mode
  const totalCash = payments.filter(p => (p.paymentMethod || p.paymentType) === 'Cash').reduce((s, p) => s + (p.amount || 0), 0);
  const totalUPI = payments.filter(p => (p.paymentMethod || p.paymentType) === 'UPI').reduce((s, p) => s + (p.amount || 0), 0);
  const totalCard = payments.filter(p => (p.paymentMethod || p.paymentType) === 'Card').reduce((s, p) => s + (p.amount || 0), 0);
  const totalOther = payments.filter(p => !['Cash', 'UPI', 'Card'].includes(p.paymentMethod || p.paymentType || '')).reduce((s, p) => s + (p.amount || 0), 0);
  const totalCollected = totalCash + totalUPI + totalCard + totalOther;

  return (
    <div className="max-w-7xl mx-auto pb-12 space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-amber-950 font-['Outfit',sans-serif]">
            Payment Collections & Cashbook Ledger
          </h1>
          <p className="text-xs text-stone-600 mt-0.5">
            Audit advances, checkout settlements, UPI transactions and payment methods
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-orange-600/30 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Record Payment</span>
        </button>
      </div>

      {/* Mode KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#FFFDF9] p-3.5 rounded-2xl border border-amber-200/80 shadow-xs">
          <div className="flex justify-between items-center text-[10px] font-bold text-stone-500 uppercase tracking-wider">
            <span>Cash Drawer</span>
            <Wallet className="w-3.5 h-3.5 text-amber-700" />
          </div>
          <div className="text-lg sm:text-xl font-black text-stone-900 font-mono mt-1">{formatINR(totalCash)}</div>
          <span className="text-[10px] text-stone-400">Total physical cash</span>
        </div>

        <div className="bg-[#FFFDF9] p-3.5 rounded-2xl border border-amber-200/80 shadow-xs">
          <div className="flex justify-between items-center text-[10px] font-bold text-stone-500 uppercase tracking-wider">
            <span>UPI / QR</span>
            <Sparkles className="w-3.5 h-3.5 text-orange-600" />
          </div>
          <div className="text-lg sm:text-xl font-black text-orange-900 font-mono mt-1">{formatINR(totalUPI)}</div>
          <span className="text-[10px] text-stone-400">Digital UPI transfers</span>
        </div>

        <div className="bg-[#FFFDF9] p-3.5 rounded-2xl border border-amber-200/80 shadow-xs">
          <div className="flex justify-between items-center text-[10px] font-bold text-stone-500 uppercase tracking-wider">
            <span>Cards / POS</span>
            <CreditCard className="w-3.5 h-3.5 text-amber-800" />
          </div>
          <div className="text-lg sm:text-xl font-black text-stone-900 font-mono mt-1">{formatINR(totalCard)}</div>
          <span className="text-[10px] text-stone-400">Credit & Debit swipe</span>
        </div>

        <div className="bg-[#FFFDF9] p-3.5 rounded-2xl border border-amber-200/80 shadow-xs">
          <div className="flex justify-between items-center text-[10px] font-bold text-stone-500 uppercase tracking-wider">
            <span>Total Collections</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-lg sm:text-xl font-black text-emerald-800 font-mono mt-1">{formatINR(totalCollected)}</div>
          <span className="text-[10px] text-emerald-700 font-bold">{payments.length} total receipts</span>
        </div>
      </div>

      {/* Filter Strip */}
      <div className="bg-[#FFFDF9] p-4 rounded-2xl border border-amber-200/80 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Guest Name, Bill Number, or Reference ID..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">All Modes</option>
              <option value="Cash">Cash Only</option>
              <option value="UPI">UPI Only</option>
              <option value="Card">Card Only</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Credit">Credit Ledger</option>
            </select>
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-stone-500">
            <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs">Loading payment transactions...</p>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="py-16 text-center text-stone-500">
            <CreditCard className="w-12 h-12 text-amber-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-stone-700">No payment receipts found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-amber-50/70 text-stone-700 font-bold uppercase text-[10px] tracking-wider border-b border-amber-200">
                <tr>
                  <th className="p-3">Receipt / Time</th>
                  <th className="p-3">Bill No</th>
                  <th className="p-3">Guest Name</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Mode</th>
                  <th className="p-3">Reference / Txn ID</th>
                  <th className="p-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100 font-sans">
                {filteredPayments.map((p) => (
                  <tr key={p.paymentId} className="hover:bg-amber-50/40 transition-colors">
                    <td className="p-3 text-stone-600">
                      <div>{formatDateForDisplay(p.paymentDate)}</div>
                      <div className="text-[10px] text-stone-400 font-mono">{p.paymentTime}</div>
                    </td>
                    <td className="p-3 font-mono font-bold text-stone-900">
                      {p.billNo}
                    </td>
                    <td className="p-3 font-semibold text-stone-900 uppercase">
                      {p.guestName}
                    </td>
                    <td className="p-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-amber-100 text-amber-900">
                        {p.paymentMethod || p.paymentType || 'Payment'}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-stone-800">
                      {p.paymentMethod}
                    </td>
                    <td className="p-3 font-mono text-stone-500">
                      {p.referenceNumber || '-'}
                    </td>
                    <td className="p-3 text-right font-mono font-black text-stone-950 text-sm">
                      {formatINR(p.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-base text-stone-900 font-['Outfit',sans-serif]">
              Record Payment Receipt
            </h3>

            <form onSubmit={handleSavePayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  Select Bill *
                </label>
                <select
                  value={selectedBillId}
                  onChange={(e) => {
                    setSelectedBillId(e.target.value);
                    const b = bills.find(x => x.billId === e.target.value);
                    if (b && b.balance > 0) setPaymentAmount(b.balance);
                  }}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-mono"
                >
                  {bills.map(b => (
                    <option key={b.billId} value={b.billId}>
                      {b.billNo} - {b.guestName} (Due: {formatINR(b.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  Payment Amount (₹) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-amber-50/70 border border-amber-300 rounded-xl text-sm font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  Payment Mode
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-bold"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Card">Card</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Credit">Credit</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  Reference / Transaction ID
                </label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="e.g. UPI-34982394 / Card Auth"
                  className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-amber-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-bold text-stone-700 hover:bg-stone-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 hover:from-red-700 hover:to-amber-700 rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Recording...' : 'Save Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
