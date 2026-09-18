import React, { useState, useEffect } from 'react';
import { 
  UserPlus, 
  BedDouble, 
  CreditCard, 
  Calendar, 
  Clock, 
  Building, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  UserCheck, 
  ArrowRight,
  ShieldCheck,
  Percent
} from 'lucide-react';
import { Room, Guest, Stay, HotelSettings, PlanType, PaymentMethod } from '../types';
import { getRooms } from '../services/roomService';
import { findGuestByPhone, findGuestByIdNumber, getGuests } from '../services/guestService';
import { createCheckIn } from '../services/stayService';
import { getTodayDateString, getCurrentTimeString, calculateDaysBetween } from '../utils/date';
import { formatINR, roundToTwo } from '../utils/currency';
import { useToast } from '../components/common/Toast';

interface CheckInProps {
  settings?: HotelSettings;
  onSuccess: (stay: Stay) => void;
  onCancel: () => void;
}

export const CheckIn: React.FC<CheckInProps> = ({
  settings,
  onSuccess,
  onCancel,
}) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [existingGuests, setExistingGuests] = useState<Guest[]>([]);
  const [isRepeatGuest, setIsRepeatGuest] = useState(false);

  // Form State
  const today = getTodayDateString();
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestAddress, setGuestAddress] = useState('');
  const [idType, setIdType] = useState<Stay['idType']>('Aadhaar Card');
  const [idNumber, setIdNumber] = useState('');
  
  const [paxAdults, setPaxAdults] = useState(1);
  const [paxChildren, setPaxChildren] = useState(0);

  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyGSTIN, setCompanyGSTIN] = useState('');

  const [bookingId, setBookingId] = useState('');
  const [grcNumber, setGrcNumber] = useState('');
  const [refOTA, setRefOTA] = useState('');
  const [refOTAGSTIN, setRefOTAGSTIN] = useState('');

  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [selectedRoomNumber, setSelectedRoomNumber] = useState('');
  const [roomType, setRoomType] = useState('Deluxe Room');
  const [planType, setPlanType] = useState<PlanType>('EP');
  
  const [checkInDate, setCheckInDate] = useState(today);
  const [checkInTime, setCheckInTime] = useState(settings?.defaultCheckInTime || '12:00');
  const [expectedCheckOutDate, setExpectedCheckOutDate] = useState(tomorrow);
  const [expectedCheckOutTime, setExpectedCheckOutTime] = useState(settings?.defaultCheckOutTime || '11:00');
  
  const [numberOfDays, setNumberOfDays] = useState(1);
  const [manualDaysOverride, setManualDaysOverride] = useState(false);

  const [roomTariff, setRoomTariff] = useState(1500);
  const [gstRate, setGstRate] = useState(settings?.defaultGSTRate || 12);
  const [isInterState, setIsInterState] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [extraCharges, setExtraCharges] = useState(0);
  const [advancePaid, setAdvancePaid] = useState(0);
  const [paymentType, setPaymentType] = useState<PaymentMethod>('Cash');
  const [notes, setNotes] = useState('');

  // Load Rooms and Guests
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [roomsList, guestsList] = await Promise.all([
          getRooms(),
          getGuests(50)
        ]);
        setRooms(roomsList);
        setExistingGuests(guestsList);

        // Pre-select first available room
        const firstAvailable = roomsList.find(r => r.status === 'Available');
        if (firstAvailable) {
          selectRoom(firstAvailable);
        }
      } catch (err) {
        console.error('Error fetching rooms:', err);
      }
    };
    loadInitialData();
  }, []);

  // Update days when dates change
  useEffect(() => {
    if (!manualDaysOverride && checkInDate && expectedCheckOutDate) {
      const calculated = calculateDaysBetween(checkInDate, expectedCheckOutDate);
      setNumberOfDays(calculated > 0 ? calculated : 1);
    }
  }, [checkInDate, expectedCheckOutDate, manualDaysOverride]);

  const selectRoom = (room: Room) => {
    setSelectedRoomId(room.roomId);
    setSelectedRoomNumber(room.roomNumber);
    setRoomType(room.roomType);
    setPlanType(room.planType || 'EP');
    setRoomTariff(room.tariff || 1500);
  };

  // Check existing guest on phone blur
  const handlePhoneBlur = async () => {
    if (guestPhone.trim().length >= 10) {
      const existing = await findGuestByPhone(guestPhone.trim());
      if (existing) {
        fillGuestDetails(existing);
      }
    }
  };

  const fillGuestDetails = (guest: Guest) => {
    setGuestName(guest.guestName || '');
    setGuestEmail(guest.email || '');
    setGuestAddress(guest.address || '');
    if (guest.idType) setIdType(guest.idType as any);
    if (guest.idNumber) setIdNumber(guest.idNumber);
    if (guest.companyName) setCompanyName(guest.companyName);
    if (guest.companyAddress) setCompanyAddress(guest.companyAddress);
    if (guest.companyGSTIN) setCompanyGSTIN(guest.companyGSTIN);
    setIsRepeatGuest(true);
    toast.info('Guest profile matched', `Loaded records for ${guest.guestName} (${guest.totalStays} previous stays)`);
  };

  // Calculations
  const roomValue = roundToTwo(roomTariff * numberOfDays);
  const subtotal = roundToTwo(roomValue + extraCharges);
  const taxableAmount = roundToTwo(Math.max(0, subtotal - discount));
  const totalGST = roundToTwo((taxableAmount * gstRate) / 100);
  
  const cgst = isInterState ? 0 : roundToTwo(totalGST / 2);
  const sgst = isInterState ? 0 : roundToTwo(totalGST - cgst);
  const igst = isInterState ? totalGST : 0;
  
  const grossTotal = roundToTwo(taxableAmount + totalGST);
  const balanceDue = roundToTwo(Math.max(0, grossTotal - advancePaid));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!guestName.trim()) {
      toast.error('Validation Error', 'Guest Name is required.');
      return;
    }

    if (!selectedRoomId) {
      toast.error('Validation Error', 'Please select a room for check-in.');
      return;
    }

    // Check if room is occupied
    const room = rooms.find(r => r.roomId === selectedRoomId);
    if (room && room.status === 'Occupied') {
      toast.error('Room Occupied', `Room ${room.roomNumber} is currently occupied.`);
      return;
    }

    if (expectedCheckOutDate < checkInDate) {
      toast.error('Invalid Dates', 'Expected check-out date cannot be earlier than check-in date.');
      return;
    }

    try {
      setLoading(true);
      const stayPayload = {
        guestId: '',
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim(),
        guestEmail: guestEmail.trim(),
        guestAddress: guestAddress.trim(),
        idType,
        idNumber: idNumber.trim(),
        roomId: selectedRoomId,
        roomNumber: selectedRoomNumber,
        roomType,
        planType,
        paxAdults,
        paxChildren,
        companyName: companyName.trim(),
        companyAddress: companyAddress.trim(),
        companyGSTIN: companyGSTIN.trim(),
        bookingId: bookingId.trim(),
        grcNumber: grcNumber.trim(),
        refOTA: refOTA.trim(),
        refOTAGSTIN: refOTAGSTIN.trim(),
        checkInDate,
        checkInTime,
        expectedCheckOutDate,
        expectedCheckOutTime,
        numberOfDays,
        roomTariff,
        gstRate,
        isInterState,
        discount,
        extraCharges,
        subtotal,
        taxableAmount,
        cgst,
        sgst,
        igst,
        totalGST,
        grossTotal,
        advancePaid,
        balanceDue,
        paymentType,
        notes: notes.trim(),
      };

      const savedStay = await createCheckIn(stayPayload);
      toast.success('Check-in Successful', `Guest ${guestName} checked in to Room ${selectedRoomNumber}`);
      onSuccess(savedStay);
    } catch (err: any) {
      console.error('Checkin error:', err);
      toast.error('Check-in Failed', err.message || 'Could not complete check-in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-12 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-amber-950 font-['Outfit',sans-serif]">
            New Guest Check-in
          </h1>
          <p className="text-xs text-stone-600 mt-0.5">
            Register arrival, assign room, record advance & allocate stay
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-bold text-stone-700 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Inputs (Col Span 2) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Guest Information */}
          <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200/80 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-amber-100 pb-3">
              <div className="flex items-center gap-2 text-amber-950 font-bold font-['Outfit',sans-serif] text-sm">
                <UserPlus className="w-4 h-4 text-orange-600" />
                <span>Guest Information</span>
              </div>
              {isRepeatGuest && (
                <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                  <UserCheck className="w-3 h-3 text-emerald-600" />
                  <span>Existing Profile Loaded</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  Guest Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="e.g. Ramesh Chandra"
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  onBlur={handlePhoneBlur}
                  placeholder="e.g. 9876543210"
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="guest@example.com"
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  ID Document Type
                </label>
                <select
                  value={idType}
                  onChange={(e) => setIdType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                >
                  <option value="Aadhaar Card">Aadhaar Card</option>
                  <option value="Passport">Passport</option>
                  <option value="Driving License">Driving License</option>
                  <option value="Voter ID">Voter ID</option>
                  <option value="PAN Card">PAN Card</option>
                  <option value="Other">Other Government ID</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  ID Card Number
                </label>
                <input
                  type="text"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder="e.g. 1234 5678 9012"
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Adults
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={paxAdults}
                    onChange={(e) => setPaxAdults(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Children
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="6"
                    value={paxChildren}
                    onChange={(e) => setPaxChildren(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  Full Residential Address / City
                </label>
                <input
                  type="text"
                  value={guestAddress}
                  onChange={(e) => setGuestAddress(e.target.value)}
                  placeholder="e.g. Flat 302, Green Meadows, Hyderabad"
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Room Selection & Stay Dates */}
          <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200/80 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-amber-100 pb-3">
              <div className="flex items-center gap-2 text-amber-950 font-bold font-['Outfit',sans-serif] text-sm">
                <BedDouble className="w-4 h-4 text-orange-600" />
                <span>Room Assignment & Schedule</span>
              </div>
            </div>

            {/* Room selection pills */}
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-2">
                Select Available Room *
              </label>
              {rooms.length === 0 ? (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between">
                  <span>No rooms registered yet. Please add rooms in the <b>Rooms</b> menu first.</span>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {rooms.map((room) => {
                    const isSelected = selectedRoomId === room.roomId;
                    const isAvailable = room.status === 'Available';

                    return (
                      <button
                        type="button"
                        key={room.roomId}
                        disabled={!isAvailable}
                        onClick={() => selectRoom(room)}
                        className={`
                          p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center
                          ${isSelected 
                            ? 'bg-gradient-to-br from-stone-900 to-amber-950 text-white border-amber-400 shadow-md scale-102' 
                            : isAvailable
                            ? 'bg-white hover:border-orange-400 border-stone-300 text-stone-900'
                            : 'bg-stone-100/70 border-stone-200 text-stone-400 opacity-60 cursor-not-allowed'
                          }
                        `}
                      >
                        <span className={`text-xs font-mono font-black ${isSelected ? 'text-amber-300' : 'text-stone-900'}`}>
                          {room.roomNumber}
                        </span>
                        <span className="text-[10px] truncate max-w-full font-medium mt-0.5">
                          {room.roomType.replace(' Room', '')}
                        </span>
                        <span className={`text-[9px] px-1 py-0.2 rounded mt-1 font-bold ${
                          isSelected 
                            ? 'bg-amber-400 text-stone-950' 
                            : isAvailable 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-stone-200 text-stone-600'
                        }`}>
                          {isAvailable ? formatINR(room.tariff) : room.status}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Stay Dates and Plan */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  Check-in Date & Time
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    required
                    value={checkInDate}
                    onChange={(e) => setCheckInDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                  <input
                    type="time"
                    value={checkInTime}
                    onChange={(e) => setCheckInTime(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  Expected Check-out Date & Time
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    required
                    min={checkInDate}
                    value={expectedCheckOutDate}
                    onChange={(e) => setExpectedCheckOutDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                  <input
                    type="time"
                    value={expectedCheckOutTime}
                    onChange={(e) => setExpectedCheckOutTime(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Stay Duration (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={numberOfDays}
                    onChange={(e) => {
                      setManualDaysOverride(true);
                      setNumberOfDays(Math.max(1, parseInt(e.target.value) || 1));
                    }}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Plan Type
                  </label>
                  <select
                    value={planType}
                    onChange={(e) => setPlanType(e.target.value as PlanType)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none font-bold"
                  >
                    <option value="EP">EP (Room Only)</option>
                    <option value="CP">CP (With Breakfast)</option>
                    <option value="MAP">MAP (Breakfast + Dinner)</option>
                    <option value="AP">AP (All Meals)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Room Tariff per Day (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={roomTariff}
                    onChange={(e) => setRoomTariff(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    GST Rate (%)
                  </label>
                  <select
                    value={gstRate}
                    onChange={(e) => setGstRate(parseFloat(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none font-bold"
                  >
                    <option value="12">12% (Standard Hotel GST)</option>
                    <option value="18">18% (Luxury Suite GST)</option>
                    <option value="5">5% (Economy GST)</option>
                    <option value="0">0% (Exempt)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Company & Booking / OTA Details (Collapsible/Optional) */}
          <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200/80 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-amber-100 pb-3">
              <div className="flex items-center gap-2 text-amber-950 font-bold font-['Outfit',sans-serif] text-sm">
                <Building className="w-4 h-4 text-orange-600" />
                <span>Company & OTA Billing Details</span>
              </div>
              <span className="text-[11px] text-stone-400">Optional</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Infosys Technologies Ltd"
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
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
                  placeholder="e.g. 36AABCC1234F1ZH"
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  Booking ID / Reservation Ref
                </label>
                <input
                  type="text"
                  value={bookingId}
                  onChange={(e) => setBookingId(e.target.value)}
                  placeholder="e.g. MMT-9823471"
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
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
                  placeholder="e.g. GRC-2024-0412"
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  Ref / OTA Channel
                </label>
                <input
                  type="text"
                  value={refOTA}
                  onChange={(e) => setRefOTA(e.target.value)}
                  placeholder="e.g. MakeMyTrip / Booking.com / Direct Walk-in"
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
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
                  placeholder="e.g. 07AAACM4152A1ZY"
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Financial Calculation Sidebar (Col Span 1) */}
        <div className="space-y-6">
          <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200/80 shadow-md p-5 space-y-4 sticky top-20">
            <div className="flex items-center gap-2 border-b border-amber-100 pb-3 text-amber-950 font-bold font-['Outfit',sans-serif] text-sm">
              <CreditCard className="w-4 h-4 text-orange-600" />
              <span>Stay Billing Calculation</span>
            </div>

            {/* Financial breakdown inputs */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  Special Discount (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  Extra Charges / Room Services (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={extraCharges}
                  onChange={(e) => setExtraCharges(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none font-mono"
                />
              </div>

              <div className="pt-2 border-t border-amber-100">
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  Advance Paid at Check-in (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  max={grossTotal}
                  value={advancePaid}
                  onChange={(e) => setAdvancePaid(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-amber-50/60 border border-amber-300 rounded-xl text-stone-950 text-sm font-mono font-bold focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  Payment Mode
                </label>
                <select
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none font-bold"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI / QR Code</option>
                  <option value="Card">Credit / Debit Card</option>
                  <option value="Bank Transfer">Bank Transfer / NEFT</option>
                  <option value="Credit">Credit Bill / Company Account</option>
                  <option value="Other">Other Mode</option>
                </select>
              </div>

              {/* Inter-state GST Toggle */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-amber-50/50 border border-amber-200/60">
                <span className="text-[11px] font-bold text-stone-800">Inter-State (IGST)</span>
                <input
                  type="checkbox"
                  checked={isInterState}
                  onChange={(e) => setIsInterState(e.target.checked)}
                  className="w-4 h-4 text-orange-600 rounded border-stone-300 focus:ring-orange-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Computed Ledger Table */}
            <div className="border border-stone-200 rounded-xl bg-stone-50 p-3 space-y-1.5 text-xs">
              <div className="flex justify-between text-stone-600">
                <span>Room Tariff ({numberOfDays}d × {formatINR(roomTariff)}):</span>
                <span className="font-mono font-semibold">{formatINR(roomValue)}</span>
              </div>
              {extraCharges > 0 && (
                <div className="flex justify-between text-stone-600">
                  <span>Extras:</span>
                  <span className="font-mono">{formatINR(extraCharges)}</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Discount:</span>
                  <span className="font-mono">-{formatINR(discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-stone-800 pt-1 border-t border-stone-200">
                <span>Taxable Amount:</span>
                <span className="font-mono">{formatINR(taxableAmount)}</span>
              </div>
              
              {!isInterState ? (
                <>
                  <div className="flex justify-between text-stone-600 text-[11px]">
                    <span>CGST ({(gstRate / 2).toFixed(1)}%):</span>
                    <span className="font-mono">{formatINR(cgst)}</span>
                  </div>
                  <div className="flex justify-between text-stone-600 text-[11px]">
                    <span>SGST ({(gstRate / 2).toFixed(1)}%):</span>
                    <span className="font-mono">{formatINR(sgst)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-stone-600 text-[11px]">
                  <span>IGST ({gstRate.toFixed(1)}%):</span>
                  <span className="font-mono">{formatINR(igst)}</span>
                </div>
              )}

              <div className="flex justify-between text-stone-900 font-extrabold text-sm pt-1.5 border-t border-stone-300">
                <span>Gross Total:</span>
                <span className="font-mono text-orange-900">{formatINR(grossTotal)}</span>
              </div>

              {advancePaid > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Advance Paid:</span>
                  <span className="font-mono">-{formatINR(advancePaid)}</span>
                </div>
              )}

              <div className="flex justify-between text-stone-950 font-black text-sm pt-1.5 border-t-2 border-stone-900">
                <span>Balance Due at Checkout:</span>
                <span className="font-mono text-amber-950">{formatINR(balanceDue)}</span>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                Stay Notes / Remarks
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Special requests, arrival notes, vehicle number..."
                className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-xl text-stone-900 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
            </div>

            {/* Submit Check-in Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white font-bold text-xs shadow-lg shadow-orange-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
            >
              {loading ? (
                <span>Registering Stay...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm & Save Check-in</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
