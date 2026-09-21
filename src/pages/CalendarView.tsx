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
  CalendarDays
} from 'lucide-react';
import { Stay, Bill, HotelSettings, Room, Reservation } from '../types';
import { getRooms } from '../services/roomService';
import { getStays } from '../services/stayService';
import { getBills } from '../services/billService';
import { getReservations } from '../services/reservationService';
import { formatINR } from '../utils/currency';
import { formatDateForDisplay, formatTime12H, getTodayDateString } from '../utils/date';

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
  const [viewMode, setViewMode] = useState<'timeline' | 'month'>('timeline');
  const [timelineStartDate, setTimelineStartDate] = useState(new Date());
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [stays, setStays] = useState<Stay[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [selectedDateStr, setSelectedDateStr] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const todayStr = getTodayDateString();

  useEffect(() => {
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
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

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

  const floorOrder = ['1st Floor', '2nd Floor', '3rd Floor'];

  return (
    <div className="max-w-7xl mx-auto pb-12 space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-amber-950 font-['Outfit',sans-serif]">
            Room Availability & Booking Schedule
          </h1>
          <p className="text-xs text-stone-600 mt-0.5">
            Real-time room occupancy timeline and monthly arrivals calendar
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
                                s => s.roomId === r.roomId && s.status === 'active' && s.checkInDate <= td.dateStr && s.expectedCheckOutDate > td.dateStr
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
                    <div key={s.stayId} className="p-2 rounded-lg bg-orange-50 border border-orange-200 text-xs">
                      <div className="font-bold text-stone-900">{s.guestName}</div>
                      <div className="text-[10px] text-stone-600">Room {s.roomNumber} ({s.roomType})</div>
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
                    <div key={s.stayId} className="p-2 rounded-lg bg-stone-50 border border-stone-200 text-xs">
                      <div className="font-bold text-stone-900">{s.guestName}</div>
                      <div className="text-[10px] text-stone-600">Room {s.roomNumber} • Bal: {formatINR(s.balanceDue)}</div>
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
