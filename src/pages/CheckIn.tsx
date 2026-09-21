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
  Percent,
  BookmarkCheck,
  CalendarDays,
  XCircle,
  Plus
} from 'lucide-react';
import { Room, Guest, Stay, HotelSettings, PlanType, PaymentMethod, Reservation, BookingSource } from '../types';
import { getRooms } from '../services/roomService';
import { findGuestByPhone, findGuestByIdNumber, getGuests } from '../services/guestService';
import { createCheckIn } from '../services/stayService';
import { 
  getReservations, 
  createReservation, 
  checkInFromReservation, 
  findAvailableRooms,
  cancelReservation 
} from '../services/reservationService';
import { getTodayDateString, getCurrentTimeString, calculateDaysBetween, formatDateForDisplay } from '../utils/date';
import { formatINR, roundToTwo } from '../utils/currency';
import { useToast } from '../components/common/Toast';

interface CheckInProps {
  settings?: HotelSettings;
  onSuccess: (stay: Stay) => void;
  onCancel: () => void;
  initialTab?: 'walkin' | 'from_reservation' | 'new_reservation';
  initialReservationId?: string;
}

export const CheckIn: React.FC<CheckInProps> = ({
  settings,
  onSuccess,
  onCancel,
  initialTab = 'walkin',
  initialReservationId,
}) => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'walkin' | 'from_reservation' | 'new_reservation'>(initialTab);
  const [loading, setLoading] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [existingGuests, setExistingGuests] = useState<Guest[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);

  // Walk-in Form State
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
  const [roomType, setRoomType] = useState('Executive Room');
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

  // Future Reservation Form State
  const [resGuestName, setResGuestName] = useState('');
  const [resGuestPhone, setResGuestPhone] = useState('');
  const [resGuestEmail, setResGuestEmail] = useState('');
  const [resCheckInDate, setResCheckInDate] = useState(today);
  const [resCheckOutDate, setResCheckOutDate] = useState(tomorrow);
  const [resAdults, setResAdults] = useState(2);
  const [resChildren, setResChildren] = useState(0);
  const [resAdvanceAmount, setResAdvanceAmount] = useState(0);
  const [resPaymentType, setResPaymentType] = useState<PaymentMethod>('Cash');
  const [resBookingSource, setResBookingSource] = useState<BookingSource>('Direct');
  const [resSpecialRequests, setResSpecialRequests] = useState('');
  const [resSelectedRoom, setResSelectedRoom] = useState<Room | null>(null);
  const [resAvailableRooms, setResAvailableRooms] = useState<Room[]>([]);
  const [searchingAvailability, setSearchingAvailability] = useState(false);

  // Check-in from reservation quick state
  const [selectedResForCheckIn, setSelectedResForCheckIn] = useState<Reservation | null>(null);
  const [checkInAdditionalAdvance, setCheckInAdditionalAdvance] = useState(0);
  const [checkInAddAdvanceType, setCheckInAddAdvanceType] = useState<PaymentMethod>('Cash');

  // Load Initial Rooms, Guests, and Reservations
  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [roomsList, guestsList, resList] = await Promise.all([
        getRooms(),
        getGuests(50),
        getReservations()
      ]);
      setRooms(roomsList);
      setExistingGuests(guestsList);
      setReservations(resList);

      // Pre-select first available room for walk-in
      const firstAvailable = roomsList.find(r => r.status === 'Available');
      if (firstAvailable && !selectedRoomId) {
        selectRoom(firstAvailable);
      }

      if (initialReservationId) {
        const found = resList.find(r => r.reservationId === initialReservationId);
        if (found) {
          setSelectedResForCheckIn(found);
          setActiveTab('from_reservation');
        }
      }
    } catch (err) {
      console.error('Error fetching initial checkin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Update days when dates change in walkin
  useEffect(() => {
    if (!manualDaysOverride && checkInDate && expectedCheckOutDate) {
      const calculated = calculateDaysBetween(checkInDate, expectedCheckOutDate);
      setNumberOfDays(calculated > 0 ? calculated : 1);
    }
  }, [checkInDate, expectedCheckOutDate, manualDaysOverride]);

  // Search availability whenever dates change for Future Reservation
  useEffect(() => {
    const checkAvailability = async () => {
      if (resCheckInDate && resCheckOutDate && resCheckOutDate > resCheckInDate) {
        try {
          setSearchingAvailability(true);
          const result = await findAvailableRooms(resCheckInDate, resCheckOutDate);
          setResAvailableRooms(result.availableRooms);
          if (resSelectedRoom && !result.availableRooms.some(r => r.roomId === resSelectedRoom.roomId)) {
            setResSelectedRoom(null);
          } else if (!resSelectedRoom && result.availableRooms.length > 0) {
            setResSelectedRoom(result.availableRooms[0]);
          }
        } catch (e) {
          console.error('Availability search error:', e);
        } finally {
          setSearchingAvailability(false);
        }
      }
    };
    checkAvailability();
  }, [resCheckInDate, resCheckOutDate]);

  const selectRoom = (room: Room) => {
    setSelectedRoomId(room.roomId);
    setSelectedRoomNumber(room.roomNumber);
    setRoomType(room.roomType);
    setPlanType(room.planType || 'EP');
    setRoomTariff(room.tariff || 1500);
  };

  // Walk-in Calculations
  const roomValue = roundToTwo(roomTariff * numberOfDays);
  const subtotal = roundToTwo(roomValue + extraCharges);
  const taxableAmount = roundToTwo(Math.max(0, subtotal - discount));
  const totalGST = roundToTwo((taxableAmount * gstRate) / 100);
  const cgst = isInterState ? 0 : roundToTwo(totalGST / 2);
  const sgst = isInterState ? 0 : roundToTwo(totalGST - cgst);
  const igst = isInterState ? totalGST : 0;
  const grossTotal = roundToTwo(taxableAmount + totalGST);
  const balanceDue = roundToTwo(Math.max(0, grossTotal - advancePaid));

  const handlePhoneBlur = async () => {
    if (guestPhone.trim().length >= 10) {
      const existing = await findGuestByPhone(guestPhone.trim());
      if (existing) {
        setGuestName(existing.guestName || '');
        setGuestEmail(existing.email || '');
        setGuestAddress(existing.address || '');
        if (existing.idType) setIdType(existing.idType as any);
        if (existing.idNumber) setIdNumber(existing.idNumber);
        if (existing.companyName) setCompanyName(existing.companyName);
        if (existing.companyAddress) setCompanyAddress(existing.companyAddress);
        if (existing.companyGSTIN) setCompanyGSTIN(existing.companyGSTIN);
        toast.info('Guest profile matched', `Loaded records for ${existing.guestName}`);
      }
    }
  };

  const handleWalkInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!guestName.trim()) {
      toast.error('Validation Error', 'Guest Name is required.');
      return;
    }
    if (!selectedRoomId) {
      toast.error('Validation Error', 'Please select an available room.');
      return;
    }

    const room = rooms.find(r => r.roomId === selectedRoomId);
    if (room && room.status === 'Occupied') {
      toast.error('Room Occupied', `Room ${room.roomNumber} is currently occupied.`);
      return;
    }

    if (expectedCheckOutDate <= checkInDate) {
      toast.error('Invalid Dates', 'Expected check-out date must be strictly after check-in date.');
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

  const handleReservationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!resGuestName.trim() || !resGuestPhone.trim()) {
      toast.error('Validation Error', 'Guest Name and Phone are required.');
      return;
    }
    if (!resSelectedRoom) {
      toast.error('Validation Error', 'Please select an available room.');
      return;
    }
    if (resCheckOutDate <= resCheckInDate) {
      toast.error('Invalid Dates', 'Check-out date must be after check-in date.');
      return;
    }

    try {
      setLoading(true);
      const createdRes = await createReservation({
        guestName: resGuestName.trim(),
        guestPhone: resGuestPhone.trim(),
        guestEmail: resGuestEmail.trim(),
        roomId: resSelectedRoom.roomId,
        roomNumber: resSelectedRoom.roomNumber,
        roomType: resSelectedRoom.roomType,
        floor: resSelectedRoom.floor,
        planType: resSelectedRoom.planType || 'EP',
        tariff: resSelectedRoom.tariff || 1500,
        checkInDate: resCheckInDate,
        checkInTime: '12:00',
        checkOutDate: resCheckOutDate,
        checkOutTime: '11:00',
        numberOfDays: calculateDaysBetween(resCheckInDate, resCheckOutDate) || 1,
        adults: resAdults,
        children: resChildren,
        advanceAmount: resAdvanceAmount,
        paymentType: resPaymentType,
        bookingSource: resBookingSource,
        specialRequests: resSpecialRequests.trim(),
      });

      toast.success('Reservation Confirmed', `Booking confirmed for ${resGuestName} in Room ${resSelectedRoom.roomNumber}`);
      
      // Reload reservations and switch to list
      await loadInitialData();
      setActiveTab('from_reservation');
    } catch (err: any) {
      toast.error('Booking Failed', err.message || 'Could not create reservation.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckInFromRes = async (res: Reservation) => {
    try {
      setLoading(true);
      const stay = await checkInFromReservation({
        reservationId: res.reservationId,
        checkInDate: today,
        checkInTime: getCurrentTimeString(),
        additionalAdvance: checkInAdditionalAdvance,
        paymentType: checkInAddAdvanceType,
      });

      toast.success('Check-in Complete', `${res.guestName} checked in to Room ${res.roomNumber}`);
      onSuccess(stay);
    } catch (err: any) {
      toast.error('Check-in Failed', err.message || 'Could not check in from reservation.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelReservation = async (reservationId: string, guestName: string) => {
    if (!window.confirm(`Are you sure you want to cancel reservation for ${guestName}?`)) return;
    try {
      setLoading(true);
      await cancelReservation(reservationId, 'Cancelled from front desk');
      toast.info('Reservation Cancelled', `Booking for ${guestName} has been cancelled.`);
      await loadInitialData();
    } catch (err: any) {
      toast.error('Cancellation Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  const activeReservations = reservations.filter(r => r.status === 'CONFIRMED' || r.status === 'PENDING');

  return (
    <div className="max-w-6xl mx-auto pb-12 animate-in fade-in duration-200">
      {/* Top Header & Workflow Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-amber-950 font-['Outfit',sans-serif]">
            Front Desk Check-in & Reservations
          </h1>
          <p className="text-xs text-stone-600 mt-0.5">
            Process direct walk-ins, check in reserved guests, or create future room reservations
          </p>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-xs font-bold text-stone-600 bg-white hover:bg-stone-100 rounded-xl border border-stone-200 transition-colors cursor-pointer"
        >
          Back to Dashboard
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-amber-200 pb-3 mb-6">
        <button
          onClick={() => setActiveTab('walkin')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'walkin'
              ? 'bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 text-white shadow-md shadow-orange-600/20'
              : 'bg-white text-stone-700 hover:bg-amber-50 border border-stone-200'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>Walk-in Check-in</span>
        </button>

        <button
          onClick={() => setActiveTab('from_reservation')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer relative ${
            activeTab === 'from_reservation'
              ? 'bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 text-white shadow-md shadow-orange-600/20'
              : 'bg-white text-stone-700 hover:bg-amber-50 border border-stone-200'
          }`}
        >
          <BookmarkCheck className="w-4 h-4" />
          <span>Check-in from Reservation</span>
          {activeReservations.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-amber-400 text-stone-950 font-extrabold rounded-full">
              {activeReservations.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('new_reservation')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'new_reservation'
              ? 'bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 text-white shadow-md shadow-orange-600/20'
              : 'bg-white text-stone-700 hover:bg-amber-50 border border-stone-200'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          <span>New Future Reservation</span>
        </button>
      </div>

      {/* TAB 1: WALK-IN CHECK-IN */}
      {activeTab === 'walkin' && (
        <form onSubmit={handleWalkInSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Details (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Guest Information */}
            <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200/80 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-amber-100 pb-3">
                <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
                  <UserPlus className="w-4 h-4 text-orange-600" />
                  <span>Guest & Contact Details</span>
                </div>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                  Primary Resident
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    onBlur={handlePhoneBlur}
                    placeholder="10-digit mobile number"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-medium focus:border-orange-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Guest Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Full name as per ID"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-medium focus:border-orange-500 focus:outline-hidden"
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
                    placeholder="e.g. guest@example.com"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-medium focus:border-orange-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    City / Address
                  </label>
                  <input
                    type="text"
                    value={guestAddress}
                    onChange={(e) => setGuestAddress(e.target.value)}
                    placeholder="City, State"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-medium focus:border-orange-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    ID Type
                  </label>
                  <select
                    value={idType}
                    onChange={(e) => setIdType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-medium focus:border-orange-500 focus:outline-hidden"
                  >
                    <option value="Aadhaar Card">Aadhaar Card</option>
                    <option value="Driving License">Driving License</option>
                    <option value="Passport">Passport</option>
                    <option value="Voter ID">Voter ID</option>
                    <option value="PAN Card">PAN Card</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    ID Document Number
                  </label>
                  <input
                    type="text"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    placeholder="e.g. 12-digit Aadhaar / DL No"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-medium focus:border-orange-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Room Allocation */}
            <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200/80 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-amber-100 pb-3">
                <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
                  <BedDouble className="w-4 h-4 text-orange-600" />
                  <span>Room Allocation & Dates</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Inventory Selection
                </span>
              </div>

              {/* Room Cards Grid */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-stone-800">
                  Select Room from Inventory (Exact 24 Rooms) *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-1 bg-amber-50/40 rounded-xl border border-amber-200/50">
                  {rooms.map((r) => {
                    const isAvail = r.status === 'Available';
                    const isSelected = selectedRoomId === r.roomId;
                    return (
                      <button
                        type="button"
                        key={r.roomId}
                        disabled={!isAvail}
                        onClick={() => selectRoom(r)}
                        className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-orange-600 text-white border-orange-700 shadow-sm'
                            : isAvail
                            ? 'bg-white hover:bg-amber-100 text-stone-800 border-emerald-300'
                            : 'bg-stone-100 text-stone-400 border-stone-200 cursor-not-allowed opacity-60'
                        }`}
                      >
                        <div className="text-xs font-black font-mono">{r.roomNumber}</div>
                        <div className="text-[9px] truncate font-semibold">{r.roomType}</div>
                        <div className="text-[8px] opacity-80">{r.floor}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Check-in Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={checkInDate}
                    onChange={(e) => setCheckInDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Check-in Time
                  </label>
                  <input
                    type="time"
                    value={checkInTime}
                    onChange={(e) => setCheckInTime(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Expected Checkout *
                  </label>
                  <input
                    type="date"
                    required
                    value={expectedCheckOutDate}
                    onChange={(e) => setExpectedCheckOutDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Nights / Days
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={numberOfDays}
                    onChange={(e) => {
                      setManualDaysOverride(true);
                      setNumberOfDays(parseInt(e.target.value, 10) || 1);
                    }}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Plan Type
                  </label>
                  <select
                    value={planType}
                    onChange={(e) => setPlanType(e.target.value as PlanType)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-medium"
                  >
                    <option value="EP">EP (European Plan - Room Only)</option>
                    <option value="CP">CP (Continental - Incl. Breakfast)</option>
                    <option value="MAP">MAP (Modified - Breakfast + 1 Meal)</option>
                    <option value="AP">AP (American - All Meals)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Adults
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={paxAdults}
                    onChange={(e) => setPaxAdults(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Children
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="4"
                    value={paxChildren}
                    onChange={(e) => setPaxChildren(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Corporate / GST & OTA Billing Details */}
            <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200/80 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-amber-100 pb-3">
                <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
                  <Building className="w-4 h-4 text-orange-600" />
                  <span>Company GSTIN & Booking References</span>
                </div>
                <span className="text-[10px] font-bold text-stone-500">Optional</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Tech Corp Ltd"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Company GSTIN
                  </label>
                  <input
                    type="text"
                    value={companyGSTIN}
                    onChange={(e) => setCompanyGSTIN(e.target.value.toUpperCase())}
                    placeholder="15-digit GSTIN"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-medium font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Booking ID / GRC No
                  </label>
                  <input
                    type="text"
                    value={bookingId}
                    onChange={(e) => setBookingId(e.target.value)}
                    placeholder="e.g. GRC-1049"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-medium"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Billing & Advance Summary (1 col) */}
          <div className="space-y-6">
            <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200 p-5 shadow-sm space-y-4 sticky top-6">
              <h3 className="font-black text-base text-stone-950 font-['Outfit',sans-serif] border-b border-amber-100 pb-3">
                Tariff & Advance Collection
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-stone-800 mb-1">
                    Room Tariff / Night (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={roomTariff}
                    onChange={(e) => setRoomTariff(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl font-mono text-sm font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-stone-800 mb-1">
                      GST Rate (%)
                    </label>
                    <select
                      value={gstRate}
                      onChange={(e) => setGstRate(parseFloat(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-xl text-xs font-bold"
                    >
                      <option value={12}>12% (Rooms ≤ 7.5k)</option>
                      <option value={18}>18% (Rooms &gt; 7.5k)</option>
                      <option value={0}>0% (Exempt)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-stone-800 mb-1">
                      Advance Paid (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={advancePaid}
                      onChange={(e) => setAdvancePaid(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 bg-white border border-emerald-300 rounded-xl font-mono text-xs font-bold text-emerald-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-stone-800 mb-1">
                    Advance Payment Method
                  </label>
                  <select
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-semibold"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI / QR</option>
                    <option value="Card">Credit / Debit Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Credit">Company Bill-to-Company</option>
                  </select>
                </div>

                {/* Live Cost Breakdown */}
                <div className="bg-amber-50/60 rounded-xl p-3.5 border border-amber-200/80 space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between text-stone-600">
                    <span>Base Tariff ({numberOfDays}N):</span>
                    <span>{formatINR(roomValue)}</span>
                  </div>
                  <div className="flex justify-between text-stone-600">
                    <span>Estimated GST ({gstRate}%):</span>
                    <span>{formatINR(totalGST)}</span>
                  </div>
                  <div className="flex justify-between text-stone-900 font-extrabold border-t border-amber-200 pt-1 text-sm">
                    <span>Estimated Total:</span>
                    <span>{formatINR(grossTotal)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>Advance Received:</span>
                    <span>- {formatINR(advancePaid)}</span>
                  </div>
                  <div className="flex justify-between text-red-700 font-extrabold border-t border-amber-200 pt-1">
                    <span>Est. Balance Due:</span>
                    <span>{formatINR(balanceDue)}</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !selectedRoomId}
                  className="w-full py-3 bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white rounded-xl text-sm font-black shadow-lg shadow-orange-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>{loading ? 'Processing...' : 'Complete Walk-in Check-in'}</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: CHECK-IN FROM RESERVATION */}
      {activeTab === 'from_reservation' && (
        <div className="space-y-6">
          <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200/80 p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-amber-100 pb-3 mb-4">
              <h2 className="font-black text-base text-amber-950 font-['Outfit',sans-serif]">
                Confirmed Reservations ({activeReservations.length})
              </h2>
              <span className="text-xs text-stone-600">
                Select a guest to confirm arrival and assign room keys
              </span>
            </div>

            {activeReservations.length === 0 ? (
              <div className="py-12 text-center text-stone-500">
                <BookmarkCheck className="w-12 h-12 text-amber-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-stone-700">No pending reservations</p>
                <p className="text-xs text-stone-500 mt-1">Create a future reservation or process a direct walk-in.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeReservations.map((res) => (
                  <div
                    key={res.reservationId}
                    className="bg-white rounded-2xl border border-amber-200 p-4 shadow-xs hover:border-orange-400 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-base font-black text-stone-900 font-['Outfit',sans-serif]">
                            {res.guestName}
                          </div>
                          <div className="text-xs text-stone-600 font-mono">
                            📞 {res.guestPhone}
                          </div>
                        </div>

                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          {res.status}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-mono bg-amber-50/50 p-2.5 rounded-xl border border-amber-100">
                        <div>
                          <span className="text-stone-500 block text-[10px]">Room:</span>
                          <span className="font-extrabold text-stone-900">{res.roomNumber} ({res.roomType})</span>
                        </div>
                        <div>
                          <span className="text-stone-500 block text-[10px]">Tariff:</span>
                          <span className="font-extrabold text-stone-900">{formatINR(res.tariff)} / night</span>
                        </div>
                        <div>
                          <span className="text-stone-500 block text-[10px]">Check-in:</span>
                          <span className="font-bold text-stone-800">{formatDateForDisplay(res.checkInDate)}</span>
                        </div>
                        <div>
                          <span className="text-stone-500 block text-[10px]">Check-out:</span>
                          <span className="font-bold text-stone-800">{formatDateForDisplay(res.checkOutDate)}</span>
                        </div>
                      </div>

                      {res.advanceAmount > 0 && (
                        <div className="mt-2 text-xs text-emerald-700 font-bold flex items-center justify-between">
                          <span>Advance Recorded:</span>
                          <span>{formatINR(res.advanceAmount)} ({res.paymentType || 'Cash'})</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleCancelReservation(res.reservationId, res.guestName)}
                        className="px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl cursor-pointer"
                      >
                        Cancel Booking
                      </button>

                      <button
                        onClick={() => handleCheckInFromRes(res)}
                        disabled={loading}
                        className="px-4 py-1.5 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Check In Guest</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: NEW FUTURE RESERVATION */}
      {activeTab === 'new_reservation' && (
        <form onSubmit={handleReservationSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200/80 p-5 shadow-xs space-y-4">
              <h2 className="font-black text-base text-stone-900 font-['Outfit',sans-serif] border-b border-amber-100 pb-3">
                Guest & Booking Details
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Guest Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={resGuestPhone}
                    onChange={(e) => setResGuestPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Guest Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={resGuestName}
                    onChange={(e) => setResGuestName(e.target.value)}
                    placeholder="Guest name"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={resGuestEmail}
                    onChange={(e) => setResGuestEmail(e.target.value)}
                    placeholder="guest@example.com"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Booking Source
                  </label>
                  <select
                    value={resBookingSource}
                    onChange={(e) => setResBookingSource(e.target.value as BookingSource)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-semibold"
                  >
                    <option value="Direct">Direct Front Desk</option>
                    <option value="Phone">Phone Reservation</option>
                    <option value="Walk-in">Advance Walk-in</option>
                    <option value="OTA">OTA (MakeMyTrip / Agoda / Goibibo)</option>
                    <option value="Website">Official Website</option>
                    <option value="Other">Other Referral</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Date Selection & Real-time Available Rooms */}
            <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200/80 p-5 shadow-xs space-y-4">
              <h2 className="font-black text-base text-stone-900 font-['Outfit',sans-serif] border-b border-amber-100 pb-3">
                Dates & Real-time Room Availability Check
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Check-in Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={resCheckInDate}
                    onChange={(e) => setResCheckInDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Check-out Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={resCheckOutDate}
                    onChange={(e) => setResCheckOutDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  Available Rooms for Selected Dates ({resAvailableRooms.length} of 24 Available) *
                </label>
                {searchingAvailability ? (
                  <div className="p-4 text-center text-xs text-stone-500">Checking Firestore room availability...</div>
                ) : resAvailableRooms.length === 0 ? (
                  <div className="p-4 bg-red-50 text-red-700 rounded-xl text-xs font-bold border border-red-200">
                    No rooms available for the selected dates. Please choose different dates.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-1 bg-amber-50/40 rounded-xl border border-amber-200/50">
                    {resAvailableRooms.map((r) => {
                      const isSelected = resSelectedRoom?.roomId === r.roomId;
                      return (
                        <button
                          type="button"
                          key={r.roomId}
                          onClick={() => setResSelectedRoom(r)}
                          className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-orange-600 text-white border-orange-700 shadow-sm'
                              : 'bg-white hover:bg-amber-100 text-stone-800 border-emerald-300'
                          }`}
                        >
                          <div className="text-xs font-black font-mono">{r.roomNumber}</div>
                          <div className="text-[9px] truncate font-semibold">{r.roomType}</div>
                          <div className="text-[8px] font-mono opacity-80">{formatINR(r.tariff)}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Reservation Summary */}
          <div className="space-y-6">
            <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200 p-5 shadow-sm space-y-4 sticky top-6">
              <h3 className="font-black text-base text-stone-950 font-['Outfit',sans-serif] border-b border-amber-100 pb-3">
                Reservation Advance & Notes
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-stone-800 mb-1">
                    Advance Payment Collected (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={resAdvanceAmount}
                    onChange={(e) => setResAdvanceAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl font-mono text-sm font-bold text-emerald-800"
                  />
                  <p className="text-[10px] text-stone-500 mt-0.5">
                    Will create an authentic payment record in payments collection.
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-stone-800 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={resPaymentType}
                    onChange={(e) => setResPaymentType(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-semibold"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI / QR</option>
                    <option value="Card">Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-stone-800 mb-1">
                    Special Requests / Notes
                  </label>
                  <textarea
                    rows={2}
                    value={resSpecialRequests}
                    onChange={(e) => setResSpecialRequests(e.target.value)}
                    placeholder="Late arrival, extra mattress, etc."
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-medium"
                  />
                </div>

                {resSelectedRoom && (
                  <div className="bg-amber-50/70 rounded-xl p-3 border border-amber-200 text-xs font-mono space-y-1">
                    <div className="flex justify-between">
                      <span className="text-stone-600">Selected Room:</span>
                      <span className="font-extrabold text-stone-900">{resSelectedRoom.roomNumber} ({resSelectedRoom.roomType})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-600">Tariff / Night:</span>
                      <span className="font-extrabold text-stone-900">{formatINR(resSelectedRoom.tariff)}</span>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !resSelectedRoom}
                  className="w-full py-3 bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white rounded-xl text-sm font-black shadow-lg shadow-orange-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <BookmarkCheck className="w-5 h-5" />
                  <span>{loading ? 'Creating Booking...' : 'Confirm Reservation'}</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};
