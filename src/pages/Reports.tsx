import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  DownloadCloud, 
  Calendar, 
  TrendingUp, 
  Percent, 
  Printer, 
  Receipt, 
  Wallet, 
  Sparkles,
  BedDouble
} from 'lucide-react';
import { Bill, Payment, HotelSettings } from '../types';
import { getBills } from '../services/billService';
import { getAllPayments } from '../services/paymentService';
import { generateFinancialReport, generateBillCSV } from '../services/reportService';
import { formatINR } from '../utils/currency';
import { formatDateForDisplay, getTodayDateString } from '../utils/date';
import { useToast } from '../components/common/Toast';

interface ReportsProps {
  settings?: HotelSettings;
}

export const Reports: React.FC<ReportsProps> = ({ settings }) => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  // Period Preset
  const [period, setPeriod] = useState<'today' | 'this_month' | 'last_month' | 'all' | 'custom'>('this_month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const todayStr = getTodayDateString();

  useEffect(() => {
    // Set default month dates
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    setStartDate(firstDay);
    setEndDate(lastDay);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [billsData, paymentsData] = await Promise.all([
        getBills(500),
        getAllPayments(500),
      ]);
      setBills(billsData);
      setPayments(paymentsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePeriodChange = (val: 'today' | 'this_month' | 'last_month' | 'all' | 'custom') => {
    setPeriod(val);
    const now = new Date();

    if (val === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (val === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (val === 'last_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (val === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Filter bills & payments
  const filteredBills = bills.filter(b => {
    if (startDate && b.billDate < startDate) return false;
    if (endDate && b.billDate > endDate) return false;
    return true;
  });

  const filteredPayments = payments.filter(p => {
    if (startDate && p.paymentDate < startDate) return false;
    if (endDate && p.paymentDate > endDate) return false;
    return true;
  });

  const report = generateFinancialReport(filteredBills, filteredPayments, startDate, endDate);

  const handleExportCSV = () => {
    if (filteredBills.length === 0) {
      toast.warning('No Records', 'No bills match the selected period.');
      return;
    }
    const csvStr = generateBillCSV(filteredBills);
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GST_Financial_Report_${startDate || 'all'}_to_${endDate || 'all'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report Exported', 'CSV report downloaded.');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto pb-12 space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-amber-950 font-['Outfit',sans-serif]">
            GST Tax & Financial Analytics
          </h1>
          <p className="text-xs text-stone-600 mt-0.5">
            Audit monthly revenue, CGST, SGST, IGST liabilities & payment reconciliations
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4 text-stone-600" />
            <span>Print Report</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-orange-600/30 transition-all cursor-pointer"
          >
            <DownloadCloud className="w-4 h-4" />
            <span>Download GST CSV</span>
          </button>
        </div>
      </div>

      {/* Period Selector */}
      <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200/80 shadow-xs p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          <span className="text-stone-500 mr-1">Period:</span>
          {(['today', 'this_month', 'last_month', 'all', 'custom'] as const).map((p) => (
            <button
              key={p}
              onClick={() => handlePeriodChange(p)}
              className={`px-3 py-1 rounded-xl transition-all cursor-pointer ${
                period === p 
                  ? 'bg-stone-900 text-amber-300 shadow-xs' 
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              {p.replace('_', ' ').toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setPeriod('custom');
              setStartDate(e.target.value);
            }}
            className="px-2.5 py-1 bg-white border border-stone-300 rounded-xl text-xs"
          />
          <span className="text-stone-400 font-bold">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setPeriod('custom');
              setEndDate(e.target.value);
            }}
            className="px-2.5 py-1 bg-white border border-stone-300 rounded-xl text-xs"
          />
        </div>
      </div>

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#FFFDF9] p-4 rounded-2xl border border-amber-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Gross Invoiced Revenue</span>
          <div className="text-xl sm:text-2xl font-black text-stone-950 font-mono mt-1">
            {formatINR(report.totalRevenue)}
          </div>
          <span className="text-[10px] text-stone-400">{report.totalInvoices} invoices generated</span>
        </div>

        <div className="bg-[#FFFDF9] p-4 rounded-2xl border border-amber-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Taxable Turnover</span>
          <div className="text-xl sm:text-2xl font-black text-stone-900 font-mono mt-1">
            {formatINR(report.totalTaxable)}
          </div>
          <span className="text-[10px] text-stone-400">Net of discounts</span>
        </div>

        <div className="bg-[#FFFDF9] p-4 rounded-2xl border border-amber-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Total GST Liability</span>
          <div className="text-xl sm:text-2xl font-black text-orange-900 font-mono mt-1">
            {formatINR(report.totalGST)}
          </div>
          <span className="text-[10px] text-orange-800 font-medium">To be filed in GSTR-1 / 3B</span>
        </div>

        <div className="bg-[#FFFDF9] p-4 rounded-2xl border border-amber-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Actual Collections</span>
          <div className="text-xl sm:text-2xl font-black text-emerald-800 font-mono mt-1">
            {formatINR(report.totalCash + report.totalUPI + report.totalCard + report.totalBankTransfer + report.totalCredit)}
          </div>
          <span className="text-[10px] text-emerald-700 font-bold">Total receipts collected</span>
        </div>
      </div>

      {/* Two Columns: GST Breakdown (Left) & Payment Mode Split (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* GST Tax Breakdown Card */}
        <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200/80 shadow-xs p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-amber-100 pb-3 text-amber-950 font-bold font-['Outfit',sans-serif] text-sm">
            <Percent className="w-4 h-4 text-orange-600" />
            <span>GST Tax Breakdown Summary</span>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 rounded-xl bg-orange-50/60 border border-orange-200">
              <div>
                <div className="font-bold text-xs text-stone-900">CGST (Central Tax @ 6.00%)</div>
                <div className="text-[10px] text-stone-500">Intra-state central component</div>
              </div>
              <div className="text-sm font-mono font-black text-stone-900">
                {formatINR(report.totalCGST)}
              </div>
            </div>

            <div className="flex justify-between items-center p-3 rounded-xl bg-amber-50/60 border border-amber-200">
              <div>
                <div className="font-bold text-xs text-stone-900">SGST (State Tax @ 6.00%)</div>
                <div className="text-[10px] text-stone-500">Andhra Pradesh state component</div>
              </div>
              <div className="text-sm font-mono font-black text-stone-900">
                {formatINR(report.totalSGST)}
              </div>
            </div>

            <div className="flex justify-between items-center p-3 rounded-xl bg-red-50/60 border border-red-200">
              <div>
                <div className="font-bold text-xs text-stone-900">IGST (Integrated Tax @ 12.00%)</div>
                <div className="text-[10px] text-stone-500">Inter-state guest component</div>
              </div>
              <div className="text-sm font-mono font-black text-stone-900">
                {formatINR(report.totalIGST)}
              </div>
            </div>

            <div className="flex justify-between items-center p-3 rounded-xl bg-stone-900 text-white font-bold">
              <span className="text-xs text-amber-300">Total GST Calculated</span>
              <span className="text-base font-mono text-amber-300">
                {formatINR(report.totalGST)}
              </span>
            </div>
          </div>
        </div>

        {/* Payment Collection Channels */}
        <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200/80 shadow-xs p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-amber-100 pb-3 text-amber-950 font-bold font-['Outfit',sans-serif] text-sm">
            <Wallet className="w-4 h-4 text-orange-600" />
            <span>Collection Channels & Settlement Split</span>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center p-2.5 rounded-xl border border-stone-200 bg-white">
              <span className="text-xs font-bold text-stone-800">Cash Collections</span>
              <span className="text-xs font-mono font-bold text-stone-900">{formatINR(report.totalCash)}</span>
            </div>

            <div className="flex justify-between items-center p-2.5 rounded-xl border border-stone-200 bg-white">
              <span className="text-xs font-bold text-stone-800">UPI / QR Transfers</span>
              <span className="text-xs font-mono font-bold text-stone-900">{formatINR(report.totalUPI)}</span>
            </div>

            <div className="flex justify-between items-center p-2.5 rounded-xl border border-stone-200 bg-white">
              <span className="text-xs font-bold text-stone-800">POS / Card Payments</span>
              <span className="text-xs font-mono font-bold text-stone-900">{formatINR(report.totalCard)}</span>
            </div>

            <div className="flex justify-between items-center p-2.5 rounded-xl border border-stone-200 bg-white">
              <span className="text-xs font-bold text-stone-800">Bank Transfer / NEFT</span>
              <span className="text-xs font-mono font-bold text-stone-900">{formatINR(report.totalBankTransfer)}</span>
            </div>

            <div className="flex justify-between items-center p-2.5 rounded-xl border border-stone-200 bg-white">
              <span className="text-xs font-bold text-stone-800">Credit Bill / Ledger Due</span>
              <span className="text-xs font-mono font-bold text-rose-700">{formatINR(report.totalCredit)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
