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
  Sparkles
} from 'lucide-react';
import { Stay, Bill, HotelSettings } from '../types';
import { getStays } from '../services/stayService';
import { getBills } from '../services/billService';
import { formatINR } from '../utils/currency';
import { formatDateForDisplay, formatTime12H } from '../utils/date';

interface CalendarViewProps {
  settings?: HotelSettings;
  onViewBill: (bill: Bill) => void;
  onCheckIn: () => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  settings,
  onViewBill,
  onCheckIn,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [stays, setStays] = useState<Stay[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [selectedDateStr, setSelectedDateStr] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [allStays, allBills] = await Promise.all([
          getStays(300),
          getBills(300),
        ]);
        setStays(allStays);
        setBills(allBills);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

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

  // Generate grid days
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
  const selectedBills = bills.filter(b => b.billDate === selectedDateStr);

  return (
    <div className="max-w-7xl mx-auto pb-12 space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-amber-950 font-['Outfit',sans-serif]">
            Stay & Booking Calendar
          </h1>
          <p className="text-xs text-stone-600 mt-0.5">
            Visual month overview of guest arrivals, scheduled checkouts & daily revenues
          </p>
        </div>

        <button
          onClick={onCheckIn}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-orange-600/30 transition-all cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>New Check-in</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid (Span 2) */}
        <div className="lg:col-span-2 bg-[#FFFDF9] rounded-2xl border border-amber-200/80 shadow-xs p-5 flex flex-col">
          {/* Month Navigation */}
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

          {/* Days of week header */}
          <div className="grid grid-cols-7 text-center font-bold text-[11px] text-stone-500 uppercase tracking-wider py-1 border-b border-amber-100">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* Grid Cells */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 mt-2 flex-1">
            {calendarDays.map((item, index) => {
              if (!item) {
                return <div key={`empty-${index}`} className="min-h-16 sm:min-h-20 bg-stone-50/40 rounded-xl" />;
              }

              const isSelected = item.dateString === selectedDateStr;
              const isToday = item.dateString === new Date().toISOString().split('T')[0];

              const arrivalsCount = stays.filter(s => s.checkInDate === item.dateString).length;
              const departuresCount = stays.filter(s => s.expectedCheckOutDate === item.dateString).length;
              const billsCount = bills.filter(b => b.billDate === item.dateString).length;

              return (
                <button
                  key={item.dateString}
                  type="button"
                  onClick={() => setSelectedDateStr(item.dateString)}
                  className={`
                    min-h-16 sm:min-h-20 p-1.5 sm:p-2 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer
                    ${isSelected 
                      ? 'bg-amber-100/90 border-orange-500 shadow-sm ring-2 ring-orange-500/50' 
                      : isToday 
                      ? 'bg-orange-50/60 border-orange-300' 
                      : 'bg-white hover:bg-amber-50/40 border-stone-200'
                    }
                  `}
                >
                  <div className="flex justify-between items-center">
                    <span className={`text-xs font-bold font-mono ${isToday ? 'text-red-600' : 'text-stone-900'}`}>
                      {item.day}
                    </span>
                    {isToday && (
                      <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                    )}
                  </div>

                  {/* Badges */}
                  <div className="space-y-0.5 mt-1">
                    {arrivalsCount > 0 && (
                      <span className="flex items-center gap-1 text-[9px] sm:text-[10px] px-1 py-0.2 rounded bg-orange-100 text-orange-900 font-bold truncate">
                        <UserPlus className="w-2.5 h-2.5 shrink-0" />
                        <span>{arrivalsCount} In</span>
                      </span>
                    )}

                    {departuresCount > 0 && (
                      <span className="flex items-center gap-1 text-[9px] sm:text-[10px] px-1 py-0.2 rounded bg-red-100 text-red-900 font-bold truncate">
                        <LogOut className="w-2.5 h-2.5 shrink-0" />
                        <span>{departuresCount} Out</span>
                      </span>
                    )}

                    {billsCount > 0 && (
                      <span className="flex items-center gap-1 text-[9px] sm:text-[10px] px-1 py-0.2 rounded bg-stone-100 text-stone-800 font-medium truncate">
                        <Receipt className="w-2.5 h-2.5 shrink-0" />
                        <span>{billsCount} Bills</span>
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Date Detail Panel (Span 1) */}
        <div className="space-y-4">
          <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200/80 shadow-xs p-5 space-y-4">
            <div className="border-b border-amber-100 pb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-orange-800">
                Date Schedule Details
              </span>
              <h3 className="text-base font-extrabold text-stone-900 font-['Outfit',sans-serif] mt-0.5">
                {formatDateForDisplay(selectedDateStr)}
              </h3>
            </div>

            {/* Check-ins on this date */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-stone-800 mb-2">
                <span className="flex items-center gap-1.5 text-orange-900">
                  <UserPlus className="w-3.5 h-3.5 text-orange-600" />
                  <span>Arrivals ({selectedArrivals.length})</span>
                </span>
              </div>

              {selectedArrivals.length === 0 ? (
                <p className="text-[11px] text-stone-400 italic">No check-ins on this date.</p>
              ) : (
                <div className="space-y-1.5">
                  {selectedArrivals.map(s => (
                    <div key={s.stayId} className="p-2 rounded-xl bg-orange-50/70 border border-orange-200 text-xs">
                      <div className="flex justify-between font-bold text-stone-900">
                        <span className="uppercase">{s.guestName}</span>
                        <span className="font-mono text-orange-950 font-bold">Room {s.roomNumber}</span>
                      </div>
                      <div className="text-[10px] text-stone-500 mt-0.5">
                        {formatTime12H(s.checkInTime)} • {s.guestPhone}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Check-outs on this date */}
            <div className="pt-2 border-t border-amber-100">
              <div className="flex items-center justify-between text-xs font-bold text-stone-800 mb-2">
                <span className="flex items-center gap-1.5 text-red-900">
                  <LogOut className="w-3.5 h-3.5 text-red-600" />
                  <span>Departures ({selectedDepartures.length})</span>
                </span>
              </div>

              {selectedDepartures.length === 0 ? (
                <p className="text-[11px] text-stone-400 italic">No departures on this date.</p>
              ) : (
                <div className="space-y-1.5">
                  {selectedDepartures.map(s => (
                    <div key={s.stayId} className="p-2 rounded-xl bg-red-50/70 border border-red-200 text-xs">
                      <div className="flex justify-between font-bold text-stone-900">
                        <span className="uppercase">{s.guestName}</span>
                        <span className="font-mono text-red-950 font-bold">Room {s.roomNumber}</span>
                      </div>
                      <div className="text-[10px] text-stone-500 mt-0.5">
                        Exp: {formatTime12H(s.expectedCheckOutTime)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bills on this date */}
            <div className="pt-2 border-t border-amber-100">
              <div className="flex items-center justify-between text-xs font-bold text-stone-800 mb-2">
                <span className="flex items-center gap-1.5 text-stone-900">
                  <Receipt className="w-3.5 h-3.5 text-amber-600" />
                  <span>Tax Bills ({selectedBills.length})</span>
                </span>
              </div>

              {selectedBills.length === 0 ? (
                <p className="text-[11px] text-stone-400 italic">No bills recorded on this date.</p>
              ) : (
                <div className="space-y-1.5">
                  {selectedBills.map(b => (
                    <div key={b.billId} className="p-2 rounded-xl bg-white border border-amber-200 text-xs flex justify-between items-center">
                      <div>
                        <div className="font-mono font-bold text-stone-900">{b.billNo}</div>
                        <div className="text-[10px] text-stone-500">{b.guestName}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-stone-900">{formatINR(b.grossTotal)}</span>
                        <button
                          onClick={() => onViewBill(b)}
                          className="p-1 bg-stone-900 text-amber-300 rounded hover:bg-stone-800 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
