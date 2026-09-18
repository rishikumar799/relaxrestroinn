import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Receipt, 
  CheckCircle2, 
  Save, 
  ArrowLeft,
  Building,
  User,
  BedDouble,
  Calculator,
  Percent
} from 'lucide-react';
import { Bill, BillLineItem, HotelSettings, PaymentMethod } from '../types';
import { createManualBill } from '../services/billService';
import { getNextInvoiceNumber } from '../services/counterService';
import { getTodayDateString, getCurrentTimeString } from '../utils/date';
import { formatINR, roundToTwo } from '../utils/currency';
import { convertAmountToWords } from '../utils/numberToWords';
import { useToast } from '../components/common/Toast';

interface ManualBillProps {
  settings?: HotelSettings;
  onSuccess: (bill: Bill) => void;
  onCancel: () => void;
}

export const ManualBill: React.FC<ManualBillProps> = ({
  settings,
  onSuccess,
  onCancel,
}) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const today = getTodayDateString();
  const timeNow = getCurrentTimeString();

  // Basic Header & Numbering
  const [billNo, setBillNo] = useState('');
  const [billDate, setBillDate] = useState(today);
  const [billTime, setBillTime] = useState(timeNow);

  // Guest Details
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestAddress, setGuestAddress] = useState('');
  const [idCardNumber, setIdCardNumber] = useState('');
  const [idCardType, setIdCardType] = useState('Aadhaar Card');
  const [pax, setPax] = useState('1 Adult');

  // Company Details
  const [companyDetails, setCompanyDetails] = useState('');
  const [companyGSTIN, setCompanyGSTIN] = useState('');
  const [refOTA, setRefOTA] = useState('');
  const [refOTAGSTIN, setRefOTAGSTIN] = useState('');

  // Location & Meta
  const [stateCode, setStateCode] = useState(settings?.stateCode || '37');
  const [placeOfSupply, setPlaceOfSupply] = useState(settings?.placeOfSupply || 'ANDHRA PRADESH (37)');
  const [authorizedBy, setAuthorizedBy] = useState(settings?.authorizedByName || 'RELAX RESTO INN');
  const [verifiedBy, setVerifiedBy] = useState(settings?.verifiedByName || 'FRONT DESK ADMIN');
  const [guestSignaturePlace, setGuestSignaturePlace] = useState('VISAKHAPATNAM');

  // Stay & Room Details
  const [roomNumber, setRoomNumber] = useState('210');
  const [roomType, setRoomType] = useState('Deluxe Room');
  const [planType, setPlanType] = useState('EP');
  const [roomDetails, setRoomDetails] = useState('TARIFF (210-DELUX ROOM)');
  const [checkInDate, setCheckInDate] = useState(today);
  const [checkInTime, setCheckInTime] = useState('12:00');
  const [checkOutDate, setCheckOutDate] = useState(today);
  const [checkOutTime, setCheckOutTime] = useState('11:00');
  const [bookingId, setBookingId] = useState('');
  const [grcNumber, setGrcNumber] = useState('');
  const [paymentType, setPaymentType] = useState<PaymentMethod>('Cash');
  const [numberOfDays, setNumberOfDays] = useState(1);
  const [isInterState, setIsInterState] = useState(false);

  // Line items
  const [lineItems, setLineItems] = useState<BillLineItem[]>([
    {
      id: 'li-1',
      date: today,
      description: 'TARIFF (210-DELUX ROOM)',
      hsn: settings?.hsnCode || '996311',
      rate: 1500,
      days: 1,
      value: 1500,
      discount: 0,
      total: 1500,
      gst: 180,
      netTotal: 1680,
    }
  ]);

  const [advance, setAdvance] = useState(0);
  const [notes, setNotes] = useState('');

  // Auto load next invoice number
  useEffect(() => {
    const fetchNextSeq = async () => {
      try {
        const nextNum = await getNextInvoiceNumber();
        setBillNo(nextNum);
      } catch (err) {
        console.error(err);
      }
    };
    fetchNextSeq();
  }, []);

  // Update roomDetails if roomNumber or type changes
  useEffect(() => {
    setRoomDetails(`TARIFF (${roomNumber}-${(roomType || 'ROOM').toUpperCase()})`);
  }, [roomNumber, roomType]);

  const handleLineItemChange = (idx: number, field: keyof BillLineItem, val: any) => {
    setLineItems(prev => {
      const updated = [...prev];
      const item = { ...updated[idx], [field]: val };

      // Recompute row totals if rate, days, discount or gst change
      if (field === 'rate' || field === 'days' || field === 'discount') {
        const r = parseFloat(String(item.rate)) || 0;
        const d = parseFloat(String(item.days)) || 1;
        const disc = parseFloat(String(item.discount)) || 0;
        const valTotal = roundToTwo(r * d);
        const taxable = Math.max(0, roundToTwo(valTotal - disc));
        const gstRate = 12; // 12% default
        const gstVal = roundToTwo((taxable * gstRate) / 100);
        const netVal = roundToTwo(taxable + gstVal);

        item.value = valTotal;
        item.total = taxable;
        item.gst = gstVal;
        item.netTotal = netVal;
      }

      updated[idx] = item;
      return updated;
    });
  };

  const addLineItem = () => {
    setLineItems(prev => [
      ...prev,
      {
        id: `li-${Date.now()}`,
        date: billDate,
        description: 'EXTRA SERVICE / ROOM TARIFF',
        hsn: settings?.hsnCode || '996311',
        rate: 500,
        days: 1,
        value: 500,
        discount: 0,
        total: 500,
        gst: 60,
        netTotal: 560,
      }
    ]);
  };

  const removeLineItem = (idx: number) => {
    if (lineItems.length <= 1) {
      toast.warning('Row Required', 'Invoice must have at least one line item.');
      return;
    }
    setLineItems(prev => prev.filter((_, i) => i !== idx));
  };

  // Compute overall totals
  const subtotal = roundToTwo(lineItems.reduce((acc, it) => acc + (it.value || 0), 0));
  const totalDiscount = roundToTwo(lineItems.reduce((acc, it) => acc + (it.discount || 0), 0));
  const taxableAmount = roundToTwo(lineItems.reduce((acc, it) => acc + (it.total || 0), 0));
  const totalGST = roundToTwo(lineItems.reduce((acc, it) => acc + (it.gst || 0), 0));
  const grossTotal = roundToTwo(taxableAmount + totalGST);
  const balance = roundToTwo(Math.max(0, grossTotal - advance));

  const cgst = isInterState ? 0 : roundToTwo(totalGST / 2);
  const sgst = isInterState ? 0 : roundToTwo(totalGST - cgst);
  const igst = isInterState ? totalGST : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!guestName.trim()) {
      toast.error('Validation Error', 'Guest Name is required.');
      return;
    }

    if (!billNo.trim()) {
      toast.error('Validation Error', 'Bill Number is required.');
      return;
    }

    try {
      setLoading(true);

      const summary = [
        { accountName: 'TARIFF', amount: subtotal }
      ];

      const advanceDetails = advance > 0 ? [
        {
          date: billDate,
          desc: `ADVANCE (${paymentType})`,
          refNo: bookingId || grcNumber || 'MANUAL-01',
          room: roomNumber,
          amount: advance,
        }
      ] : [];

      const taxSummary = isInterState ? [
        { taxName: 'IGST (12.00%)', taxableAmount, taxAmount: igst }
      ] : [
        { taxName: 'CGST (6.00%)', taxableAmount, taxAmount: cgst },
        { taxName: 'SGST (6.00%)', taxableAmount, taxAmount: sgst },
      ];

      const manualPayload: Partial<Bill> = {
        billNo: billNo.trim(),
        billDate,
        billTime,
        billType: 'manual',
        status: balance <= 0 ? 'paid' : 'partially_paid',
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim(),
        guestAddress: guestAddress.trim(),
        idCardNumber: idCardNumber.trim(),
        idCardType,
        pax,
        companyDetails: companyDetails.trim(),
        companyGSTIN: companyGSTIN.trim(),
        refOTA: refOTA.trim(),
        refOTAGSTIN: refOTAGSTIN.trim(),
        stateCode,
        placeOfSupply,
        roomNumber,
        roomDetails,
        roomType,
        planType,
        checkInDate,
        checkInTime,
        checkOutDate,
        checkOutTime,
        bookingId: bookingId.trim(),
        grcNumber: grcNumber.trim(),
        paymentType,
        numberOfDays,
        lineItems,
        subtotal,
        discount: totalDiscount,
        taxableAmount,
        cgst,
        sgst,
        igst,
        totalGST,
        grossTotal,
        advance,
        balance,
        amountInWords: convertAmountToWords(grossTotal),
        summary,
        advanceDetails,
        taxSummary,
        authorizedBy,
        verifiedBy,
        guestSignatureName: guestName.trim(),
        guestSignaturePlace,
        notes: notes.trim(),
      };

      const savedBill = await createManualBill(manualPayload);
      toast.success('Manual Bill Saved', `Tax Invoice #${savedBill.billNo} stored permanently.`);
      onSuccess(savedBill);
    } catch (err: any) {
      console.error('Manual bill save error:', err);
      toast.error('Save Failed', err.message || 'Could not save manual bill.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-12 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-amber-950 font-['Outfit',sans-serif]">
            Add Manual / Old Tax Bill
          </h1>
          <p className="text-xs text-stone-600 mt-0.5">
            Directly enter historical bills or manual receipts with the exact RELAX RESTO INN layout
          </p>
        </div>

        <button
          onClick={onCancel}
          className="px-4 py-2 text-xs font-bold text-stone-700 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Invoice Header Info */}
        <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200/80 shadow-xs p-5 space-y-4">
          <div className="flex items-center gap-2 text-amber-950 font-bold font-['Outfit',sans-serif] text-sm border-b border-amber-100 pb-2">
            <Receipt className="w-4 h-4 text-orange-600" />
            <span>Invoice Number & Issue Date</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                Bill Number *
              </label>
              <input
                type="text"
                required
                value={billNo}
                onChange={(e) => setBillNo(e.target.value)}
                placeholder="e.g. RRI-0132-24-25"
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                Bill Date *
              </label>
              <input
                type="date"
                required
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                Bill Time
              </label>
              <input
                type="time"
                value={billTime}
                onChange={(e) => setBillTime(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                State Code & Place of Supply
              </label>
              <input
                type="text"
                value={placeOfSupply}
                onChange={(e) => setPlaceOfSupply(e.target.value)}
                placeholder="ANDHRA PRADESH (37)"
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Two-Column Metadata (Guest + Room & OTA) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Guest Information Card */}
          <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200/80 shadow-xs p-5 space-y-3">
            <div className="flex items-center gap-2 text-amber-950 font-bold font-['Outfit',sans-serif] text-sm border-b border-amber-100 pb-2">
              <User className="w-4 h-4 text-orange-600" />
              <span>Guest Details</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  Guest Name *
                </label>
                <input
                  type="text"
                  required
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="e.g. S. PRASAD RAO"
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Mobile Number
                  </label>
                  <input
                    type="tel"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="e.g. 9440123456"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    No. Of Pax
                  </label>
                  <input
                    type="text"
                    value={pax}
                    onChange={(e) => setPax(e.target.value)}
                    placeholder="2 Adults, 0 Child"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  Address & City
                </label>
                <input
                  type="text"
                  value={guestAddress}
                  onChange={(e) => setGuestAddress(e.target.value)}
                  placeholder="e.g. Vizianagaram"
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    ID Card Number
                  </label>
                  <input
                    type="text"
                    value={idCardNumber}
                    onChange={(e) => setIdCardNumber(e.target.value)}
                    placeholder="e.g. 8765 4321 0987"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={companyDetails}
                    onChange={(e) => setCompanyDetails(e.target.value)}
                    placeholder="e.g. Sai Constructions"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  Company GSTIN
                </label>
                <input
                  type="text"
                  value={companyGSTIN}
                  onChange={(e) => setCompanyGSTIN(e.target.value)}
                  placeholder="e.g. 37AAAAA0000A1Z5"
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* Room, Dates & Reference Card */}
          <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200/80 shadow-xs p-5 space-y-3">
            <div className="flex items-center gap-2 text-amber-950 font-bold font-['Outfit',sans-serif] text-sm border-b border-amber-100 pb-2">
              <BedDouble className="w-4 h-4 text-orange-600" />
              <span>Room & Stay Schedule</span>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Room Number
                  </label>
                  <input
                    type="text"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="210"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Room Type
                  </label>
                  <input
                    type="text"
                    value={roomType}
                    onChange={(e) => setRoomType(e.target.value)}
                    placeholder="Deluxe Room"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  Room Details (Tariff Header in Invoice)
                </label>
                <input
                  type="text"
                  value={roomDetails}
                  onChange={(e) => setRoomDetails(e.target.value)}
                  placeholder="TARIFF (210-DELUX ROOM)"
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs font-mono font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Checkin Date
                  </label>
                  <input
                    type="date"
                    value={checkInDate}
                    onChange={(e) => setCheckInDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Checkout Date
                  </label>
                  <input
                    type="date"
                    value={checkOutDate}
                    onChange={(e) => setCheckOutDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Number of Days
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={numberOfDays}
                    onChange={(e) => setNumberOfDays(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs font-bold"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Card">Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Credit">Credit</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Ref / OTA
                  </label>
                  <input
                    type="text"
                    value={refOTA}
                    onChange={(e) => setRefOTA(e.target.value)}
                    placeholder="Direct Walk-in / MMT"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    GRC Number
                  </label>
                  <input
                    type="text"
                    value={grcNumber}
                    onChange={(e) => setGrcNumber(e.target.value)}
                    placeholder="GRC-01"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Line Items Table Editor */}
        <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200/80 shadow-xs p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-amber-100 pb-2">
            <div className="flex items-center gap-2 text-amber-950 font-bold font-['Outfit',sans-serif] text-sm">
              <Calculator className="w-4 h-4 text-orange-600" />
              <span>Billing Line Items (Tariff & Extras)</span>
            </div>

            <button
              type="button"
              onClick={addLineItem}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-900 text-xs font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Row</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border border-stone-200">
              <thead className="bg-amber-50 text-stone-800 font-bold uppercase text-[10px] tracking-wider border-b border-stone-300">
                <tr>
                  <th className="p-2 w-28">Date</th>
                  <th className="p-2">Description</th>
                  <th className="p-2 w-20">HSN</th>
                  <th className="p-2 w-20 text-right">Rate</th>
                  <th className="p-2 w-16 text-center">Days</th>
                  <th className="p-2 w-20 text-right">Value</th>
                  <th className="p-2 w-16 text-right">Disc</th>
                  <th className="p-2 w-20 text-right">Total</th>
                  <th className="p-2 w-16 text-right">GST</th>
                  <th className="p-2 w-20 text-right">Net Total</th>
                  <th className="p-2 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 font-mono">
                {lineItems.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-amber-50/30">
                    <td className="p-1.5">
                      <input
                        type="date"
                        value={item.date}
                        onChange={(e) => handleLineItemChange(idx, 'date', e.target.value)}
                        className="w-full px-1.5 py-1 bg-white border border-stone-300 rounded text-[11px] font-sans"
                      />
                    </td>
                    <td className="p-1.5">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => handleLineItemChange(idx, 'description', e.target.value)}
                        className="w-full px-1.5 py-1 bg-white border border-stone-300 rounded text-[11px] font-sans font-semibold"
                      />
                    </td>
                    <td className="p-1.5">
                      <input
                        type="text"
                        value={item.hsn}
                        onChange={(e) => handleLineItemChange(idx, 'hsn', e.target.value)}
                        className="w-full px-1.5 py-1 bg-white border border-stone-300 rounded text-[11px] text-center"
                      />
                    </td>
                    <td className="p-1.5">
                      <input
                        type="number"
                        min="0"
                        value={item.rate}
                        onChange={(e) => handleLineItemChange(idx, 'rate', e.target.value)}
                        className="w-full px-1.5 py-1 bg-white border border-stone-300 rounded text-[11px] text-right"
                      />
                    </td>
                    <td className="p-1.5">
                      <input
                        type="number"
                        min="1"
                        value={item.days}
                        onChange={(e) => handleLineItemChange(idx, 'days', e.target.value)}
                        className="w-full px-1.5 py-1 bg-white border border-stone-300 rounded text-[11px] text-center"
                      />
                    </td>
                    <td className="p-1.5 text-right font-semibold text-stone-900">
                      {formatINR(item.value)}
                    </td>
                    <td className="p-1.5">
                      <input
                        type="number"
                        min="0"
                        value={item.discount}
                        onChange={(e) => handleLineItemChange(idx, 'discount', e.target.value)}
                        className="w-full px-1.5 py-1 bg-white border border-stone-300 rounded text-[11px] text-right"
                      />
                    </td>
                    <td className="p-1.5 text-right font-bold text-stone-900">
                      {formatINR(item.total)}
                    </td>
                    <td className="p-1.5 text-right text-stone-700">
                      {formatINR(item.gst)}
                    </td>
                    <td className="p-1.5 text-right font-black text-amber-950">
                      {formatINR(item.netTotal)}
                    </td>
                    <td className="p-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => removeLineItem(idx)}
                        className="p-1 text-stone-400 hover:text-red-600 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Summary */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pt-4 border-t border-amber-100">
            <div className="space-y-2 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="manualInterstate"
                  checked={isInterState}
                  onChange={(e) => setIsInterState(e.target.checked)}
                  className="w-4 h-4 text-orange-600 rounded cursor-pointer"
                />
                <label htmlFor="manualInterstate" className="text-xs font-bold text-stone-800 cursor-pointer">
                  Inter-State Supply (Apply IGST instead of CGST + SGST)
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  Advance / Paid Amount (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={advance}
                  onChange={(e) => setAdvance(parseFloat(e.target.value) || 0)}
                  className="w-48 px-3 py-1.5 bg-amber-50/70 border border-amber-300 rounded-xl text-stone-900 text-xs font-mono font-bold"
                />
              </div>
            </div>

            <div className="w-full sm:w-72 border border-stone-300 rounded-xl bg-stone-50 p-3 space-y-1 text-xs">
              <div className="flex justify-between text-stone-700">
                <span>Sub Total:</span>
                <span className="font-mono font-bold">{formatINR(subtotal)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Discount:</span>
                  <span className="font-mono">-{formatINR(totalDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-stone-700">
                <span>Taxable Amount:</span>
                <span className="font-mono font-bold">{formatINR(taxableAmount)}</span>
              </div>
              <div className="flex justify-between text-stone-700">
                <span>Total GST:</span>
                <span className="font-mono font-bold">{formatINR(totalGST)}</span>
              </div>
              <div className="flex justify-between text-stone-950 font-black text-sm pt-1 border-t border-stone-300">
                <span>Gross Total:</span>
                <span className="font-mono text-orange-950">{formatINR(grossTotal)}</span>
              </div>
              <div className="flex justify-between text-emerald-800 font-semibold">
                <span>Less Advance:</span>
                <span className="font-mono">-{formatINR(advance)}</span>
              </div>
              <div className="flex justify-between text-stone-950 font-black text-sm pt-1 border-t-2 border-stone-900">
                <span>Balance:</span>
                <span className="font-mono text-amber-950">{formatINR(balance)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Signatory & Save */}
        <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200/80 shadow-xs p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                Authorized By (Signatory)
              </label>
              <input
                type="text"
                value={authorizedBy}
                onChange={(e) => setAuthorizedBy(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                Verified By
              </label>
              <input
                type="text"
                value={verifiedBy}
                onChange={(e) => setVerifiedBy(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                Signature Place
              </label>
              <input
                type="text"
                value={guestSignaturePlace}
                onChange={(e) => setGuestSignaturePlace(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white font-extrabold text-sm shadow-xl shadow-orange-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
          >
            <Save className="w-5 h-5 text-amber-300" />
            <span>Save Tax Bill & Open Invoice</span>
          </button>
        </div>
      </form>
    </div>
  );
};
