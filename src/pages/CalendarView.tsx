import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  UserPlus, 
  LogOut, 
  Receipt, 
  Eye, 
  Users, 
  BedDouble,
  Sparkles,
  BookmarkCheck,
  Grid,
  CalendarDays,
  Download,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Stay, Bill, HotelSettings, Room, Reservation } from '../types';
import { getRooms } from '../services/roomService';
import { getStays } from '../services/stayService';
import { getBills } from '../services/billService';
import { getReservations } from '../services/reservationService';
import { formatINR } from '../utils/currency';
import { formatDateForDisplay, formatTime12H, getTodayDateString } from '../utils/date';
import { downloadBillPDF } from '../utils/pdfGenerator';
import { useToast } from '../components/common/Toast';

interface CalendarViewProps {
  settings?: HotelSettings;
  onViewBill: (bill: Bill) => void;
  onCheckIn: (params?: any) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  settings,
  onViewBill,
  onCheckIn,
}) => {
  const toast = useToast();
  const [viewMode, setViewMode] = useState<'timeline' | 'month'>('timeline');
  const [timelineStartDate, setTimelineStartDate] = useState(new Date());
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [stays, setStays] = useState<Stay[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [downloadingBillId, setDownloadingBillId] = useState<string | null>(null);
  const [selectedDateStr, setSelectedDateStr] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const todayStr = getTodayDateString();

  const loadData = async () => {
    try {
      setLoading(true);
      const [roomsList, allStays, allBills, allRes] = await Promise.all([
        getRooms(),
        getStays(300),
        getBills(300),
        getReservations(),
      ]);
      setRooms(roomsList);
      setStays(allStays);
      setBills(allBills);
      setReservations(allRes);
    } catch (err) {
      console.error('Calendar load data error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDownloadPDF = async (bill: Bill, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      setDownloadingBillId(bill.billId);
      await downloadBillPDF(bill, settings);
      toast.success('Bill Downloaded', `Invoice ${bill.billNo} downloaded successfully.`);
    } catch (err) {
      toast.error('Download Failed', 'Could not generate PDF.');
    } finally {
      setDownloadingBillId(null);
    }
  };

  // Timeline columns: 14 consecutive days starting from timelineStartDate
  const timelineDaysCount = 14;
  const timelineDates: { dateStr: string; label: string; dayName: string; isToday: boolean }[] = [];
  for (let i = 0; i < timelineDaysCount; i++) {
    const d = new Date(timelineStartDate);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    timelineDates.push({
      dateStr,
      label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      dayName: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      isToday: dateStr === todayStr,
    });
  }

  const shiftTimeline = (days: number) => {
    const next = new Date(timelineStartDate);
    next.setDate(next.getDate() + days);
    setTimelineStartDate(next);
  };

  // Month navigation logic
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  const calendarDays = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const formattedDay = day < 10 ? `0${day}` : `${day}`;
    const formattedMonth = month + 1 < 10 ? `0${month + 1}` : `${month + 1}`;
    const dateString = `${year}-${formattedMonth}-${formattedDay}`;
    calendarDays.push({ day, dateString });
  }

  // Selected Date events
  const selectedArrivals = stays.filter(s => s.checkInDate === selectedDateStr);
  const selectedDepartures = stays.filter(s => s.expectedCheckOutDate === selectedDateStr || s.actualCheckOutDate === selectedDateStr);
  const selectedReservations = reservations.filter(r => r.checkInDate === selectedDateStr && (r.status === 'CONFIRMED' || r.status === 'PENDING'));
  const selectedBills = bills.filter(b => b.billDate === selectedDateStr);

  // Live Occupancy Calculations for selected Date
  const totalRoomsCount = rooms.length || 24;
  const occupiedOnSelectedDate = stays.filter(s => 
    s.status === 'active' && s.checkInDate <= selectedDateStr && (s.expectedCheckOutDate > selectedDateStr || s.expectedCheckOutDate === s.checkInDate)
  ).length;
  const reservedOnSelectedDate = reservations.filter(r => 
    (r.status === 'CONFIRMED' || r.status === 'PENDING') && r.checkInDate <= selectedDateStr && r.checkOutDate > selectedDateStr
  ).length;
  const bookedOnSelectedDate = occupiedOnSelectedDate + reservedOnSelectedDate;
  const availableOnSelectedDate = Math.max(0, totalRoomsCount - bookedOnSelectedDate);

  // Overall Live Summary Today
  const todayOccupiedCount = rooms.filter(r => r.status === 'Occupied').length;
  const todayReservedCount = rooms.filter(r => r.status === 'Reserved').length;
  const todayAvailableCount = rooms.filter(r => r.status === 'Available').length;

  const floorOrder = ['1st Floor', '2nd Floor', '3rd Floor'];

  return (
    <div className="max-w-7xl mx-auto pb-12 space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-amber-950 font-['Outfit',sans-serif]">
            Room Availability & Calendar
          </h1>
          <p className="text-xs text-stone-600 mt-0.5">
            Real-time room occupancy timeline, day-wise bookings, and direct invoice downloads
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200">
            <button
              onClick={() => setViewMode('timeline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'timeline'
                  ? 'bg-stone-900 text-amber-300 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Room Timeline</span>
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'month'
                  ? 'bg-stone-900 text-amber-300 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Month Calendar</span>
            </button>
          </div>

          <button
            onClick={() => onCheckIn({ tab: 'walkin' })}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-orange-600/30 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>New Check-in</span>
          </button>
        </div>
      </div>

      {/* Real Live Occupancy Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#FFFDF9] p-4 rounded-2xl border border-amber-200/80 shadow-xs">
        <div className="flex items-center gap-3 p-2 bg-stone-50 rounded-xl border border-stone-200/60">
          <div className="p-2.5 rounded-xl bg-stone-900 text-amber-300">
            <BedDouble className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-stone-500">Total Rooms</div>
            <div className="text-xl font-black text-stone-900 font-['Outfit',sans-serif]">{totalRoomsCount}</div>
            <div className="text-[10px] text-stone-500">Across 3 Floors</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-2 bg-orange-50/70 rounded-xl border border-orange-200/60">
          <div className="p-2.5 rounded-xl bg-orange-600 text-white">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-orange-800">Booked / Occupied</div>
            <div className="text-xl font-black text-orange-950 font-['Outfit',sans-serif]">{todayOccupiedCount}</div>
            <div className="text-[10px] text-orange-700 font-semibold">{totalRoomsCount > 0 ? `${Math.round((todayOccupiedCount / totalRoomsCount) * 100)}% occupied` : '0%'}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-2 bg-emerald-50/70 rounded-xl border border-emerald-200/60">
          <div className="p-2.5 rounded-xl bg-emerald-600 text-white">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-emerald-800">Available / Left</div>
            <div className="text-xl font-black text-emerald-900 font-['Outfit',sans-serif]">{todayAvailableCount}</div>
            <div className="text-[10px] text-emerald-700 font-semibold">Ready for check-in</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-2 bg-blue-50/70 rounded-xl border border-blue-200/60">
          <div className="p-2.5 rounded-xl bg-blue-600 text-white">
            <BookmarkCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-blue-800">Reservations</div>
            <div className="text-xl font-black text-blue-950 font-['Outfit',sans-serif]">{todayReservedCount}</div>
            <div className="text-[10px] text-blue-700 font-semibold">Upcoming bookings</div>
          </div>
        </div>
      </div>

      {/* VIEW MODE 1: TIMELINE MATRIX */}
      {viewMode === 'timeline' && (
        <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200/80 shadow-xs p-5 space-y-4">
          {/* Timeline Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-amber-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-stone-900 text-sm font-['Outfit',sans-serif]">
                14-Day Timeline Window:
              </span>
              <span className="text-xs font-mono font-bold text-orange-950 bg-orange-100 px-2.5 py-0.5 rounded-lg border border-orange-200">
                {timelineDates[0]?.label} — {timelineDates[timelineDates.length - 1]?.label}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => shiftTimeline(-7)}
                className="px-2.5 py-1 text-xs font-bold bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg cursor-pointer"
              >
                ◀ -7 Days
              </button>
              <button
                onClick={() => setTimelineStartDate(new Date())}
                className="px-3 py-1 text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg cursor-pointer"
              >
                Today
              </button>
              <button
                onClick={() => shiftTimeline(7)}
                className="px-2.5 py-1 text-xs font-bold bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg cursor-pointer"
              >
                +7 Days ▶
              </button>
            </div>
          </div>

          {/* Timeline Grid */}
          {loading ? (
            <div className="py-16 text-center text-stone-500">
              <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs">Loading availability matrix...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[1000px]">
                {/* Header Row: Dates */}
                <div className="grid grid-cols-[140px_repeat(14,1fr)] gap-1 pb-2 border-b border-amber-200 text-center text-xs font-bold">
                  <div className="text-left font-mono pl-2 text-stone-600">Room / Floor</div>
                  {timelineDates.map((td) => (
                    <div
                      key={td.dateStr}
                      className={`p-1 rounded-lg ${
                        td.isToday ? 'bg-orange-600 text-white shadow-xs' : 'bg-amber-50/70 text-stone-800'
                      }`}
                    >
                      <div className="text-[10px] uppercase font-semibold">{td.dayName}</div>
                      <div className="font-mono text-xs">{td.label}</div>
                    </div>
                  ))}
                </div>

                {/* Rooms Rows Grouped by Floor */}
                <div className="divide-y divide-amber-100/80 mt-1">
                  {floorOrder.map((floor) => {
                    const floorRooms = rooms.filter(r => String(r.floor) === floor);
                    if (floorRooms.length === 0) return null;

                    return (
                      <React.Fragment key={floor}>
                        <div className="py-1.5 px-2 bg-amber-100/50 text-amber-950 text-[10px] font-black uppercase tracking-wider font-mono">
                          {floor}
                        </div>
                        {floorRooms.map((r) => (
                          <div
                            key={r.roomId}
                            className="grid grid-cols-[140px_repeat(14,1fr)] gap-1 py-1.5 items-center hover:bg-amber-50/30 transition-colors"
                          >
                            {/* Room Badge */}
                            <div className="pl-2 flex items-center gap-2">
                              <span className="font-black font-mono text-xs text-stone-900 px-2 py-0.5 rounded bg-stone-900 text-amber-300">
                                {r.roomNumber}
                              </span>
                              <span className="text-[10px] text-stone-600 truncate">{r.roomType.replace(' Room', '')}</span>
                            </div>

                            {/* 14 Date cells for this room */}
                            {timelineDates.map((td) => {
                              // Check if stay exists on this date
                              const matchingStay = stays.find(
                                s => s.roomId === r.roomId && s.status === 'active' && s.checkInDate <= td.dateStr && (s.expectedCheckOutDate > td.dateStr || s.expectedCheckOutDate === s.checkInDate)
                              );

                              // Check if reservation exists
                              const matchingRes = reservations.find(
                                res => res.roomId === r.roomId && (res.status === 'CONFIRMED' || res.status === 'PENDING') && res.checkInDate <= td.dateStr && res.checkOutDate > td.dateStr
                              );

                              if (matchingStay) {
                                return (
                                  <div
                                    key={td.dateStr}
                                    title={`Occupied: ${matchingStay.guestName} (${matchingStay.checkInDate} to ${matchingStay.expectedCheckOutDate})`}
                                    className="h-8 rounded-md bg-orange-500 text-white text-[9px] font-bold p-1 truncate flex items-center justify-center shadow-2xs"
                                  >
                                    <span className="truncate">{matchingStay.guestName}</span>
                                  </div>
                                );
                              }

                              if (matchingRes) {
                                return (
                                  <div
                                    key={td.dateStr}
                                    title={`Reserved: ${matchingRes.guestName} (${matchingRes.checkInDate} to ${matchingRes.checkOutDate})`}
                                    className="h-8 rounded-md bg-blue-500 text-white text-[9px] font-bold p-1 truncate flex items-center justify-center shadow-2xs"
                                  >
                                    <span className="truncate">{matchingRes.guestName}</span>
                                  </div>
                                );
                              }

                              return (
                                <button
                                  key={td.dateStr}
                                  onClick={() => onCheckIn({ tab: 'walkin', prefilledRoom: r, prefilledDate: td.dateStr })}
                                  title={`Available: Click to check-in Room ${r.roomNumber}`}
                                  className="h-8 rounded-md bg-emerald-50 hover:bg-emerald-200 border border-emerald-200/60 text-emerald-800 text-[10px] font-bold flex items-center justify-center transition-colors cursor-pointer"
                                >
                                  Free
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Timeline Legend */}
          <div className="flex items-center gap-4 text-xs font-semibold pt-3 border-t border-amber-100">
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded bg-emerald-50 border border-emerald-300" />
              <span className="text-stone-600">Available / Free</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded bg-orange-500" />
              <span className="text-stone-600">Occupied (Guest In-house)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded bg-blue-500" />
              <span className="text-stone-600">Reserved (Confirmed Booking)</span>
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE 2: MONTH CALENDAR */}
      {viewMode === 'month' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Grid (Span 2) */}
          <div className="lg:col-span-2 bg-[#FFFDF9] rounded-2xl border border-amber-200/80 shadow-xs p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-amber-100">
              <h2 className="text-base sm:text-lg font-black text-stone-900 font-['Outfit',sans-serif]">
                {monthName} {year}
              </h2>

              <div className="flex items-center gap-1">
                <button
                  onClick={prevMonth}
                  className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentDate(new Date())}
                  className="px-2.5 py-1 text-xs font-bold text-stone-700 hover:bg-stone-100 rounded-lg"
                >
                  Today
                </button>
                <button
                  onClick={nextMonth}
                  className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Weekdays */}
            <div className="grid grid-cols-7 gap-1 text-center font-bold text-[11px] text-stone-500 mb-1">
              <span>SUN</span>
              <span>MON</span>
              <span>TUE</span>
              <span>WED</span>
              <span>THU</span>
              <span>FRI</span>
              <span>SAT</span>
            </div>

            {/* Days Matrix */}
            <div className="grid grid-cols-7 gap-1 flex-1">
              {calendarDays.map((item, idx) => {
                if (!item) {
                  return <div key={`empty-${idx}`} className="p-2 min-h-[70px] bg-stone-50/50 rounded-xl" />;
                }

                const dayArrivals = stays.filter(s => s.checkInDate === item.dateString);
                const dayDepartures = stays.filter(s => s.expectedCheckOutDate === item.dateString || s.actualCheckOutDate === item.dateString);
                const dayRes = reservations.filter(r => r.checkInDate === item.dateString && (r.status === 'CONFIRMED' || r.status === 'PENDING'));
                const dayBills = bills.filter(b => b.billDate === item.dateString);
                const isToday = item.dateString === todayStr;
                const isSelected = item.dateString === selectedDateStr;

                return (
                  <div
                    key={item.dateString}
                    onClick={() => setSelectedDateStr(item.dateString)}
                    className={`
                      p-1.5 rounded-xl border transition-all cursor-pointer min-h-[72px] flex flex-col justify-between
                      ${isSelected ? 'border-orange-500 ring-2 ring-orange-400/30 bg-orange-50/30' : 'border-amber-100/80 bg-white hover:bg-amber-50/50'}
                      ${isToday ? 'bg-amber-50/80' : ''}
                    `}
                  >
                    <div className="flex justify-between items-center">
                      <span className={`text-xs font-bold ${isToday ? 'text-orange-600 font-extrabold' : 'text-stone-700'}`}>
                        {item.day}
                      </span>
                      {isToday && (
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-600" />
                      )}
                    </div>

                    <div className="space-y-0.5 mt-1">
                      {dayArrivals.length > 0 && (
                        <div className="text-[9px] font-bold text-orange-800 bg-orange-100 rounded px-1 truncate">
                          +{dayArrivals.length} In
                        </div>
                      )}
                      {dayRes.length > 0 && (
                        <div className="text-[9px] font-bold text-blue-800 bg-blue-100 rounded px-1 truncate">
                          +{dayRes.length} Res
                        </div>
                      )}
                      {dayBills.length > 0 && (
                        <div className="text-[9px] font-bold text-emerald-800 bg-emerald-100 rounded px-1 truncate">
                          {dayBills.length} Bill{dayBills.length > 1 ? 's' : ''}
                        </div>
                      )}
                      {dayDepartures.length > 0 && (
                        <div className="text-[9px] font-bold text-stone-700 bg-stone-100 rounded px-1 truncate">
                          -{dayDepartures.length} Out
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Daily Details Drawer (Span 1) */}
          <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200/80 shadow-xs p-5 space-y-4">
            <div className="border-b border-amber-100 pb-3">
              <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Date Overview</span>
              <h3 className="font-extrabold text-base text-stone-900 font-['Outfit',sans-serif]">
                {formatDateForDisplay(selectedDateStr)}
              </h3>
              {/* Day Occupancy Breakdown */}
              <div className="mt-2 flex items-center justify-between text-xs bg-amber-50/70 p-2 rounded-xl border border-amber-200/60">
                <span className="font-bold text-stone-700">Room Status on this Day:</span>
                <span className="font-bold text-orange-950">
                  <span className="text-orange-700">{bookedOnSelectedDate} Booked</span> • <span className="text-emerald-700">{availableOnSelectedDate} Left</span>
                </span>
              </div>
            </div>

            {/* Generated Invoices on Selected Date */}
            <div>
              <h4 className="text-xs font-bold text-emerald-900 flex items-center gap-1 mb-2">
                <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                <span>Tax Invoices Generated ({selectedBills.length})</span>
              </h4>
              {selectedBills.length === 0 ? (
                <p className="text-xs text-stone-400 italic">No invoices issued on this date</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {selectedBills.map(b => (
                    <div key={b.billId} className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs flex flex-col gap-1.5 shadow-2xs">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-black text-stone-900 font-mono">{b.billNo}</div>
                          <div className="font-semibold text-stone-800">{b.guestName} (Room {b.roomNumber})</div>
                        </div>
                        <div className="font-black font-mono text-stone-900 text-right">
                          {formatINR(b.grossTotal)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-1 border-t border-emerald-200/60">
                        <button
                          onClick={() => onViewBill(b)}
                          className="flex-1 inline-flex items-center justify-center gap-1 py-1 px-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-amber-300 text-[11px] font-bold cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View Bill</span>
                        </button>
                        <button
                          onClick={(e) => handleDownloadPDF(b, e)}
                          disabled={downloadingBillId === b.billId}
                          className="flex-1 inline-flex items-center justify-center gap-1 py-1 px-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold cursor-pointer disabled:opacity-50"
                        >
                          <Download className="w-3 h-3" />
                          <span>{downloadingBillId === b.billId ? 'Exporting...' : 'Download PDF'}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Arrivals */}
            <div>
              <h4 className="text-xs font-bold text-orange-900 flex items-center gap-1 mb-2">
                <UserPlus className="w-3.5 h-3.5 text-orange-600" />
                <span>Arrivals ({selectedArrivals.length})</span>
              </h4>
              {selectedArrivals.length === 0 ? (
                <p className="text-xs text-stone-400 italic">No arrivals recorded</p>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {selectedArrivals.map(s => (
                    <div key={s.stayId} className="p-2 rounded-lg bg-orange-50 border border-orange-200 text-xs flex justify-between items-center">
                      <div>
                        <div className="font-bold text-stone-900">{s.guestName}</div>
                        <div className="text-[10px] text-stone-600">Room {s.roomNumber} ({s.roomType})</div>
                      </div>
                      <div className="text-[11px] font-mono text-orange-950 font-bold">
                        {formatINR(s.roomTariff)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Reservations */}
            <div>
              <h4 className="text-xs font-bold text-blue-900 flex items-center gap-1 mb-2">
                <BookmarkCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Reserved Bookings ({selectedReservations.length})</span>
              </h4>
              {selectedReservations.length === 0 ? (
                <p className="text-xs text-stone-400 italic">No scheduled reservations</p>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {selectedReservations.map(r => (
                    <div key={r.reservationId} className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-xs">
                      <div className="font-bold text-stone-900">{r.guestName}</div>
                      <div className="text-[10px] text-stone-600">Room {r.roomNumber} • {formatINR(r.tariff)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Departures */}
            <div>
              <h4 className="text-xs font-bold text-stone-800 flex items-center gap-1 mb-2">
                <LogOut className="w-3.5 h-3.5 text-stone-600" />
                <span>Departures ({selectedDepartures.length})</span>
              </h4>
              {selectedDepartures.length === 0 ? (
                <p className="text-xs text-stone-400 italic">No checkouts scheduled</p>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {selectedDepartures.map(s => (
                    <div key={s.stayId} className="p-2 rounded-lg bg-stone-50 border border-stone-200 text-xs flex justify-between items-center">
                      <div>
                        <div className="font-bold text-stone-900">{s.guestName}</div>
                        <div className="text-[10px] text-stone-600">Room {s.roomNumber} • Bal: {formatINR(s.balanceDue)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
