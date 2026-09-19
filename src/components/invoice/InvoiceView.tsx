import React from 'react';
import { Bill, HotelSettings } from '../../types';
import { formatNumber } from '../../utils/currency';
import { formatDateForDisplay, formatTime12H } from '../../utils/date';
import { computeTaxSummary } from '../../utils/tax';
import { MapPin, Phone, Mail, Globe } from 'lucide-react';

interface InvoiceViewProps {
  bill: Bill;
  settings?: HotelSettings;
  id?: string;
}

export const InvoiceView: React.FC<InvoiceViewProps> = ({
  bill,
  settings,
  id = 'relax-resto-inn-invoice'
}) => {
  const hotelName = settings?.hotelName || "RELAX RESTO INN";
  const legalName = settings?.legalName || "Ashritha Sai Services & Trading Pvt Ltd";
  const cin = settings?.cin || "72501AP2021PTC120374";
  const address = settings?.address || "#49-49-7, SHANTHIPURAM, REVENUE WARD NO-12, VISAKHAPATNAM-530016";
  const phone = settings?.phone || "0891-2713344, 2723344, 9256789456, 9912451116";
  const email = settings?.email || "relaxrestroinn@gmail.com";
  const gstin = settings?.gstin || "37AAWCA2881J2ZY";
  const website = settings?.website || "www.ashrithasai.com";

  // Compute subtotal sums from lineItems
  const lineItems = bill.lineItems && bill.lineItems.length > 0 ? bill.lineItems : [
    {
      id: 'default-1',
      date: bill.checkInDate || bill.billDate,
      roomDetails: bill.roomDetails || (bill.roomNumber ? `${bill.roomNumber}-${bill.roomType || 'ROOM'}` : ''),
      description: 'TARIFF',
      rate: bill.subtotal / (bill.numberOfDays || 1),
      numberOfDays: bill.numberOfDays || 1,
      value: bill.subtotal,
      discount: bill.discount || 0,
      total: bill.taxableAmount || bill.subtotal,
      gstRate: 12,
      gstAmount: bill.totalGST || 0,
      netTotal: bill.grossTotal || bill.subtotal,
    }
  ];

  let sumValue = 0;
  let sumDiscount = 0;
  let sumTotal = 0;
  let sumGST = 0;
  let sumNetTotal = 0;

  lineItems.forEach(item => {
    sumValue += item.value || 0;
    sumDiscount += item.discount || 0;
    sumTotal += item.total || 0;
    sumGST += item.gstAmount || (item.gst || 0);
    sumNetTotal += item.netTotal || 0;
  });

  const rounding = bill.roundingAmount !== undefined 
    ? bill.roundingAmount 
    : Math.round((bill.grossTotal - sumNetTotal) * 100) / 100;

  // Pax formatting
  let paxDisplay = bill.pax;
  if (!paxDisplay || paxDisplay.startsWith('1 Adult') || paxDisplay.includes('Adults')) {
    const adult = bill.paxAdult !== undefined ? bill.paxAdult : (paxDisplay?.includes('Adult') ? parseInt(paxDisplay) || 1 : 1);
    const child = bill.paxChild !== undefined ? bill.paxChild : 0;
    paxDisplay = `(Adult : ${adult}, Child : ${child})`;
  } else if (!paxDisplay.startsWith('(')) {
    paxDisplay = `(${paxDisplay})`;
  }

  // Room details format: e.g. "309-SUIT ROOM ( Plan Type : CP)"
  let roomDetailsDisplay = bill.roomDetails;
  if (!roomDetailsDisplay) {
    roomDetailsDisplay = `${bill.roomNumber || ''}-${bill.roomType || 'ROOM'}`;
    if (bill.planType) {
      roomDetailsDisplay += ` ( Plan Type : ${bill.planType} )`;
    }
  } else if (bill.planType && !roomDetailsDisplay.includes('Plan Type')) {
    roomDetailsDisplay += ` ( Plan Type : ${bill.planType} )`;
  }

  // ID Card Number formatting
  let idDisplay = bill.idCardNumber || '-';
  if (bill.idCardNumber && bill.idCardType) {
    idDisplay = `${bill.idCardNumber} - >${bill.idCardType}`;
  }

  // Tax Summary
  const taxSummaryRows = (bill.taxSummary && bill.taxSummary.length > 0)
    ? bill.taxSummary
    : computeTaxSummary(lineItems, bill.isInterState);

  // Advance receipts
  const receipts = (bill.advanceReceiptDetails && bill.advanceReceiptDetails.length > 0)
    ? bill.advanceReceiptDetails
    : (bill.advanceDetails && bill.advanceDetails.length > 0)
    ? bill.advanceDetails
    : (bill.advance > 0 ? [
        {
          date: bill.billDate || bill.checkInDate,
          description: bill.paymentType ? `Bank ( ${bill.paymentType} )` : 'Cash',
          refNo: bill.bookingId || bill.grcNumber || 'REC-01',
          roomDetails: bill.roomNumber || '',
          amount: bill.advance,
        }
      ] : []);

  let totalReceiptAmount = 0;
  receipts.forEach(r => { totalReceiptAmount += r.amount || 0; });
  if (totalReceiptAmount === 0 && bill.advance > 0) {
    totalReceiptAmount = bill.advance;
  }

  return (
    <div 
      id={id} 
      className="invoice-container bg-white text-black p-5 sm:p-7 max-w-[850px] mx-auto border border-stone-400 shadow-xl text-[11px] font-sans leading-tight print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-full"
      style={{ minHeight: '1080px', fontFamily: '"Arial", "Helvetica", sans-serif' }}
    >
      {/* Top Header Section */}
      <div className="flex justify-between items-start pb-2 border-b border-black">
        <div className="flex-1 pr-3">
          <div className="text-[13px] font-bold text-black tracking-normal">
            {legalName}
          </div>
          <div className="text-[11px] text-black mt-0.5">
            <span className="font-bold">CIN NO.</span> {cin}
          </div>
          <div className="text-[10.5px] text-black mt-0.5">
            {address}
          </div>
          <div className="text-[10.5px] text-black mt-0.5">
            <span className="font-bold">Phone :</span> {phone}
          </div>
          <div className="text-[10.5px] text-black mt-0.5">
            <span className="font-bold">E-mail :</span> {email}
          </div>
          <div className="text-[10.5px] text-black mt-0.5">
            <span className="font-bold">GSTIN :</span> <span className="font-bold">{gstin}</span>
          </div>
          <div className="text-[10.5px] text-black mt-0.5">
            <span className="font-bold">Website :</span> {website}
          </div>
        </div>

        {/* Logo at Top-Right */}
        <div className="flex flex-col items-end shrink-0 pl-2">
          {settings?.logoUrl ? (
            <img 
              src={settings.logoUrl} 
              alt="Ashritha Sai Logo" 
              className="h-20 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex flex-col items-center">
              <svg width="84" height="84" viewBox="0 0 100 100" className="drop-shadow-xs">
                {/* Circular Gradient Background */}
                <circle cx="50" cy="50" r="46" fill="#F4FBF7" stroke="#A7D7C5" strokeWidth="1.5" />
                {/* Green swirl leaf */}
                <path 
                  d="M50 12 C68 12, 86 28, 86 50 C86 68, 70 86, 50 86 C40 86, 30 80, 24 72 C36 78, 56 74, 68 62 C78 52, 78 36, 68 26 C58 16, 42 16, 32 24 C40 16, 46 12, 50 12 Z" 
                  fill="#78B943" 
                  opacity="0.9"
                />
                {/* Teal wave swirl */}
                <path 
                  d="M32 26 C22 36, 16 50, 20 64 C24 76, 36 86, 50 86 C62 86, 72 80, 78 72 C66 78, 48 76, 38 66 C28 56, 28 42, 36 32 C40 28, 46 26, 52 26 C44 24, 36 24, 32 26 Z" 
                  fill="#3399CC" 
                  opacity="0.85"
                />
                {/* Text Ashritha Sai */}
                <text 
                  x="50" 
                  y="52" 
                  textAnchor="middle" 
                  fill="#1A5B8C" 
                  fontSize="10" 
                  fontWeight="bold" 
                  fontFamily="'Brush Script MT', 'Segoe Script', cursive, sans-serif"
                  fontStyle="italic"
                  transform="rotate(-12 50 50)"
                >
                  Ashritha Sai
                </text>
                <circle cx="76" cy="28" r="3" fill="#D9534F" />
                <text x="80" y="27" fontSize="5" fill="#333">®</text>
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Tax Invoice Centered Heading */}
      <div className="text-center font-bold text-[14px] text-black py-1 tracking-wide mt-1">
        Tax Invoice
      </div>

      {/* Two-Column Top Information Table */}
      <div className="border-t border-b border-black py-2 mb-2 text-[10.5px]">
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          {/* LEFT SIDE */}
          <div className="space-y-1">
            <div className="flex">
              <span className="w-38 font-bold text-black shrink-0">Bill No</span>
              <span className="font-bold text-black">: {bill.billNo}</span>
            </div>
            <div className="flex">
              <span className="w-38 font-bold text-black shrink-0">Guest Name</span>
              <span className="font-bold text-black uppercase">: {bill.guestName}</span>
            </div>
            <div className="flex items-start">
              <span className="w-38 font-bold text-black shrink-0">Address & Mobile No.</span>
              <span className="text-black flex-1">: {bill.guestAddress ? `${bill.guestAddress}, ` : ''}{bill.guestPhone || '-'}</span>
            </div>
            <div className="flex items-start">
              <span className="w-38 font-bold text-black shrink-0">Company Details</span>
              <span className="text-black flex-1 uppercase">: {bill.companyDetails || bill.companyName || '-'}</span>
            </div>
            <div className="flex">
              <span className="w-38 font-bold text-black shrink-0">Company GSTIN</span>
              <span className="text-black font-mono">: {bill.companyGSTIN || '-'}</span>
            </div>
            <div className="flex">
              <span className="w-38 font-bold text-black shrink-0">State Code</span>
              <span className="text-black">: {bill.stateCode || '28'}</span>
            </div>
            <div className="flex">
              <span className="w-38 font-bold text-black shrink-0">Checkin Date</span>
              <span className="text-black">: {formatDateForDisplay(bill.checkInDate)} {bill.checkInTime ? formatTime12H(bill.checkInTime) : ''}</span>
            </div>
            <div className="flex">
              <span className="w-38 font-bold text-black shrink-0">Booking Id/ReservationID</span>
              <span className="text-black">: {bill.bookingId || bill.reservationId || '-'}</span>
            </div>
          </div>

          {/* RIGHT SIDE */}
          <div className="space-y-1">
            <div className="flex">
              <span className="w-32 font-bold text-black shrink-0">Bill Date</span>
              <span className="font-bold text-black">: {formatDateForDisplay(bill.billDate)}</span>
            </div>
            <div className="flex items-start">
              <span className="w-32 font-bold text-black shrink-0">Room Details</span>
              <span className="font-bold text-black uppercase flex-1">: {roomDetailsDisplay}</span>
            </div>
            <div className="flex">
              <span className="w-32 font-bold text-black shrink-0">No. Of Pax</span>
              <span className="text-black">: {paxDisplay}</span>
            </div>
            <div className="flex items-start">
              <span className="w-32 font-bold text-black shrink-0">Id Card Number</span>
              <span className="text-black flex-1">: {idDisplay}</span>
            </div>
            <div className="flex">
              <span className="w-32 font-bold text-black shrink-0">Ref / OTA</span>
              <span className="text-black">: {bill.refOTA || '-'}</span>
            </div>
            <div className="flex">
              <span className="w-32 font-bold text-black shrink-0">Ref / OTA GSTIN</span>
              <span className="text-black font-mono">: {bill.refOTAGSTIN || '-'}</span>
            </div>
            <div className="flex">
              <span className="w-32 font-bold text-black shrink-0">Place Of Supply</span>
              <span className="text-black uppercase">: {bill.placeOfSupply || 'VISAKHAPATNAM-530016'}</span>
            </div>
            <div className="flex">
              <span className="w-32 font-bold text-black shrink-0">Checkout Date</span>
              <span className="text-black">: {formatDateForDisplay(bill.checkOutDate)} {bill.checkOutTime ? formatTime12H(bill.checkOutTime) : ''}</span>
            </div>
            <div className="flex">
              <span className="w-32 font-bold text-black shrink-0">GRC Number</span>
              <span className="text-black">: {bill.grcNumber || '-'}</span>
            </div>
            <div className="flex">
              <span className="w-32 font-bold text-black shrink-0">Pay Type</span>
              <span className="font-semibold text-black uppercase">: {bill.paymentType || 'Wallet'}</span>
            </div>
            <div className="flex">
              <span className="w-32 font-bold text-black shrink-0">No. Of Days</span>
              <span className="font-semibold text-black">: {bill.numberOfDays || 1}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Line-Item Table */}
      <table className="w-full border-collapse text-[10px] mb-2">
        <thead>
          <tr className="border-t border-b border-black text-black font-bold text-left">
            <th className="py-1 px-1 w-18">Date</th>
            <th className="py-1 px-1 w-24">Room Details</th>
            <th className="py-1 px-1">Description</th>
            <th className="py-1 px-1 text-right w-16">Rate</th>
            <th className="py-1 px-1 text-center w-16">No Of Days</th>
            <th className="py-1 px-1 text-right w-16">Value</th>
            <th className="py-1 px-1 text-right w-14">Discount</th>
            <th className="py-1 px-1 text-right w-16">Total</th>
            <th className="py-1 px-1 text-right w-20">GST</th>
            <th className="py-1 px-1 text-right w-18">Net Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-200">
          {lineItems.map((item, idx) => {
            const daysText = (item.numberOfDays !== undefined && item.numberOfDays !== null && item.numberOfDays !== '' && item.numberOfDays !== '-')
              ? String(item.numberOfDays)
              : (item.days ? String(item.days) : '-');

            const discText = item.discount > 0 ? formatNumber(item.discount) : (item.discount === 0 ? '0.00' : '-');
            const gstText = item.gstRate 
              ? `${formatNumber(item.gstAmount || item.gst || 0)}(${item.gstRate}%)`
              : `${formatNumber(item.gstAmount || item.gst || 0)}`;

            return (
              <tr key={item.id || idx} className="text-black">
                <td className="py-1 px-1 whitespace-nowrap">{formatDateForDisplay(item.date)}</td>
                <td className="py-1 px-1 uppercase">{item.roomDetails || bill.roomNumber || '-'}</td>
                <td className="py-1 px-1 font-medium uppercase">{item.description}</td>
                <td className="py-1 px-1 text-right font-mono">{formatNumber(item.rate)}</td>
                <td className="py-1 px-1 text-center font-mono">{daysText}</td>
                <td className="py-1 px-1 text-right font-mono">{formatNumber(item.value)}</td>
                <td className="py-1 px-1 text-right font-mono">{discText}</td>
                <td className="py-1 px-1 text-right font-mono font-semibold">{formatNumber(item.total)}</td>
                <td className="py-1 px-1 text-right font-mono">{gstText}</td>
                <td className="py-1 px-1 text-right font-mono font-bold text-black">{formatNumber(item.netTotal)}</td>
              </tr>
            );
          })}

          {/* Sub Total summary row aligned under table columns */}
          <tr className="border-t border-b border-black font-bold text-black">
            <td colSpan={5} className="py-1 px-1 text-right">Sub Total</td>
            <td className="py-1 px-1 text-right font-mono">{formatNumber(sumValue)}</td>
            <td className="py-1 px-1 text-right font-mono">{formatNumber(sumDiscount)}</td>
            <td className="py-1 px-1 text-right font-mono">{formatNumber(sumTotal)}</td>
            <td className="py-1 px-1 text-right font-mono">{formatNumber(sumGST)}</td>
            <td className="py-1 px-1 text-right font-mono font-bold">{formatNumber(sumNetTotal)}</td>
          </tr>
        </tbody>
      </table>

      {/* Totals & Amount in Words Section */}
      <div className="grid grid-cols-12 gap-4 py-2 mb-3">
        {/* Left: Amount in Words */}
        <div className="col-span-7 flex flex-col justify-end">
          <div className="text-[11px] font-bold text-black">
            {bill.amountInWords || '(Zero Rupees Only)'}
          </div>
        </div>

        {/* Right: Summary Figures */}
        <div className="col-span-5 text-[10.5px]">
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="font-bold text-black">Sub Total</span>
              <span className="font-mono font-bold text-black">{formatNumber(bill.subtotal || sumTotal)}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="font-bold text-black">Rounded</span>
              <span className="font-mono text-black">{formatNumber(rounding)}</span>
            </div>

            <div className="flex justify-between border-t border-black pt-1">
              <span className="font-bold text-black">Gross Total:</span>
              <span className="font-mono font-extrabold text-[12px] text-black">{formatNumber(bill.grossTotal)}</span>
            </div>

            <div className="flex justify-between">
              <span className="font-bold text-black">Less Advance</span>
              <span className="font-mono font-bold text-black">{formatNumber(bill.advance)}</span>
            </div>

            <div className="flex justify-between border-t border-black pt-1">
              <span className="font-bold text-black">Balance</span>
              <span className="font-mono font-extrabold text-[12px] text-black">{formatNumber(bill.balance)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Advance / Receipt Details & Tax Summary Tables */}
      <div className="grid grid-cols-12 gap-6 my-2 pt-2 border-t border-black">
        {/* Left / Middle Column: Advance/Receipt Details */}
        <div className="col-span-7">
          <div className="text-center font-bold text-[11px] text-black pb-1">
            Advance/Receipt Details
          </div>
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="border-t border-b border-black text-black font-bold">
                <th className="py-0.5 text-left w-16">Date</th>
                <th className="py-0.5 text-left">Description</th>
                <th className="py-0.5 text-left w-24">RefNo</th>
                <th className="py-0.5 text-center w-16">Room Details</th>
                <th className="py-0.5 text-right w-16">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {receipts.length > 0 ? (
                receipts.map((r, idx) => (
                  <tr key={idx} className="text-black">
                    <td className="py-0.5 whitespace-nowrap">{formatDateForDisplay(r.date)}</td>
                    <td className="py-0.5">{r.description || r.desc || bill.paymentType || 'Cash'}</td>
                    <td className="py-0.5 font-mono">{r.refNo || '-'}</td>
                    <td className="py-0.5 text-center">{r.roomDetails || r.room || bill.roomNumber || '-'}</td>
                    <td className="py-0.5 text-right font-mono">{formatNumber(r.amount)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-1 text-center text-stone-500 italic">No Advance / Receipt Recorded</td>
                </tr>
              )}
              <tr className="border-t border-b border-black font-bold text-black">
                <td colSpan={4} className="py-0.5 text-right">Total:</td>
                <td className="py-0.5 text-right font-mono">{formatNumber(totalReceiptAmount)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Right Column: TAX SUMMARY */}
        <div className="col-span-5">
          <div className="text-center font-bold text-[11px] text-black pb-1">
            TAX SUMMARY
          </div>
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="border-t border-b border-black text-black font-bold">
                <th className="py-0.5 text-left">Account Name</th>
                <th className="py-0.5 text-right w-20">Taxable Amount</th>
                <th className="py-0.5 text-right w-18">Tax Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {taxSummaryRows.map((t, idx) => (
                <tr key={idx} className="text-black">
                  <td className="py-0.5 font-medium">{t.accountName || t.taxName}</td>
                  <td className="py-0.5 text-right font-mono">{formatNumber(t.taxableAmount)}</td>
                  <td className="py-0.5 text-right font-mono">{formatNumber(t.taxAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Signatures & Footer Section */}
      <div className="pt-8 mt-6">
        <div className="grid grid-cols-3 gap-6 text-[10.5px]">
          {/* Authorized By */}
          <div className="flex flex-col items-center">
            {/* Signature & Seal Visual */}
            <div className="h-16 flex items-center justify-center relative">
              <svg width="100" height="50" viewBox="0 0 120 60" className="opacity-90">
                {/* Blue circular seal stamp */}
                <circle cx="60" cy="30" r="26" fill="none" stroke="#2563EB" strokeWidth="1.2" strokeDasharray="3 2" opacity="0.6" />
                <circle cx="60" cy="30" r="22" fill="none" stroke="#2563EB" strokeWidth="0.8" opacity="0.4" />
                <text x="60" y="22" textAnchor="middle" fontSize="4.5" fill="#1D4ED8" fontWeight="bold" letterSpacing="0.5">
                  ASHRITHA SAI SERVICES
                </text>
                <text x="60" y="32" textAnchor="middle" fontSize="5" fill="#1E40AF" fontWeight="bold">
                  ★ VIZAG ★
                </text>
                <text x="60" y="40" textAnchor="middle" fontSize="4.5" fill="#1D4ED8" fontWeight="bold">
                  PVT LTD
                </text>
                {/* Hand-drawn style blue ink signature */}
                <path 
                  d="M20 40 C35 15, 45 10, 50 25 C55 40, 48 50, 60 20 C68 2, 75 45, 90 28 C98 18, 105 32, 110 30" 
                  fill="none" 
                  stroke="#1E40AF" 
                  strokeWidth="1.8" 
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="font-bold text-black text-center mt-1">
              Authorized By(admin)
            </div>
          </div>

          {/* Verified By */}
          <div className="flex flex-col items-center justify-end">
            <div className="h-16"></div>
            <div className="font-bold text-black text-center">
              Verified By
            </div>
          </div>

          {/* Guest Signature */}
          <div className="flex flex-col items-end text-right">
            <div className="h-16"></div>
            <div className="font-bold text-black">
              Guest Signature ({bill.guestSignatureName || bill.companyDetails || bill.companyName || bill.guestName})
            </div>
            <div className="text-[10px] text-black mt-0.5">
              Place :{bill.guestSignaturePlace || 'VISAKHAPATNAM-530016'}
            </div>
            <div className="text-[10px] text-black mt-0.5">
              Date : {formatDateForDisplay(bill.billDate)}
            </div>
          </div>
        </div>
      </div>

      {bill.status === 'void' && (
        <div className="mt-4 border-2 border-red-700 bg-red-50 text-red-900 p-2 text-center font-bold uppercase tracking-widest text-sm">
          *** VOID INVOICE - {bill.voidReason || 'CANCELLED'} ***
        </div>
      )}
    </div>
  );
};
