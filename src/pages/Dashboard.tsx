import React, { useState, useEffect } from 'react';
import { 
  UserPlus, 
  LogOut, 
  Receipt, 
  BedDouble, 
  Users, 
  CalendarDays, 
  TrendingUp, 
  AlertCircle, 
  PlusCircle, 
  ArrowUpRight, 
  Eye, 
  Printer, 
  Clock, 
  RefreshCw,
  Sparkles,
  CreditCard,
  FileText,
  BookmarkCheck
} from 'lucide-react';
import { Bill, Room, Stay, HotelSettings, Payment, ActivityLog, Reservation } from '../types';
import { getRooms, subscribeToRooms } from '../services/roomService';
import { getActiveStays, subscribeToActiveStays } from '../services/stayService';
import { getBills, subscribeToBills } from '../services/billService';
import { getAllPayments } from '../services/paymentService';
import { getRecentActivities } from '../services/activityService';
import { getReservations, subscribeToReservations } from '../services/reservationService';
import { formatINR } from '../utils/currency';
import { formatDateForDisplay, getTodayDateString, formatTime12H } from '../utils/date';

interface DashboardProps {
  settings?: HotelSettings;
  onNavigate: (page: string, params?: any) => void;
  onViewBill: (bill: Bill) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  settings,
  onNavigate,
  onViewBill,
}) => {
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeStays, setActiveStays] = useState<Stay[]>([]);
  const [recentBills, setRecentBills] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);

  const todayStr = getTodayDateString();

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [roomsData, staysData, billsData, paymentsData, activitiesData, resData] = await Promise.all([
        getRooms(),
        getActiveStays(),
        getBills(20),
        getAllPayments(100),
        getRecentActivities(10),
        getReservations(),
      ]);

      setRooms(roomsData);
      setActiveStays(staysData);
      setRecentBills(billsData);
      setPayments(paymentsData);
      setActivities(activitiesData);
      setReservations(resData);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    loadDashboardData();

    // Real-time Firestore subscriptions for instant live updates across all devices
    const unsubRooms = subscribeToRooms((roomsData) => {
      setRooms(roomsData);
      setLoading(false);
    });

    const unsubStays = subscribeToActiveStays((staysData) => {
      setActiveStays(staysData);
    });

    const unsubBills = subscribeToBills((billsData) => {
      setRecentBills(billsData.slice(0, 20));
    });

    const unsubRes = subscribeToReservations((resData) => {
      setReservations(resData);
    });

    return () => {
      unsubRooms();
      unsubStays();
      unsubBills();
      unsubRes();
    };
  }, []);

  // Compute metrics purely from Firestore data
  const totalRoomsCount = rooms.length;
  const availableRoomsCount = rooms.filter(r => r.status === 'Available').length;
  const occupiedRoomsCount = rooms.filter(r => r.status === 'Occupied').length;
  const reservedRoomsCount = rooms.filter(r => r.status === 'Reserved').length;
  
  const todayCheckIns = activeStays.filter(s => s.checkInDate === todayStr).length;
  const todayExpectedCheckOuts = activeStays.filter(s => s.expectedCheckOutDate === todayStr).length;

  const upcomingReservations = reservations.filter(r => r.status === 'CONFIRMED' || r.status === 'PENDING');

  const todayRevenue = payments
    .filter(p => p.paymentDate === todayStr)
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const pendingBalanceTotal = activeStays.reduce((sum, s) => sum + (s.balanceDue || 0), 0);
  const totalBillsCount = recentBills.length;

  const todayDateFormatted = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner / Welcome */}
      <div className="bg-gradient-to-r from-stone-900 via-amber-950 to-stone-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-amber-800/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-full bg-gradient-to-l from-orange-600/10 via-amber-500/5 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Front Desk Control Center</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-amber-50 font-['Outfit',sans-serif]">
              {settings?.hotelName || 'RELAX RESTO INN'}
            </h1>
            <p className="text-xs sm:text-sm text-stone-300 mt-1">
              {todayDateFormatted} • Visakhapatnam, Andhra Pradesh
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => onNavigate('checkin', { tab: 'walkin' })}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white text-xs font-bold shadow-lg shadow-orange-950/50 transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>New Check-in</span>
            </button>

            <button
              onClick={() => onNavigate('checkin', { tab: 'new_reservation' })}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-300 text-xs font-bold border border-amber-500/30 transition-all cursor-pointer"
            >
              <BookmarkCheck className="w-4 h-4 text-amber-400" />
              <span>New Reservation</span>
            </button>

            <button
              onClick={() => onNavigate('manual_bill')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold border border-stone-700 transition-all cursor-pointer"
            >
              <FileText className="w-4 h-4 text-stone-400" />
              <span>Manual Bill</span>
            </button>

            <button
              onClick={loadDashboardData}
              disabled={loading}
              title="Refresh live data"
              className="p-2.5 bg-stone-800/80 hover:bg-stone-700 text-stone-300 rounded-xl border border-stone-700 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 8 Metric KPI Cards in Warm Colors */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Today's Check-ins */}
        <div className="bg-[#FFFDF9] p-4 rounded-2xl border border-amber-200/80 shadow-xs hover:border-orange-300 transition-all">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider">Today's Check-ins</span>
            <div className="p-2 rounded-xl bg-orange-100 text-orange-700">
              <UserPlus className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-stone-900 font-['Outfit',sans-serif]">
            {todayCheckIns}
          </div>
          <p className="text-[11px] text-orange-800 font-medium mt-0.5">Guests arrived today</p>
        </div>

        {/* Today's Check-outs */}
        <div className="bg-[#FFFDF9] p-4 rounded-2xl border border-amber-200/80 shadow-xs hover:border-red-300 transition-all">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider">Due Check-outs</span>
            <div className="p-2 rounded-xl bg-red-100 text-red-700">
              <LogOut className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-stone-900 font-['Outfit',sans-serif]">
            {todayExpectedCheckOuts}
          </div>
          <p className="text-[11px] text-red-800 font-medium mt-0.5">Departures scheduled</p>
        </div>

        {/* Currently Staying */}
        <div className="bg-[#FFFDF9] p-4 rounded-2xl border border-amber-200/80 shadow-xs hover:border-amber-300 transition-all">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider">Currently Staying</span>
            <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-stone-900 font-['Outfit',sans-serif]">
            {activeStays.length}
          </div>
          <p className="text-[11px] text-amber-900 font-medium mt-0.5">Active checked-in guests</p>
        </div>

        {/* Available Rooms */}
        <div 
          onClick={() => onNavigate('rooms')}
          className="bg-[#FFFDF9] p-4 rounded-2xl border border-amber-200/80 shadow-xs hover:border-emerald-300 transition-all cursor-pointer"
        >
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider">Available Rooms</span>
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
              <BedDouble className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-700 font-['Outfit',sans-serif]">
            {availableRoomsCount} <span className="text-xs text-stone-500 font-normal">/ {totalRoomsCount}</span>
          </div>
          <p className="text-[11px] text-emerald-800 font-medium mt-0.5">Ready for check-in</p>
        </div>

        {/* Occupied Rooms */}
        <div 
          onClick={() => onNavigate('rooms')}
          className="bg-[#FFFDF9] p-4 rounded-2xl border border-amber-200/80 shadow-xs hover:border-orange-300 transition-all cursor-pointer"
        >
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider">Occupied Rooms</span>
            <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
              <BedDouble className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-stone-900 font-['Outfit',sans-serif]">
            {occupiedRoomsCount}
          </div>
          <p className="text-[11px] text-stone-600 font-medium mt-0.5">
            {totalRoomsCount > 0 ? `${Math.round((occupiedRoomsCount / totalRoomsCount) * 100)}% occupancy` : '0%'}
          </p>
        </div>

        {/* Today's Revenue */}
        <div className="bg-[#FFFDF9] p-4 rounded-2xl border border-amber-200/80 shadow-xs hover:border-amber-400 transition-all">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider">Today's Revenue</span>
            <div className="p-2 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-stone-900 font-mono">
            {formatINR(todayRevenue)}
          </div>
          <p className="text-[11px] text-amber-900 font-medium mt-0.5">Collected payments today</p>
        </div>

        {/* Pending Balance */}
        <div className="bg-[#FFFDF9] p-4 rounded-2xl border border-amber-200/80 shadow-xs hover:border-red-300 transition-all">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider">Stay Balance Due</span>
            <div className="p-2 rounded-xl bg-rose-100 text-rose-700">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-rose-700 font-mono">
            {formatINR(pendingBalanceTotal)}
          </div>
          <p className="text-[11px] text-rose-800 font-medium mt-0.5">From active stays</p>
        </div>

        {/* Active Reservations */}
        <div 
          onClick={() => onNavigate('checkin', { tab: 'from_reservation' })}
          className="bg-[#FFFDF9] p-4 rounded-2xl border border-amber-200/80 shadow-xs hover:border-blue-300 transition-all cursor-pointer"
        >
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider">Reservations</span>
            <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
              <BookmarkCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-blue-900 font-['Outfit',sans-serif]">
            {upcomingReservations.length}
          </div>
          <p className="text-[11px] text-blue-800 font-medium mt-0.5">Confirmed upcoming bookings</p>
        </div>
      </div>

      {/* Main Grid: Active Stays (Left) & Recent Activity / Quick Actions (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Stays Table (Span 2) */}
        <div className="lg:col-span-2 bg-[#FFFDF9] rounded-2xl border border-amber-200/80 shadow-xs p-5 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="font-bold text-base text-stone-900 font-['Outfit',sans-serif]">
                Currently Staying Guests ({activeStays.length})
              </h2>
            </div>

            <button
              onClick={() => onNavigate('checkout')}
              className="text-xs font-bold text-orange-800 hover:text-orange-950 flex items-center gap-1 cursor-pointer"
            >
              <span>Manage Check-outs</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {activeStays.length === 0 ? (
            <div className="py-12 text-center text-stone-500 flex-1 flex flex-col items-center justify-center border-2 border-dashed border-amber-100 rounded-xl">
              <BedDouble className="w-10 h-10 text-amber-300 mb-2" />
              <p className="text-sm font-semibold text-stone-700">No active stays right now.</p>
              <p className="text-xs text-stone-500 mt-0.5">Click + New Check-in to register arriving guests.</p>
              <button
                onClick={() => onNavigate('checkin', { tab: 'walkin' })}
                className="mt-3 px-4 py-1.5 bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                + New Walk-in Check-in
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-amber-50/60 text-stone-700 font-bold uppercase text-[10px] tracking-wider border-b border-amber-200">
                  <tr>
                    <th className="p-2.5">Room</th>
                    <th className="p-2.5">Guest</th>
                    <th className="p-2.5">Check-in</th>
                    <th className="p-2.5">Exp. Check-out</th>
                    <th className="p-2.5 text-right">Tariff</th>
                    <th className="p-2.5 text-right">Balance</th>
                    <th className="p-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100">
                  {activeStays.map((stay) => (
                    <tr key={stay.stayId} className="hover:bg-amber-50/40 transition-colors">
                      <td className="p-2.5 font-bold text-stone-900">
                        <span className="px-2 py-0.5 rounded-md bg-stone-900 text-amber-300 font-mono font-bold">
                          {stay.roomNumber}
                        </span>
                        <span className="block text-[10px] text-stone-500 font-normal mt-0.5">{stay.roomType}</span>
                      </td>
                      <td className="p-2.5">
                        <div className="font-bold text-stone-900">{stay.guestName}</div>
                        <div className="text-[11px] text-stone-500">{stay.guestPhone}</div>
                      </td>
                      <td className="p-2.5 text-stone-700">
                        {formatDateForDisplay(stay.checkInDate)}
                        <span className="block text-[10px] text-stone-500">{formatTime12H(stay.checkInTime)}</span>
                      </td>
                      <td className="p-2.5 text-stone-700">
                        {formatDateForDisplay(stay.expectedCheckOutDate)}
                        <span className="block text-[10px] text-stone-500">{formatTime12H(stay.expectedCheckOutTime)}</span>
                      </td>
                      <td className="p-2.5 text-right font-mono font-semibold text-stone-900">
                        {formatINR(stay.roomTariff)}/d
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-amber-950">
                        {formatINR(stay.balanceDue)}
                      </td>
                      <td className="p-2.5 text-center">
                        <button
                          onClick={() => onNavigate('checkout', { stayId: stay.stayId })}
                          className="px-2.5 py-1 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white rounded-md text-[11px] font-bold shadow-xs cursor-pointer"
                        >
                          Check-out
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Actions & Recent Activity (Span 1) */}
        <div className="space-y-6">
          {/* Quick Shortcuts */}
          <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200/80 shadow-xs p-5">
            <h2 className="font-bold text-sm text-stone-900 font-['Outfit',sans-serif] mb-3">
              Quick Operations
            </h2>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => onNavigate('checkin', { tab: 'walkin' })}
                className="p-3 rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 text-left hover:border-orange-400 transition-all cursor-pointer group"
              >
                <UserPlus className="w-4 h-4 text-orange-600 mb-1 group-hover:scale-110 transition-transform" />
                <div className="font-bold text-stone-900">Check-in</div>
                <div className="text-[10px] text-stone-500">Register arrival</div>
              </button>

              <button
                onClick={() => onNavigate('checkin', { tab: 'new_reservation' })}
                className="p-3 rounded-xl bg-gradient-to-br from-blue-50 to-amber-50 border border-blue-200 text-left hover:border-blue-400 transition-all cursor-pointer group"
              >
                <BookmarkCheck className="w-4 h-4 text-blue-600 mb-1 group-hover:scale-110 transition-transform" />
                <div className="font-bold text-stone-900">Reservation</div>
                <div className="text-[10px] text-stone-500">Future booking</div>
              </button>

              <button
                onClick={() => onNavigate('checkout')}
                className="p-3 rounded-xl bg-gradient-to-br from-red-50 to-orange-50 border border-red-200 text-left hover:border-red-400 transition-all cursor-pointer group"
              >
                <LogOut className="w-4 h-4 text-red-600 mb-1 group-hover:scale-110 transition-transform" />
                <div className="font-bold text-stone-900">Check-out</div>
                <div className="text-[10px] text-stone-500">Generate invoice</div>
              </button>

              <button
                onClick={() => onNavigate('calendar')}
                className="p-3 rounded-xl bg-gradient-to-br from-stone-50 to-amber-50/40 border border-stone-200 text-left hover:border-amber-400 transition-all cursor-pointer group"
              >
                <CalendarDays className="w-4 h-4 text-stone-700 mb-1 group-hover:scale-110 transition-transform" />
                <div className="font-bold text-stone-900">Calendar</div>
                <div className="text-[10px] text-stone-500">Room schedule</div>
              </button>
            </div>
          </div>

          {/* Audit Activity Stream */}
          <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200/80 shadow-xs p-5">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold text-sm text-stone-900 font-['Outfit',sans-serif]">
                Audit Activity Log
              </h2>
              <Clock className="w-3.5 h-3.5 text-stone-400" />
            </div>

            {activities.length === 0 ? (
              <p className="text-xs text-stone-500 py-3 text-center">No recent activities logged.</p>
            ) : (
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {activities.map((act) => (
                  <div key={act.logId} className="text-xs p-2 rounded-lg bg-amber-50/40 border border-amber-100">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-stone-800 text-[11px]">{act.action}</span>
                      <span className="text-[10px] text-stone-400">
                        {act.timestamp?.toDate ? act.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-600 mt-0.5">{act.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Tax Invoices Table */}
      <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200/80 shadow-xs p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-base text-stone-900 font-['Outfit',sans-serif]">
            Recent Tax Invoices
          </h2>
          <button
            onClick={() => onNavigate('bills')}
            className="text-xs font-bold text-orange-800 hover:text-orange-950 flex items-center gap-1 cursor-pointer"
          >
            <span>View All Bills</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentBills.length === 0 ? (
          <div className="py-8 text-center text-stone-500 text-xs">
            No bills generated yet. Checkout a stay or add a manual bill to create tax invoices.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-amber-50/60 text-stone-700 font-bold uppercase text-[10px] tracking-wider border-b border-amber-200">
                <tr>
                  <th className="p-2.5">Invoice No</th>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Guest Name</th>
                  <th className="p-2.5">Room</th>
                  <th className="p-2.5 text-right">Taxable (₹)</th>
                  <th className="p-2.5 text-right">GST (₹)</th>
                  <th className="p-2.5 text-right">Gross Total (₹)</th>
                  <th className="p-2.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100">
                {recentBills.map((bill) => (
                  <tr key={bill.billId} className="hover:bg-amber-50/40 transition-colors">
                    <td className="p-2.5 font-bold font-mono text-orange-900">
                      {bill.billNo}
                    </td>
                    <td className="p-2.5 text-stone-700 font-mono">
                      {formatDateForDisplay(bill.billDate)}
                    </td>
                    <td className="p-2.5 font-bold text-stone-900">
                      {bill.guestName}
                    </td>
                    <td className="p-2.5 font-mono">
                      {bill.roomNumber}
                    </td>
                    <td className="p-2.5 text-right font-mono text-stone-700">
                      {formatINR(bill.taxableAmount)}
                    </td>
                    <td className="p-2.5 text-right font-mono text-stone-700">
                      {formatINR(bill.totalGST)}
                    </td>
                    <td className="p-2.5 text-right font-mono font-black text-stone-950">
                      {formatINR(bill.grossTotal)}
                    </td>
                    <td className="p-2.5 text-center">
                      <button
                        onClick={() => onViewBill(bill)}
                        className="px-2.5 py-1 bg-stone-900 hover:bg-stone-800 text-amber-300 rounded-md text-[11px] font-bold shadow-xs cursor-pointer inline-flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>View Bill</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
