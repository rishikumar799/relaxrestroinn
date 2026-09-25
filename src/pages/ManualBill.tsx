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
  Percent,
  CreditCard
} from 'lucide-react';
import { Bill, BillLineItem, HotelSettings, PaymentMethod, AdvanceReceiptItem } from '../types';
import { createManualBill } from '../services/billService';
import { getNextInvoiceNumber } from '../services/counterService';
import { getTodayDateString, getCurrentTimeString, formatTime12H } from '../utils/date';
import { formatINR, roundToTwo } from '../utils/currency';
import { formatAmountInWords } from '../utils/numberToWords';
import { calculateLineItem, computeBillTotals, computeTaxSummary } from '../utils/tax';
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
  const [guestEmail, setGuestEmail] = useState('');
  const [idCardNumber, setIdCardNumber] = useState('');
  const [idCardType, setIdCardType] = useState('Voter ID');
  const [paxAdult, setPaxAdult] = useState(1);
  const [paxChild, setPaxChild] = useState(0);

  // Company Details
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyDetails, setCompanyDetails] = useState('');
  const [companyGSTIN, setCompanyGSTIN] = useState('');
  const [refOTA, setRefOTA] = useState('-');
  const [refOTAGSTIN, setRefOTAGSTIN] = useState('-');

  // Location & Meta
  const [stateCode, setStateCode] = useState(settings?.stateCode || '28');
  const [placeOfSupply, setPlaceOfSupply] = useState(settings?.placeOfSupply || 'VISAKHAPATNAM-530016');
  const [authorizedBy, setAuthorizedBy] = useState(settings?.authorizedByName || 'RELAX RESTO INN');
  const [verifiedBy, setVerifiedBy] = useState(settings?.verifiedByName || 'FRONT DESK ADMIN');
  const [guestSignaturePlace, setGuestSignaturePlace] = useState('VISAKHAPATNAM-530016');

  // Stay & Room Details
  const [roomNumber, setRoomNumber] = useState('309');
  const [roomType, setRoomType] = useState('SUIT ROOM');
  const [planType, setPlanType] = useState('CP');
  const [checkInDate, setCheckInDate] = useState(today);
  const [checkInTime, setCheckInTime] = useState('12:00');
  const [checkOutDate, setCheckOutDate] = useState(today);
  const [checkOutTime, setCheckOutTime] = useState('11:00');
  const [bookingId, setBookingId] = useState('');
  const [grcNumber, setGrcNumber] = useState('');
  const [paymentType, setPaymentType] = useState<string>('Wallet');
  const [numberOfDays, setNumberOfDays] = useState(1);
  const [isInterState, setIsInterState] = useState(false);

  // Line items (Supports arbitrary items: Tariff, Food, Laundry, etc.)
  const [lineItems, setLineItems] = useState<BillLineItem[]>([
    {
      id: 'li-1',
      date: today,
      roomDetails: '309-SUIT ROOM',
      description: 'TARIFF',
      rate: 1785.71,
      numberOfDays: 1,
      days: 1,
      value: 1785.71,
      discount: 0,
      total: 1785.71,
      gstRate: 12,
      gstAmount: 214.28,
      netTotal: 1999.99,
      hsn: '996311',
    }
  ]);

  // Advance Receipts List
  const [receipts, setReceipts] = useState<AdvanceReceiptItem[]>([
    {
      date: today,
      description: 'Bank ( Wallet )',
      refNo: 'A-R-0056-24-25',
      roomDetails: '309',
      amount: 2280,
    }
  ]);

  const [customRounding, setCustomRounding] = useState<number | undefined>(undefined);
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

  const handleLineItemChange = (idx: number, field: keyof BillLineItem, val: any) => {
    setLineItems(prev => {
      const updated = [...prev];
      const raw = { ...updated[idx], [field]: val };
      updated[idx] = calculateLineItem(raw);
      return updated;
    });
  };

  const addLineItem = (type: 'tariff' | 'food' | 'other' = 'tariff') => {
    const defaultDesc = type === 'food' ? 'Food Charges' : (type === 'tariff' ? 'TARIFF' : 'EXTRA SERVICE');
    const defaultRate = type === 'food' ? 266.80 : (type === 'tariff' ? 1785.71 : 500);
    const defaultGST = type === 'food' ? 5 : 12;
    const defaultHsn = type === 'food' ? '996331' : '996311';

    const newItem = calculateLineItem({
      id: `li-${Date.now()}`,
      date: billDate,
      roomDetails: `${roomNumber}-${roomType}`,
      description: defaultDesc,
      rate: defaultRate,
      numberOfDays: type === 'food' ? '-' : 1,
      value: defaultRate,
      discount: 0,
      gstRate: defaultGST,
      hsn: defaultHsn,
    });

    setLineItems(prev => [...prev, newItem]);
  };

  const removeLineItem = (idx: number) => {
    if (lineItems.length <= 1) {
      toast.warning('Row Required', 'Invoice must have at least one line item.');
      return;
    }
    setLineItems(prev => prev.filter((_, i) => i !== idx));
  };

  // Receipt rows
  const handleReceiptChange = (idx: number, field: keyof AdvanceReceiptItem, val: any) => {
    setReceipts(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: field === 'amount' ? (parseFloat(val) || 0) : val };
      return updated;
    });
  };

  const addReceiptRow = () => {
    setReceipts(prev => [
      ...prev,
      {
        date: billDate,
        description: `Bank ( ${paymentType} )`,
        refNo: `REC-${Date.now().toString().slice(-4)}`,
        roomDetails: roomNumber,
        amount: 0,
      }
    ]);
  };

  const removeReceiptRow = (idx: number) => {
    setReceipts(prev => prev.filter((_, i) => i !== idx));
  };

  // Calculations
  const totalAdvance = receipts.reduce((sum, r) => sum + (r.amount || 0), 0);
  const totals = computeBillTotals(lineItems, totalAdvance, customRounding);
  const taxSummary = computeTaxSummary(lineItems, isInterState);

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

      const paxText = `(Adult : ${paxAdult}, Child : ${paxChild})`;
      const roomDetailsStr = `${roomNumber}-${roomType.toUpperCase()} ( Plan Type : ${planType} )`;

      const manualPayload: Partial<Bill> = {
        billNo: billNo.trim(),
        billDate,
        billTime,
        billType: 'manual',
        status: totals.balance <= 0 ? 'paid' : (totalAdvance > 0 ? 'partially_paid' : 'pending'),
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim(),
        guestAddress: guestAddress.trim(),
        guestEmail: guestEmail.trim(),
        paxAdult,
        paxChild,
        pax: paxText,
        idCardNumber: idCardNumber.trim(),
        idCardType,
        companyName: companyName.trim(),
        companyAddress: companyAddress.trim(),
        companyDetails: companyDetails.trim() || companyName.trim(),
        companyGSTIN: companyGSTIN.trim(),
        refOTA: refOTA.trim() || '-',
        refOTAGSTIN: refOTAGSTIN.trim() || '-',
        stateCode: stateCode.trim() || '28',
        placeOfSupply: placeOfSupply.trim() || 'VISAKHAPATNAM-530016',
        roomNumber: roomNumber.trim(),
        roomType: roomType.trim(),
        roomDetails: roomDetailsStr,
        planType: planType.trim(),
        checkInDate,
        checkInTime,
        checkOutDate,
        checkOutTime,
        bookingId: bookingId.trim(),
        reservationId: bookingId.trim(),
        grcNumber: grcNumber.trim(),
        paymentType,
        numberOfDays,
        lineItems,
        subtotal: totals.subtotal,
        roundingAmount: totals.roundingAmount,
        grossTotalBeforeRounding: totals.grossTotalBeforeRounding,
        grossTotal: totals.grossTotal,
        advance: totalAdvance,
        balance: totals.balance,
        amountInWords: totals.amountInWords,
        discount: totals.totalDiscount,
        taxableAmount: totals.subtotal,
        cgst: isInterState ? 0 : roundToTwo(totals.totalGST / 2),
        sgst: isInterState ? 0 : roundToTwo(totals.totalGST / 2),
        igst: isInterState ? totals.totalGST : 0,
        totalGST: totals.totalGST,
        isInterState,
        advanceReceiptDetails: receipts,
        advanceDetails: receipts,
        taxSummary,
        authorizedBy: authorizedBy.trim(),
        verifiedBy: verifiedBy.trim(),
        guestSignatureName: companyDetails.trim() || companyName.trim() || guestName.trim(),
        guestSignaturePlace: guestSignaturePlace.trim(),
        notes: notes.trim(),
      };

      const savedBill = await createManualBill(manualPayload);
      toast.success('Tax Bill Saved', `Invoice #${savedBill.billNo} has been stored successfully.`);
      onSuccess(savedBill);
    } catch (err: any) {
      console.error('Manual bill save error:', err);
      toast.error('Save Failed', err.message || 'Could not save bill.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-12 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-amber-950 font-['Outfit',sans-serif]">
            Create / Replicate Tax Invoice
          </h1>
          <p className="text-xs text-stone-600 mt-0.5">
            Full support for Relax Resto Inn invoice format with multiple tax rates (12% Room, 5% Food), pax, rounding & advance receipts.
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
            <span>Invoice Identification & Location</span>
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
                placeholder="e.g. A-0062-24-25"
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
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                State Code
              </label>
              <input
                type="text"
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value)}
                placeholder="28"
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                Place of Supply
              </label>
              <input
                type="text"
                value={placeOfSupply}
                onChange={(e) => setPlaceOfSupply(e.target.value)}
                placeholder="VISAKHAPATNAM-530016"
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
              <span>Guest & Company Details</span>
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
                  placeholder="Mr. JUBLIANT AGRI AND CONSUMER PRODUCTS LIMITED"
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs font-bold uppercase"
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
                    placeholder="9676755195"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Address / City
                  </label>
                  <input
                    type="text"
                    value={guestAddress}
                    onChange={(e) => setGuestAddress(e.target.value)}
                    placeholder="Kakinada"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Pax (Adults)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={paxAdult}
                    onChange={(e) => setPaxAdult(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Pax (Children)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={paxChild}
                    onChange={(e) => setPaxChild(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    ID Card Type
                  </label>
                  <select
                    value={idCardType}
                    onChange={(e) => setIdCardType(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs font-bold"
                  >
                    <option value="Voter ID">Voter ID</option>
                    <option value="Aadhaar Card">Aadhaar Card</option>
                    <option value="Passport">Passport</option>
                    <option value="Driving License">Driving License</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    ID Card Number
                  </label>
                  <input
                    type="text"
                    value={idCardNumber}
                    onChange={(e) => setIdCardNumber(e.target.value)}
                    placeholder="WZB0507707"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  Company Details
                </label>
                <input
                  type="text"
                  value={companyDetails}
                  onChange={(e) => setCompanyDetails(e.target.value)}
                  placeholder="JUBLIANT AGRI AND CONSUMER PRODUCTS HYDERABAD"
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  Company GSTIN
                </label>
                <input
                  type="text"
                  value={companyGSTIN}
                  onChange={(e) => setCompanyGSTIN(e.target.value)}
                  placeholder="36AADCC4657M1ZA"
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs font-mono uppercase"
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
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Room No.
                  </label>
                  <input
                    type="text"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="309"
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
                    placeholder="SUIT ROOM"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs uppercase font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Plan Type
                  </label>
                  <input
                    type="text"
                    value={planType}
                    onChange={(e) => setPlanType(e.target.value)}
                    placeholder="CP"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs uppercase font-bold text-center"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1 flex items-center justify-between">
                    <span>Checkin Date & Time</span>
                    <span className="text-[10px] text-orange-600 font-mono font-bold">{formatTime12H(checkInTime)}</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={checkInDate}
                      onChange={(e) => setCheckInDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs font-medium"
                    />
                    <input
                      type="time"
                      value={checkInTime}
                      onChange={(e) => setCheckInTime(e.target.value)}
                      className="w-28 px-2.5 py-1.5 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs font-medium"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    <button
                      type="button"
                      onClick={() => setCheckInTime(getCurrentTimeString())}
                      className="text-[10px] px-1.5 py-0.5 bg-orange-100 hover:bg-orange-200 text-orange-800 rounded font-bold cursor-pointer"
                    >
                      Now
                    </button>
                    <button
                      type="button"
                      onClick={() => setCheckInTime('10:00')}
                      className="text-[10px] px-1.5 py-0.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded font-medium cursor-pointer"
                    >
                      10 AM
                    </button>
                    <button
                      type="button"
                      onClick={() => setCheckInTime('12:00')}
                      className="text-[10px] px-1.5 py-0.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded font-medium cursor-pointer"
                    >
                      12 PM
                    </button>
                    <button
                      type="button"
                      onClick={() => setCheckInTime('14:00')}
                      className="text-[10px] px-1.5 py-0.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded font-medium cursor-pointer"
                    >
                      2 PM
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1 flex items-center justify-between">
                    <span>Checkout Date & Time</span>
                    <span className="text-[10px] text-orange-600 font-mono font-bold">{formatTime12H(checkOutTime)}</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={checkOutDate}
                      onChange={(e) => setCheckOutDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs font-medium"
                    />
                    <input
                      type="time"
                      value={checkOutTime}
                      onChange={(e) => setCheckOutTime(e.target.value)}
                      className="w-28 px-2.5 py-1.5 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs font-medium"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    <button
                      type="button"
                      onClick={() => setCheckOutTime(getCurrentTimeString())}
                      className="text-[10px] px-1.5 py-0.5 bg-orange-100 hover:bg-orange-200 text-orange-800 rounded font-bold cursor-pointer"
                    >
                      Now
                    </button>
                    <button
                      type="button"
                      onClick={() => setCheckOutTime('11:00')}
                      className="text-[10px] px-1.5 py-0.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded font-medium cursor-pointer"
                    >
                      11 AM
                    </button>
                    <button
                      type="button"
                      onClick={() => setCheckOutTime('12:00')}
                      className="text-[10px] px-1.5 py-0.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded font-medium cursor-pointer"
                    >
                      12 PM
                    </button>
                    <button
                      type="button"
                      onClick={() => setCheckOutTime('18:00')}
                      className="text-[10px] px-1.5 py-0.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded font-medium cursor-pointer"
                    >
                      6 PM
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Booking / Reservation ID
                  </label>
                  <input
                    type="text"
                    value={bookingId}
                    onChange={(e) => setBookingId(e.target.value)}
                    placeholder="1235"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs font-mono"
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
                    placeholder="G59-24-25"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs font-mono"
                  />
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
                    placeholder="-"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Ref / OTA GSTIN
                  </label>
                  <input
                    type="text"
                    value={refOTAGSTIN}
                    onChange={(e) => setRefOTAGSTIN(e.target.value)}
                    placeholder="-"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Pay Type
                  </label>
                  <input
                    type="text"
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value)}
                    placeholder="Wallet / UPI / Cash"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    No. Of Days
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={numberOfDays}
                    onChange={(e) => setNumberOfDays(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs font-mono font-bold"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Line Items Table Editor */}
        <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200/80 shadow-xs p-5 space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-2 border-b border-amber-100 pb-2">
            <div className="flex items-center gap-2 text-amber-950 font-bold font-['Outfit',sans-serif] text-sm">
              <Calculator className="w-4 h-4 text-orange-600" />
              <span>Invoice Line Items (Per-Line GST Calculation)</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => addLineItem('tariff')}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Room Tariff (12%)</span>
              </button>
              <button
                type="button"
                onClick={() => addLineItem('food')}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-900 text-xs font-bold cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Food Charges (5%)</span>
              </button>
              <button
                type="button"
                onClick={() => addLineItem('other')}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Custom Row</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border border-stone-200">
              <thead className="bg-amber-50 text-stone-800 font-bold uppercase text-[10px] tracking-wider border-b border-stone-300">
                <tr>
                  <th className="p-2 w-28">Date</th>
                  <th className="p-2 w-32">Room Details</th>
                  <th className="p-2">Description</th>
                  <th className="p-2 w-20 text-right">Rate</th>
                  <th className="p-2 w-16 text-center">No Of Days</th>
                  <th className="p-2 w-20 text-right">Value</th>
                  <th className="p-2 w-16 text-right">Disc</th>
                  <th className="p-2 w-20 text-right">Total</th>
                  <th className="p-2 w-20 text-right">GST Rate %</th>
                  <th className="p-2 w-20 text-right">GST</th>
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
                        value={item.roomDetails || ''}
                        onChange={(e) => handleLineItemChange(idx, 'roomDetails', e.target.value)}
                        placeholder="309-SUIT ROOM"
                        className="w-full px-1.5 py-1 bg-white border border-stone-300 rounded text-[11px] font-sans uppercase font-medium"
                      />
                    </td>
                    <td className="p-1.5">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => handleLineItemChange(idx, 'description', e.target.value)}
                        placeholder="TARIFF / Food Charges"
                        className="w-full px-1.5 py-1 bg-white border border-stone-300 rounded text-[11px] font-sans font-bold uppercase"
                      />
                    </td>
                    <td className="p-1.5">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.rate}
                        onChange={(e) => handleLineItemChange(idx, 'rate', e.target.value)}
                        className="w-full px-1.5 py-1 bg-white border border-stone-300 rounded text-[11px] text-right font-bold"
                      />
                    </td>
                    <td className="p-1.5">
                      <input
                        type="text"
                        value={item.numberOfDays !== undefined ? item.numberOfDays : '1'}
                        onChange={(e) => handleLineItemChange(idx, 'numberOfDays', e.target.value)}
                        placeholder="1 or -"
                        className="w-full px-1.5 py-1 bg-white border border-stone-300 rounded text-[11px] text-center font-bold"
                      />
                    </td>
                    <td className="p-1.5 text-right font-semibold text-stone-900">
                      {formatINR(item.value)}
                    </td>
                    <td className="p-1.5">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.discount}
                        onChange={(e) => handleLineItemChange(idx, 'discount', e.target.value)}
                        className="w-full px-1.5 py-1 bg-white border border-stone-300 rounded text-[11px] text-right"
                      />
                    </td>
                    <td className="p-1.5 text-right font-bold text-stone-900">
                      {formatINR(item.total)}
                    </td>
                    <td className="p-1.5">
                      <select
                        value={item.gstRate}
                        onChange={(e) => handleLineItemChange(idx, 'gstRate', parseFloat(e.target.value) || 0)}
                        className="w-full px-1 py-1 bg-white border border-stone-300 rounded text-[11px] font-bold text-right"
                      >
                        <option value="12">12%</option>
                        <option value="5">5%</option>
                        <option value="18">18%</option>
                        <option value="0">0%</option>
                        <option value="28">28%</option>
                      </select>
                    </td>
                    <td className="p-1.5 text-right font-medium text-stone-700">
                      {formatINR(item.gstAmount || 0)}
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
        </div>

        {/* Section 4: Advance / Receipt Details & Tax Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Advance / Receipt Details Table */}
          <div className="lg:col-span-7 bg-[#FFFDF9] rounded-2xl border border-amber-200/80 shadow-xs p-5 space-y-3">
            <div className="flex justify-between items-center border-b border-amber-100 pb-2">
              <div className="flex items-center gap-2 text-amber-950 font-bold font-['Outfit',sans-serif] text-sm">
                <CreditCard className="w-4 h-4 text-orange-600" />
                <span>Advance / Receipt Details Table</span>
              </div>

              <button
                type="button"
                onClick={addReceiptRow}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-900 text-xs font-bold cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Receipt</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border border-stone-200">
                <thead className="bg-amber-50 text-stone-800 font-bold text-[10px] uppercase border-b border-stone-300">
                  <tr>
                    <th className="p-1.5 w-24">Date</th>
                    <th className="p-1.5">Description</th>
                    <th className="p-1.5 w-24">RefNo</th>
                    <th className="p-1.5 w-16 text-center">Room</th>
                    <th className="p-1.5 w-20 text-right">Amount (₹)</th>
                    <th className="p-1.5 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 font-mono">
                  {receipts.map((r, idx) => (
                    <tr key={idx}>
                      <td className="p-1">
                        <input
                          type="date"
                          value={r.date}
                          onChange={(e) => handleReceiptChange(idx, 'date', e.target.value)}
                          className="w-full px-1 py-0.5 bg-white border border-stone-300 rounded text-[11px] font-sans"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={r.description || ''}
                          onChange={(e) => handleReceiptChange(idx, 'description', e.target.value)}
                          placeholder="Bank ( Wallet )"
                          className="w-full px-1 py-0.5 bg-white border border-stone-300 rounded text-[11px] font-sans"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={r.refNo}
                          onChange={(e) => handleReceiptChange(idx, 'refNo', e.target.value)}
                          placeholder="A-R-0056-24-25"
                          className="w-full px-1 py-0.5 bg-white border border-stone-300 rounded text-[11px]"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={r.roomDetails || roomNumber}
                          onChange={(e) => handleReceiptChange(idx, 'roomDetails', e.target.value)}
                          className="w-full px-1 py-0.5 bg-white border border-stone-300 rounded text-[11px] text-center"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={r.amount}
                          onChange={(e) => handleReceiptChange(idx, 'amount', e.target.value)}
                          className="w-full px-1 py-0.5 bg-white border border-stone-300 rounded text-[11px] text-right font-bold"
                        />
                      </td>
                      <td className="p-1 text-center">
                        <button
                          type="button"
                          onClick={() => removeReceiptRow(idx)}
                          className="text-stone-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-amber-50/50 font-bold text-stone-900 border-t border-stone-300">
                    <td colSpan={4} className="p-1.5 text-right">Total Advance / Receipts:</td>
                    <td className="p-1.5 text-right font-mono font-bold text-emerald-800">{formatINR(totalAdvance)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="pt-2">
              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                Amount in Words Preview:
              </label>
              <div className="p-2.5 bg-amber-50/60 border border-amber-200 rounded-xl text-xs font-semibold text-stone-900">
                {totals.amountInWords}
              </div>
            </div>
          </div>

          {/* Tax Summary & Final Figures */}
          <div className="lg:col-span-5 bg-[#FFFDF9] rounded-2xl border border-amber-200/80 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-amber-100 pb-2">
              <span className="text-amber-950 font-bold font-['Outfit',sans-serif] text-sm">
                Tax Summary & Rounding
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  id="interstateCheck"
                  checked={isInterState}
                  onChange={(e) => setIsInterState(e.target.checked)}
                  className="w-3.5 h-3.5 text-orange-600 rounded cursor-pointer"
                />
                <label htmlFor="interstateCheck" className="text-xs font-bold text-stone-800 cursor-pointer">
                  Inter-State (IGST)
                </label>
              </div>
            </div>

            {/* Generated TAX SUMMARY Table */}
            <table className="w-full text-xs text-left border border-stone-200">
              <thead className="bg-amber-50 text-stone-800 font-bold text-[10px] uppercase border-b border-stone-300">
                <tr>
                  <th className="p-1.5">Account Name</th>
                  <th className="p-1.5 text-right">Taxable (₹)</th>
                  <th className="p-1.5 text-right">Tax (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 font-mono">
                {taxSummary.map((t, idx) => (
                  <tr key={idx}>
                    <td className="p-1.5 font-medium">{t.accountName || t.taxName}</td>
                    <td className="p-1.5 text-right">{formatINR(t.taxableAmount)}</td>
                    <td className="p-1.5 text-right font-bold text-stone-900">{formatINR(t.taxAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Final Balance Calculations Box */}
            <div className="border border-stone-300 rounded-xl bg-stone-50 p-3 space-y-1.5 text-xs">
              <div className="flex justify-between text-stone-700">
                <span className="font-semibold">Sub Total:</span>
                <span className="font-mono font-bold">{formatINR(totals.subtotal)}</span>
              </div>

              <div className="flex justify-between items-center text-stone-700">
                <span className="font-semibold">Rounded:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={customRounding !== undefined ? customRounding : totals.roundingAmount}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setCustomRounding(isNaN(val) ? undefined : val);
                    }}
                    className="w-20 px-1.5 py-0.5 bg-white border border-stone-300 rounded text-right font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-between text-stone-950 font-black text-sm pt-1 border-t border-stone-300">
                <span>Gross Total:</span>
                <span className="font-mono text-orange-950 font-extrabold">{formatINR(totals.grossTotal)}</span>
              </div>

              <div className="flex justify-between text-emerald-800 font-semibold">
                <span>Less Advance:</span>
                <span className="font-mono">-{formatINR(totalAdvance)}</span>
              </div>

              <div className="flex justify-between text-stone-950 font-black text-sm pt-1.5 border-t-2 border-stone-900">
                <span>Balance Due:</span>
                <span className="font-mono text-amber-950 text-base">{formatINR(totals.balance)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 5: Signatories & Submission */}
        <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200/80 shadow-xs p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                Authorized By (Admin)
              </label>
              <input
                type="text"
                value={authorizedBy}
                onChange={(e) => setAuthorizedBy(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs font-medium"
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
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                Guest Signature Place & City
              </label>
              <input
                type="text"
                value={guestSignaturePlace}
                onChange={(e) => setGuestSignaturePlace(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white font-extrabold text-sm shadow-xl shadow-orange-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
          >
            <Save className="w-5 h-5 text-amber-300" />
            <span>{loading ? 'Saving Tax Invoice...' : 'Save & Generate Relax Resto Inn Tax Invoice'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
