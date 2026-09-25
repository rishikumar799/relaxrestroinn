import React, { useState, useEffect } from 'react';
import { 
  LogOut, 
  BedDouble, 
  CreditCard, 
  Receipt, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Users, 
  Search,
  Eye,
  Plus
} from 'lucide-react';
import { Stay, Room, Bill, HotelSettings, PaymentMethod } from '../types';
import { getActiveStays, getStayById, subscribeToActiveStays } from '../services/stayService';
import { createCheckoutBill } from '../services/billService';
import { getTodayDateString, getCurrentTimeString, calculateDaysBetween, formatDateForDisplay, formatTime12H } from '../utils/date';
import { formatINR, roundToTwo } from '../utils/currency';
import { useToast } from '../components/common/Toast';
import { ConfirmationModal } from '../components/common/ConfirmationModal';

interface CheckOutProps {
  settings?: HotelSettings;
  preSelectedStayId?: string;
  onCheckOutComplete: (bill: Bill) => void;
  onCancel: () => void;
}

export const CheckOut: React.FC<CheckOutProps> = ({
  settings,
  preSelectedStayId,
  onCheckOutComplete,
  onCancel,
}) => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeStays, setActiveStays] = useState<Stay[]>([]);
  const [selectedStay, setSelectedStay] = useState<Stay | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Checkout inputs
  const today = getTodayDateString();
  const currentTime = getCurrentTimeString();

  const [actualCheckOutDate, setActualCheckOutDate] = useState(today);
  const [actualCheckOutTime, setActualCheckOutTime] = useState(currentTime);
  const [numberOfDays, setNumberOfDays] = useState(1);
  const [manualDaysOverride, setManualDaysOverride] = useState(false);
  
  const [extraCharges, setExtraCharges] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [finalPaymentAmount, setFinalPaymentAmount] = useState(0);
  const [finalPaymentType, setFinalPaymentType] = useState<PaymentMethod>('Cash');
  const [finalPaymentRef, setFinalPaymentRef] = useState('');
  const [checkoutNotes, setCheckoutNotes] = useState('');

  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Load Active Stays and Subscribe to Real-time Changes
  useEffect(() => {
    const loadStays = async () => {
      try {
        setLoading(true);
        const stays = await getActiveStays();
        setActiveStays(stays);

        if (preSelectedStayId) {
          const match = stays.find(s => s.stayId === preSelectedStayId);
          if (match) {
            handleSelectStay(match);
          }
        } else if (stays.length > 0) {
          handleSelectStay(stays[0]);
        }
      } catch (err) {
        console.error('Error loading active stays:', err);
      } finally {
        setLoading(false);
      }
    };
    loadStays();

    const unsub = subscribeToActiveStays((stays) => {
      setActiveStays(stays);
      setLoading(false);
      if (preSelectedStayId) {
        const match = stays.find(s => s.stayId === preSelectedStayId);
        if (match) handleSelectStay(match);
      }
    });

    return () => unsub();
  }, [preSelectedStayId]);

  const handleSelectStay = (stay: Stay) => {
    setSelectedStay(stay);
    const calculatedDays = calculateDaysBetween(stay.checkInDate, today);
    setNumberOfDays(calculatedDays > 0 ? calculatedDays : 1);
    setManualDaysOverride(false);
    setExtraCharges(stay.extraCharges || 0);
    setDiscount(stay.discount || 0);
    setFinalPaymentType(stay.paymentType || 'Cash');
    setFinalPaymentRef('');
    setCheckoutNotes(stay.notes || '');

    // compute estimated balance
    const rVal = roundToTwo((stay.roomTariff || 0) * (calculatedDays > 0 ? calculatedDays : 1));
    const sub = roundToTwo(rVal + (stay.extraCharges || 0));
    const tax = roundToTwo(Math.max(0, sub - (stay.discount || 0)));
    const gstRate = stay.gstRate !== undefined ? stay.gstRate : 12;
    const gst = roundToTwo((tax * gstRate) / 100);
    const gross = roundToTwo(tax + gst);
    const bal = roundToTwo(Math.max(0, gross - (stay.advancePaid || 0)));
    setFinalPaymentAmount(bal);
  };

  // Recalculate days when dates change
  useEffect(() => {
    if (selectedStay && !manualDaysOverride && actualCheckOutDate) {
      const calculated = calculateDaysBetween(selectedStay.checkInDate, actualCheckOutDate);
      setNumberOfDays(calculated > 0 ? calculated : 1);
    }
  }, [selectedStay, actualCheckOutDate, manualDaysOverride]);

  // Recalculate balance when days/extras/discounts change
  useEffect(() => {
    if (selectedStay) {
      const rVal = roundToTwo((selectedStay.roomTariff || 0) * numberOfDays);
      const sub = roundToTwo(rVal + extraCharges);
      const tax = roundToTwo(Math.max(0, sub - discount));
      const gstRate = selectedStay.gstRate !== undefined ? selectedStay.gstRate : 12;
      const gst = roundToTwo((tax * gstRate) / 100);
      const gross = roundToTwo(tax + gst);
      const bal = roundToTwo(Math.max(0, gross - (selectedStay.advancePaid || 0)));
      setFinalPaymentAmount(bal);
    }
  }, [selectedStay, numberOfDays, extraCharges, discount]);

  // Calculations for display
  const roomTariff = selectedStay?.roomTariff || 0;
  const roomValue = roundToTwo(roomTariff * numberOfDays);
  const subtotal = roundToTwo(roomValue + extraCharges);
  const taxableAmount = roundToTwo(Math.max(0, subtotal - discount));
  const gstRate = selectedStay?.gstRate !== undefined ? selectedStay.gstRate : (settings?.defaultGSTRate || 12);
  const totalGST = roundToTwo((taxableAmount * gstRate) / 100);
  const grossTotal = roundToTwo(taxableAmount + totalGST);
  const totalAdvance = roundToTwo(selectedStay?.advancePaid || 0);
  const totalPaymentsPlanned = roundToTwo(totalAdvance + finalPaymentAmount);
  const remainingBalance = roundToTwo(Math.max(0, grossTotal - totalPaymentsPlanned));

  const handleFinalizeCheckout = async () => {
    if (!selectedStay) return;

    try {
      setSubmitting(true);
      const bill = await createCheckoutBill({
        stay: selectedStay,
        actualCheckOutDate,
        actualCheckOutTime,
        numberOfDays,
        extraCharges,
        discount,
        finalPaymentAmount,
        finalPaymentType,
        finalPaymentRef,
        notes: checkoutNotes,
      });

      toast.success('Check-out Completed', `Invoice #${bill.billNo} generated for ${bill.guestName}. Room ${bill.roomNumber} is now Available.`);
      setShowConfirmModal(false);
      onCheckOutComplete(bill);
    } catch (err: any) {
      console.error('Checkout error:', err);
      toast.error('Check-out Failed', err.message || 'Failed to complete check-out.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredStays = activeStays.filter(s => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      s.guestName.toLowerCase().includes(term) ||
      s.roomNumber.toLowerCase().includes(term) ||
      s.guestPhone.includes(term) ||
      (s.bookingId && s.bookingId.toLowerCase().includes(term))
    );
  });

  return (
    <div className="max-w-6xl mx-auto pb-12 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-amber-950 font-['Outfit',sans-serif]">
            Guest Check-out & Final Billing
          </h1>
          <p className="text-xs text-stone-600 mt-0.5">
            Review stay charges, collect balance, free room & generate official Tax Invoice
          </p>
        </div>

        <button
          onClick={onCancel}
          className="px-4 py-2 text-xs font-bold text-stone-700 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
        >
          Back
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-stone-500">
          <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs">Loading active guest stays...</p>
        </div>
      ) : activeStays.length === 0 ? (
        <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200 p-12 text-center shadow-xs">
          <BedDouble className="w-12 h-12 text-amber-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-stone-900">No active checked-in guests</h3>
          <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
            All rooms are currently vacant or checked out. Register a new arrival to begin a stay.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Stays Selector (Col Span 1) */}
          <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200/80 shadow-xs p-4 flex flex-col max-h-[750px]">
            <div className="flex items-center justify-between pb-3 border-b border-amber-100">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-950 font-['Outfit',sans-serif]">
                Active Stays ({activeStays.length})
              </span>
            </div>

            {/* Search filter */}
            <div className="my-3 relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search guest or room..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>

            {/* List */}
            <div className="space-y-2 overflow-y-auto flex-1 pr-1">
              {filteredStays.map((stay) => {
                const isSelected = selectedStay?.stayId === stay.stayId;

                return (
                  <button
                    key={stay.stayId}
                    type="button"
                    onClick={() => handleSelectStay(stay)}
                    className={`
                      w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-start justify-between
                      ${isSelected 
                        ? 'bg-stone-900 text-white border-amber-400 shadow-md' 
                        : 'bg-white hover:bg-amber-50/50 border-stone-200 text-stone-900'
                      }
                    `}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-mono font-black px-1.5 py-0.2 rounded ${
                          isSelected ? 'bg-amber-400 text-stone-950' : 'bg-stone-800 text-amber-300'
                        }`}>
                          {stay.roomNumber}
                        </span>
                        <span className="font-bold text-xs uppercase truncate max-w-[130px]">
                          {stay.guestName}
                        </span>
                      </div>
                      <div className="text-[11px] text-stone-400 mt-1">
                        In: {formatDateForDisplay(stay.checkInDate)}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={`text-xs font-mono font-bold ${isSelected ? 'text-amber-300' : 'text-stone-900'}`}>
                        {formatINR(stay.balanceDue)}
                      </div>
                      <div className="text-[10px] text-stone-400">Due</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Checkout Breakdown & Action (Col Span 2) */}
          {selectedStay && (
            <div className="lg:col-span-2 space-y-6">
              {/* Selected Stay Overview Card */}
              <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200/80 shadow-xs p-5">
                <div className="flex justify-between items-start border-b border-amber-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-lg bg-stone-900 text-amber-300 font-mono font-bold text-sm">
                        Room {selectedStay.roomNumber}
                      </span>
                      <h2 className="text-base font-extrabold uppercase text-stone-900 font-['Outfit',sans-serif]">
                        {selectedStay.guestName}
                      </h2>
                    </div>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Phone: {selectedStay.guestPhone || '-'} • Plan: {selectedStay.planType} • ID: {selectedStay.idNumber || '-'}
                    </p>
                  </div>

                  <span className="text-xs px-2.5 py-1 rounded-full bg-orange-100 text-orange-900 font-bold">
                    Check-in: {formatDateForDisplay(selectedStay.checkInDate)} ({formatTime12H(selectedStay.checkInTime)})
                  </span>
                </div>

                {/* Checkout Dates Adjuster */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      Actual Check-out Date
                    </label>
                    <input
                      type="date"
                      value={actualCheckOutDate}
                      min={selectedStay.checkInDate}
                      onChange={(e) => setActualCheckOutDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-hidden"
                    />
                    <div className="flex gap-1 mt-1.5">
                      <button
                        type="button"
                        onClick={() => setActualCheckOutDate(today)}
                        className="text-[10px] px-2 py-0.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-md font-semibold cursor-pointer"
                      >
                        Today
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1 flex items-center justify-between">
                      <span>Actual Check-out Time</span>
                      <span className="text-[10px] text-orange-600 font-mono font-bold">{formatTime12H(actualCheckOutTime)}</span>
                    </label>
                    <input
                      type="time"
                      value={actualCheckOutTime}
                      onChange={(e) => setActualCheckOutTime(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-hidden"
                    />
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      <button
                        type="button"
                        onClick={() => setActualCheckOutTime(getCurrentTimeString())}
                        className="text-[10px] px-1.5 py-0.5 bg-orange-100 hover:bg-orange-200 text-orange-800 rounded font-bold cursor-pointer"
                        title="Current Time"
                      >
                        Now
                      </button>
                      <button
                        type="button"
                        onClick={() => setActualCheckOutTime('10:00')}
                        className="text-[10px] px-1.5 py-0.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded font-medium cursor-pointer"
                      >
                        10 AM
                      </button>
                      <button
                        type="button"
                        onClick={() => setActualCheckOutTime('11:00')}
                        className="text-[10px] px-1.5 py-0.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded font-medium cursor-pointer"
                      >
                        11 AM
                      </button>
                      <button
                        type="button"
                        onClick={() => setActualCheckOutTime('12:00')}
                        className="text-[10px] px-1.5 py-0.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded font-medium cursor-pointer"
                      >
                        12 PM
                      </button>
                      <button
                        type="button"
                        onClick={() => setActualCheckOutTime('14:00')}
                        className="text-[10px] px-1.5 py-0.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded font-medium cursor-pointer"
                      >
                        2 PM
                      </button>
                      <button
                        type="button"
                        onClick={() => setActualCheckOutTime('18:00')}
                        className="text-[10px] px-1.5 py-0.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded font-medium cursor-pointer"
                      >
                        6 PM
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      Total Stay Days
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={numberOfDays}
                      onChange={(e) => {
                        setManualDaysOverride(true);
                        setNumberOfDays(Math.max(1, parseInt(e.target.value) || 1));
                      }}
                      className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs font-bold focus:ring-2 focus:ring-orange-500 font-mono focus:outline-hidden"
                    />
                    <div className="text-[10px] text-stone-500 mt-1.5 font-mono">
                      {actualCheckOutDate === selectedStay.checkInDate ? 'Same-day Stay' : `${numberOfDays} Day(s) Stay`}
                    </div>
                  </div>
                </div>
              </div>

              {/* Adjustments & Final Payment */}
              <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200/80 shadow-xs p-5 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-950 font-['Outfit',sans-serif] border-b border-amber-100 pb-2">
                  Invoice Adjustments & Settlement
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      Extra Services / Restaurant Charges (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={extraCharges}
                      onChange={(e) => setExtraCharges(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      Discount (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={discount}
                      onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      Settlement Payment Amount (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={finalPaymentAmount}
                      onChange={(e) => setFinalPaymentAmount(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-amber-50/70 border border-amber-300 rounded-xl text-stone-950 text-sm font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      Settlement Payment Mode
                    </label>
                    <select
                      value={finalPaymentType}
                      onChange={(e) => setFinalPaymentType(e.target.value as PaymentMethod)}
                      className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs font-bold"
                    >
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI / QR Code</option>
                      <option value="Card">Credit / Debit Card</option>
                      <option value="Bank Transfer">Bank Transfer / NEFT</option>
                      <option value="Credit">Credit Bill / Ledger</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      Payment Reference / UPI Transaction ID
                    </label>
                    <input
                      type="text"
                      value={finalPaymentRef}
                      onChange={(e) => setFinalPaymentRef(e.target.value)}
                      placeholder="e.g. UPI-928374921 / Card Auth #8831"
                      className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs"
                    />
                  </div>
                </div>

                {/* Final Computation Table */}
                <div className="border border-stone-200 rounded-xl bg-stone-50 p-4 space-y-2 text-xs">
                  <div className="flex justify-between text-stone-700">
                    <span>Room Tariff ({numberOfDays} days @ {formatINR(roomTariff)}):</span>
                    <span className="font-mono font-semibold">{formatINR(roomValue)}</span>
                  </div>
                  {extraCharges > 0 && (
                    <div className="flex justify-between text-stone-700">
                      <span>Extra Services:</span>
                      <span className="font-mono">{formatINR(extraCharges)}</span>
                    </div>
                  )}
                  {discount > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Discount:</span>
                      <span className="font-mono">-{formatINR(discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-stone-900 pt-1 border-t border-stone-200">
                    <span>Taxable Subtotal:</span>
                    <span className="font-mono">{formatINR(taxableAmount)}</span>
                  </div>
                  <div className="flex justify-between text-stone-700">
                    <span>Total GST ({gstRate}%):</span>
                    <span className="font-mono">{formatINR(totalGST)}</span>
                  </div>
                  <div className="flex justify-between text-stone-950 font-black text-sm pt-1.5 border-t border-stone-300">
                    <span>Gross Invoice Total:</span>
                    <span className="font-mono text-orange-950">{formatINR(grossTotal)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-800 font-semibold">
                    <span>Advance Already Paid:</span>
                    <span className="font-mono">-{formatINR(totalAdvance)}</span>
                  </div>
                  {finalPaymentAmount > 0 && (
                    <div className="flex justify-between text-emerald-800 font-semibold">
                      <span>Now Paid ({finalPaymentType}):</span>
                      <span className="font-mono">-{formatINR(finalPaymentAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-stone-950 font-extrabold text-sm pt-1.5 border-t-2 border-stone-900">
                    <span>Final Outstanding Balance:</span>
                    <span className="font-mono text-amber-950">{formatINR(remainingBalance)}</span>
                  </div>
                </div>

                {/* Finalize Button */}
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(true)}
                  disabled={submitting}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white font-extrabold text-sm shadow-xl shadow-orange-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
                >
                  <Receipt className="w-5 h-5 text-amber-300" />
                  <span>Finalize Check-out & Generate Tax Invoice</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmModal}
        title={`Complete Check-out for Room ${selectedStay?.roomNumber}?`}
        message={`This will finalize the stay for ${selectedStay?.guestName}, free Room ${selectedStay?.roomNumber} to 'Available', and create official Tax Invoice with Gross Total of ${formatINR(grossTotal)}.`}
        confirmText={submitting ? 'Finalizing...' : 'Yes, Complete Check-out'}
        onConfirm={handleFinalizeCheckout}
        onCancel={() => setShowConfirmModal(false)}
      />
    </div>
  );
};
