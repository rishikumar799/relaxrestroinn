import React from 'react';
import { Bill, HotelSettings } from '../../types';
import { formatINR, formatNumber } from '../../utils/currency';
import { formatDateForDisplay, formatTime12H } from '../../utils/date';
import { Building, Hotel, Phone, Mail, Globe, MapPin, CheckCircle2 } from 'lucide-react';

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
  const phone = settings?.phone || "0891-2713344, 927345, 962789456, 9912451116";
  const email = settings?.email || "relaxrestroinn@gmail.com";
  const gstin = settings?.gstin || "37AAWCA2881J2ZY";
  const website = settings?.website || "www.ashrithasai.com";

  return (
    <div 
      id={id} 
      className="invoice-container bg-white text-black p-6 sm:p-8 max-w-[850px] mx-auto border border-stone-300 shadow-lg text-[12px] font-sans leading-tight print:shadow-none print:border-none print:p-0 print:m-0"
      style={{ minHeight: '1050px' }}
    >
      {/* Top Header */}
      <div className="border-b-2 border-stone-900 pb-3 mb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1 pr-4">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-amber-950 uppercase font-['Outfit',sans-serif]">
              {hotelName}
            </h1>
            <p className="text-[13px] font-semibold text-stone-800 tracking-wide mt-0.5">
              {legalName}
            </p>
            <p className="text-[11px] font-medium text-stone-700 mt-0.5">
              <span className="font-bold">CIN NO:</span> {cin}
            </p>
            <p className="text-[11px] text-stone-700 mt-0.5 flex items-start gap-1">
              <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-700 print:hidden" />
              <span>{address}</span>
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-stone-800 mt-1">
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3 text-amber-700 print:hidden" />
                <span className="font-bold">Phone:</span> {phone}
              </span>
              <span className="flex items-center gap-1">
                <Mail className="w-3 h-3 text-amber-700 print:hidden" />
                <span className="font-bold">E-mail:</span> {email}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-stone-800 mt-0.5">
              <span>
                <span className="font-bold">GSTIN:</span> <span className="font-mono">{gstin}</span>
              </span>
              <span className="flex items-center gap-1">
                <Globe className="w-3 h-3 text-amber-700 print:hidden" />
                <span className="font-bold">Website:</span> {website}
              </span>
            </div>
          </div>

          <div className="text-right flex flex-col items-end shrink-0 pl-2">
            <div className="border border-stone-900 bg-amber-50/60 print:bg-transparent px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider mb-2 text-stone-900 rounded-sm">
              Original for Recipient
            </div>
            {settings?.logoUrl ? (
              <img 
                src={settings.logoUrl} 
                alt="Hotel Logo" 
                className="h-16 w-auto object-contain border border-stone-200 p-1"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-16 h-16 rounded-md bg-gradient-to-br from-amber-600 via-orange-600 to-red-700 flex flex-col items-center justify-center text-white p-1 border border-amber-800 print:border-stone-900 print:bg-none print:text-black">
                <Hotel className="w-7 h-7 text-amber-100 print:text-black" />
                <span className="text-[8px] font-black tracking-tighter uppercase mt-0.5">RRI</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tax Invoice Banner */}
      <div className="bg-stone-900 text-white print:bg-black print:text-white text-center py-1 font-bold text-sm tracking-widest uppercase mb-3">
        TAX INVOICE
      </div>

      {/* Two-Column Invoice Information Table */}
      <div className="border border-stone-900 mb-3 text-[11px]">
        <div className="grid grid-cols-2 divide-x divide-stone-900">
          {/* Left Column */}
          <div className="p-2 space-y-1.5">
            <div className="flex">
              <span className="w-36 font-bold text-stone-900">Bill No:</span>
              <span className="font-bold font-mono text-stone-950 text-[12px]">{bill.billNo}</span>
            </div>
            <div className="flex">
              <span className="w-36 font-bold text-stone-900">Guest Name:</span>
              <span className="font-bold uppercase text-stone-950">{bill.guestName}</span>
            </div>
            <div className="flex">
              <span className="w-36 font-bold text-stone-900">Address & Mobile No:</span>
              <span className="flex-1 text-stone-800">
                {bill.guestAddress ? `${bill.guestAddress}, ` : ''}{bill.guestPhone || '-'}
              </span>
            </div>
            <div className="flex">
              <span className="w-36 font-bold text-stone-900">Company Details:</span>
              <span className="flex-1 text-stone-800">{bill.companyDetails || '-'}</span>
            </div>
            <div className="flex">
              <span className="w-36 font-bold text-stone-900">Company GSTIN:</span>
              <span className="font-mono text-stone-800">{bill.companyGSTIN || '-'}</span>
            </div>
            <div className="flex">
              <span className="w-36 font-bold text-stone-900">State Code:</span>
              <span className="text-stone-800">{bill.stateCode || '37'}</span>
            </div>
            <div className="flex">
              <span className="w-36 font-bold text-stone-900">Checkin Date:</span>
              <span className="text-stone-800">
                {formatDateForDisplay(bill.checkInDate)} {formatTime12H(bill.checkInTime)}
              </span>
            </div>
            <div className="flex">
              <span className="w-36 font-bold text-stone-900">Booking Id/ReservationID:</span>
              <span className="text-stone-800">{bill.bookingId || '-'}</span>
            </div>
            <div className="flex">
              <span className="w-36 font-bold text-stone-900">Pay Type:</span>
              <span className="font-semibold text-stone-900 uppercase">{bill.paymentType || 'Cash'}</span>
            </div>
          </div>

          {/* Right Column */}
          <div className="p-2 space-y-1.5">
            <div className="flex">
              <span className="w-36 font-bold text-stone-900">Bill Date:</span>
              <span className="font-bold text-stone-950">{formatDateForDisplay(bill.billDate)} {bill.billTime ? formatTime12H(bill.billTime) : ''}</span>
            </div>
            <div className="flex">
              <span className="w-36 font-bold text-stone-900">Room Details:</span>
              <span className="font-semibold uppercase text-stone-900">{bill.roomDetails || `Room ${bill.roomNumber}`}</span>
            </div>
            <div className="flex">
              <span className="w-36 font-bold text-stone-900">No. Of Pax:</span>
              <span className="text-stone-800">{bill.pax || '1 Adult'}</span>
            </div>
            <div className="flex">
              <span className="w-36 font-bold text-stone-900">ID Card Number:</span>
              <span className="font-mono text-stone-800">{bill.idCardNumber || '-'} {bill.idCardType ? `(${bill.idCardType})` : ''}</span>
            </div>
            <div className="flex">
              <span className="w-36 font-bold text-stone-900">Ref / OTA:</span>
              <span className="text-stone-800">{bill.refOTA || '-'}</span>
            </div>
            <div className="flex">
              <span className="w-36 font-bold text-stone-900">Ref / OTA GSTIN:</span>
              <span className="font-mono text-stone-800">{bill.refOTAGSTIN || '-'}</span>
            </div>
            <div className="flex">
              <span className="w-36 font-bold text-stone-900">Place of Supply:</span>
              <span className="text-stone-800">{bill.placeOfSupply || 'ANDHRA PRADESH (37)'}</span>
            </div>
            <div className="flex">
              <span className="w-36 font-bold text-stone-900">Checkout Date:</span>
              <span className="text-stone-800">
                {formatDateForDisplay(bill.checkOutDate)} {formatTime12H(bill.checkOutTime)}
              </span>
            </div>
            <div className="flex">
              <span className="w-36 font-bold text-stone-900">GRC Number:</span>
              <span className="text-stone-800">{bill.grcNumber || '-'}</span>
            </div>
            <div className="flex">
              <span className="w-36 font-bold text-stone-900">No. Of Days:</span>
              <span className="font-semibold text-stone-900">{bill.numberOfDays}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Billing Line-Item Table */}
      <table className="w-full border-collapse border border-stone-900 text-[11px] mb-3">
        <thead>
          <tr className="bg-stone-100 print:bg-stone-200 text-stone-950 font-bold border-b border-stone-900 text-center">
            <th className="border-r border-stone-900 p-1.5 w-20">Date</th>
            <th className="border-r border-stone-900 p-1.5 text-left">Description</th>
            <th className="border-r border-stone-900 p-1.5 w-16">HSN</th>
            <th className="border-r border-stone-900 p-1.5 w-16 text-right">Rate</th>
            <th className="border-r border-stone-900 p-1.5 w-12 text-center">Days</th>
            <th className="border-r border-stone-900 p-1.5 w-20 text-right">Value</th>
            <th className="border-r border-stone-900 p-1.5 w-16 text-right">Disc</th>
            <th className="border-r border-stone-900 p-1.5 w-20 text-right">Total</th>
            <th className="border-r border-stone-900 p-1.5 w-16 text-right">GST</th>
            <th className="p-1.5 w-20 text-right">Net Total</th>
          </tr>
        </thead>
        <tbody>
          {bill.lineItems && bill.lineItems.length > 0 ? (
            bill.lineItems.map((item, idx) => (
              <tr key={item.id || idx} className="border-b border-stone-300 font-mono text-[10.5px]">
                <td className="border-r border-stone-900 p-1.5 text-center font-sans">{formatDateForDisplay(item.date)}</td>
                <td className="border-r border-stone-900 p-1.5 font-sans font-medium text-left">{item.description}</td>
                <td className="border-r border-stone-900 p-1.5 text-center">{item.hsn || '996311'}</td>
                <td className="border-r border-stone-900 p-1.5 text-right">{formatNumber(item.rate)}</td>
                <td className="border-r border-stone-900 p-1.5 text-center">{item.days}</td>
                <td className="border-r border-stone-900 p-1.5 text-right">{formatNumber(item.value)}</td>
                <td className="border-r border-stone-900 p-1.5 text-right">{formatNumber(item.discount)}</td>
                <td className="border-r border-stone-900 p-1.5 text-right font-semibold">{formatNumber(item.total)}</td>
                <td className="border-r border-stone-900 p-1.5 text-right">{formatNumber(item.gst)}</td>
                <td className="p-1.5 text-right font-bold text-stone-950">{formatNumber(item.netTotal)}</td>
              </tr>
            ))
          ) : (
            <tr className="border-b border-stone-300 font-mono text-[10.5px]">
              <td className="border-r border-stone-900 p-1.5 text-center font-sans">{formatDateForDisplay(bill.checkInDate)}</td>
              <td className="border-r border-stone-900 p-1.5 font-sans font-medium text-left">{bill.roomDetails}</td>
              <td className="border-r border-stone-900 p-1.5 text-center">996311</td>
              <td className="border-r border-stone-900 p-1.5 text-right">{formatNumber(bill.subtotal / bill.numberOfDays)}</td>
              <td className="border-r border-stone-900 p-1.5 text-center">{bill.numberOfDays}</td>
              <td className="border-r border-stone-900 p-1.5 text-right">{formatNumber(bill.subtotal)}</td>
              <td className="border-r border-stone-900 p-1.5 text-right">{formatNumber(bill.discount)}</td>
              <td className="border-r border-stone-900 p-1.5 text-right font-semibold">{formatNumber(bill.taxableAmount)}</td>
              <td className="border-r border-stone-900 p-1.5 text-right">{formatNumber(bill.totalGST)}</td>
              <td className="p-1.5 text-right font-bold text-stone-950">{formatNumber(bill.grossTotal)}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Totals Section */}
      <div className="flex justify-end mb-3">
        <div className="w-72 border border-stone-900 text-[11px] font-sans divide-y divide-stone-900">
          <div className="flex justify-between p-1.5 bg-stone-50">
            <span className="font-bold">Sub Total:</span>
            <span className="font-mono font-bold">{formatINR(bill.subtotal)}</span>
          </div>
          {bill.discount > 0 && (
            <div className="flex justify-between p-1.5 text-red-700">
              <span className="font-semibold">Discount:</span>
              <span className="font-mono font-semibold">-{formatINR(bill.discount)}</span>
            </div>
          )}
          <div className="flex justify-between p-1.5 bg-stone-100 font-bold">
            <span>Gross Total:</span>
            <span className="font-mono text-[12px]">{formatINR(bill.grossTotal)}</span>
          </div>
          <div className="flex justify-between p-1.5">
            <span className="font-semibold text-stone-700">Less Advance / Paid:</span>
            <span className="font-mono font-semibold text-emerald-800">-{formatINR(bill.advance)}</span>
          </div>
          <div className="flex justify-between p-1.5 bg-amber-50/70 print:bg-stone-200 font-extrabold text-[12px]">
            <span>Balance Due:</span>
            <span className="font-mono text-stone-950">{formatINR(bill.balance)}</span>
          </div>
        </div>
      </div>

      {/* Amount in Words */}
      <div className="border border-stone-900 p-2 mb-3 bg-stone-50/50 print:bg-transparent text-[11px]">
        <span className="font-bold text-stone-900">Amount in words: </span>
        <span className="font-bold uppercase tracking-wide text-stone-950">
          {bill.amountInWords || 'ZERO RUPEES ONLY'}
        </span>
      </div>

      {/* Three Column Sections: Summary | Advance Details | Tax Summary */}
      <div className="grid grid-cols-3 gap-2 mb-4 text-[10.5px]">
        {/* Summary Table */}
        <div className="border border-stone-900 flex flex-col">
          <div className="bg-stone-200 font-bold p-1 text-center border-b border-stone-900 uppercase">
            SUMMARY
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-300 text-stone-700 font-semibold text-[10px]">
                <th className="text-left p-1">Account Name</th>
                <th className="text-right p-1">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 font-mono">
              {bill.summary && bill.summary.length > 0 ? (
                bill.summary.map((s, idx) => (
                  <tr key={idx}>
                    <td className="p-1 font-sans">{s.accountName}</td>
                    <td className="p-1 text-right">{formatNumber(s.amount)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="p-1 font-sans">TARIFF</td>
                  <td className="p-1 text-right">{formatNumber(bill.subtotal)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Advance / Receipt Details */}
        <div className="border border-stone-900 flex flex-col">
          <div className="bg-stone-200 font-bold p-1 text-center border-b border-stone-900 uppercase">
            ADVANCE / RECEIPT DETAILS
          </div>
          <table className="w-full text-[9.5px]">
            <thead>
              <tr className="border-b border-stone-300 text-stone-700 font-semibold">
                <th className="text-left p-0.5">Date</th>
                <th className="text-left p-0.5">Desc.</th>
                <th className="text-left p-0.5">RefNo</th>
                <th className="text-right p-0.5">Amt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 font-mono">
              {bill.advanceDetails && bill.advanceDetails.length > 0 ? (
                bill.advanceDetails.map((a, idx) => (
                  <tr key={idx}>
                    <td className="p-0.5 font-sans">{formatDateForDisplay(a.date)}</td>
                    <td className="p-0.5 font-sans truncate max-w-[50px]">{a.desc}</td>
                    <td className="p-0.5 truncate max-w-[40px]">{a.refNo || '-'}</td>
                    <td className="p-0.5 text-right">{formatNumber(a.amount)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="p-1 text-center text-stone-500 italic">No advance recorded</td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="mt-auto border-t border-stone-900 p-1 flex justify-between font-bold bg-stone-100 text-[10px]">
            <span>Total:</span>
            <span className="font-mono">{formatNumber(bill.advance)}</span>
          </div>
        </div>

        {/* Tax Summary */}
        <div className="border border-stone-900 flex flex-col">
          <div className="bg-stone-200 font-bold p-1 text-center border-b border-stone-900 uppercase">
            TAX SUMMARY
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-300 text-stone-700 font-semibold text-[10px]">
                <th className="text-left p-1">Tax Name</th>
                <th className="text-right p-1">Taxable</th>
                <th className="text-right p-1">Tax Amt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 font-mono text-[10px]">
              {bill.taxSummary && bill.taxSummary.length > 0 ? (
                bill.taxSummary.map((t, idx) => (
                  <tr key={idx}>
                    <td className="p-1 font-sans">{t.taxName}</td>
                    <td className="p-1 text-right">{formatNumber(t.taxableAmount)}</td>
                    <td className="p-1 text-right font-semibold">{formatNumber(t.taxAmount)}</td>
                  </tr>
                ))
              ) : (
                <>
                  <tr>
                    <td className="p-1 font-sans">CGST (6.00%)</td>
                    <td className="p-1 text-right">{formatNumber(bill.taxableAmount)}</td>
                    <td className="p-1 text-right">{formatNumber(bill.cgst)}</td>
                  </tr>
                  <tr>
                    <td className="p-1 font-sans">SGST (6.00%)</td>
                    <td className="p-1 text-right">{formatNumber(bill.taxableAmount)}</td>
                    <td className="p-1 text-right">{formatNumber(bill.sgst)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
          <div className="mt-auto border-t border-stone-900 p-1 flex justify-between font-bold bg-stone-100 text-[10px]">
            <span>Total GST:</span>
            <span className="font-mono">{formatNumber(bill.totalGST)}</span>
          </div>
        </div>
      </div>

      {/* Signatures & Footer Note */}
      <div className="border-t border-stone-900 pt-6 mt-6">
        <div className="grid grid-cols-3 gap-4 text-center text-[11px] mb-4">
          <div>
            <div className="h-10"></div>
            <div className="border-t border-stone-700 pt-1 font-bold text-stone-900">
              Authorized By (admin)
            </div>
            <div className="text-[10px] text-stone-600 uppercase font-semibold mt-0.5">
              {bill.authorizedBy || hotelName}
            </div>
          </div>

          <div>
            <div className="h-10"></div>
            <div className="border-t border-stone-700 pt-1 font-bold text-stone-900">
              Verified By
            </div>
            <div className="text-[10px] text-stone-600 uppercase font-semibold mt-0.5">
              {bill.verifiedBy || 'FRONT DESK ADMIN'}
            </div>
          </div>

          <div>
            <div className="h-10"></div>
            <div className="border-t border-stone-700 pt-1 font-bold text-stone-900">
              Guest Signature
            </div>
            <div className="text-[10px] text-stone-600 uppercase font-semibold mt-0.5">
              ({bill.guestSignatureName || bill.guestName})
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center text-[10px] text-stone-600 border-t border-dashed border-stone-300 pt-2">
          <span>Date: {formatDateForDisplay(bill.billDate)}</span>
          <span className="italic font-medium">{settings?.invoiceFooter || "Thank you for staying with us! Have a pleasant journey."}</span>
          <span>Place: {bill.guestSignaturePlace || 'VISAKHAPATNAM'}</span>
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
