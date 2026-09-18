import { Bill, Payment, Stay, Room, HotelSettings, Guest } from '../types';
import { getBills } from './billService';
import { getAllPayments } from './paymentService';
import { getRooms } from './roomService';
import { getActiveStays } from './stayService';
import { getGuests } from './guestService';
import { getHotelSettings } from './settingsService';
import { roundToTwo } from '../utils/currency';

export interface FinancialReportData {
  totalRevenue: number;
  totalTaxable: number;
  totalGST: number;
  totalCGST: number;
  totalSGST: number;
  totalIGST: number;
  totalInvoices: number;
  totalCash: number;
  totalUPI: number;
  totalCard: number;
  totalBankTransfer: number;
  totalCredit: number;
  totalOutstanding: number;
}

export function generateFinancialReport(
  bills: Bill[],
  payments: Payment[],
  startDate?: string,
  endDate?: string
): FinancialReportData {
  const activeBills = bills.filter(b => b.status !== 'void');

  let totalRevenue = 0;
  let totalTaxable = 0;
  let totalGST = 0;
  let totalCGST = 0;
  let totalSGST = 0;
  let totalIGST = 0;
  let totalOutstanding = 0;

  for (const b of activeBills) {
    totalRevenue += b.grossTotal || 0;
    totalTaxable += b.taxableAmount || 0;
    totalGST += b.totalGST || 0;
    totalCGST += b.cgst || 0;
    totalSGST += b.sgst || 0;
    totalIGST += b.igst || 0;
    totalOutstanding += b.balance || 0;
  }

  let totalCash = 0;
  let totalUPI = 0;
  let totalCard = 0;
  let totalBankTransfer = 0;
  let totalCredit = 0;

  for (const p of payments) {
    const amt = p.amount || 0;
    switch (p.paymentMethod || p.paymentType) {
      case 'Cash':
        totalCash += amt;
        break;
      case 'UPI':
        totalUPI += amt;
        break;
      case 'Card':
        totalCard += amt;
        break;
      case 'Bank Transfer':
        totalBankTransfer += amt;
        break;
      case 'Credit':
        totalCredit += amt;
        break;
      default:
        totalCash += amt;
    }
  }

  return {
    totalRevenue: roundToTwo(totalRevenue),
    totalTaxable: roundToTwo(totalTaxable),
    totalGST: roundToTwo(totalGST),
    totalCGST: roundToTwo(totalCGST),
    totalSGST: roundToTwo(totalSGST),
    totalIGST: roundToTwo(totalIGST),
    totalInvoices: activeBills.length,
    totalCash: roundToTwo(totalCash),
    totalUPI: roundToTwo(totalUPI),
    totalCard: roundToTwo(totalCard),
    totalBankTransfer: roundToTwo(totalBankTransfer),
    totalCredit: roundToTwo(totalCredit),
    totalOutstanding: roundToTwo(totalOutstanding),
  };
}

export function generateBillCSV(bills: Bill[]): string {
  const headers = [
    'Bill No',
    'Date',
    'Guest Name',
    'Phone',
    'Room',
    'Pax',
    'Check-in',
    'Check-out',
    'Days',
    'Subtotal',
    'Discount',
    'Taxable Value',
    'CGST (6%)',
    'SGST (6%)',
    'IGST (12%)',
    'Total GST',
    'Gross Total',
    'Advance Paid',
    'Balance Due',
    'Payment Method',
    'Company GSTIN',
    'Status'
  ];

  const rows = bills.map(b => [
    `"${b.billNo}"`,
    `"${b.billDate}"`,
    `"${(b.guestName || '').replace(/"/g, '""')}"`,
    `"${b.guestPhone || ''}"`,
    `"${b.roomNumber}"`,
    `"${b.pax || ''}"`,
    `"${b.checkInDate || ''}"`,
    `"${b.checkOutDate || ''}"`,
    b.numberOfDays || 1,
    (b.subtotal || 0).toFixed(2),
    (b.discount || 0).toFixed(2),
    (b.taxableAmount || 0).toFixed(2),
    (b.cgst || 0).toFixed(2),
    (b.sgst || 0).toFixed(2),
    (b.igst || 0).toFixed(2),
    (b.totalGST || 0).toFixed(2),
    (b.grossTotal || 0).toFixed(2),
    (b.advance || 0).toFixed(2),
    (b.balance || 0).toFixed(2),
    `"${b.paymentType || 'Cash'}"`,
    `"${b.companyGSTIN || ''}"`,
    `"${b.status}"`
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

export function exportBillsToCSV(bills: Bill[]): void {
  const csvContent = generateBillCSV(bills);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `RELAX_RESTO_INN_BILLS_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function exportAllData(): Promise<string> {
  const [bills, payments, rooms, stays, guests, settings] = await Promise.all([
    getBills(1000),
    getAllPayments(1000),
    getRooms(),
    getActiveStays(),
    getGuests(1000),
    getHotelSettings(),
  ]);

  const backupObj = {
    exportedAt: new Date().toISOString(),
    hotel: settings.hotelName,
    settings,
    rooms,
    stays,
    guests,
    bills,
    payments,
  };

  return JSON.stringify(backupObj, null, 2);
}
