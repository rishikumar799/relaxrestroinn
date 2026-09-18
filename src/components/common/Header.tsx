import React from 'react';
import { Hotel, Wifi, WifiOff, LogOut, User as UserIcon, PlusCircle, Receipt, BedDouble } from 'lucide-react';
import { User } from 'firebase/auth';
import { HotelSettings } from '../../types';

interface HeaderProps {
  user: User | null;
  settings?: HotelSettings;
  currentPage: string;
  isOnline: boolean;
  onLogout: () => void;
  onNavigate: (page: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  settings,
  currentPage,
  isOnline,
  onLogout,
  onNavigate,
}) => {
  const pageTitles: Record<string, string> = {
    dashboard: 'Front Desk Dashboard',
    checkin: 'New Guest Check-in',
    checkout: 'Guest Check-out & Invoicing',
    bills: 'Tax Invoices & Bill History',
    manual_bill: 'Add Manual / Old Tax Bill',
    rooms: 'Room Management & Occupancy',
    guests: 'Guest Records & Profiles',
    calendar: 'Calendar & Bookings',
    payments: 'Payment Records & Collections',
    reports: 'Financial & Occupancy Reports',
    settings: 'Hotel & GST Settings',
  };

  return (
    <header className="no-print bg-[#FFFDF9] border-b border-amber-200/80 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Brand & Page Info */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 via-orange-500 to-amber-500 p-0.5 shadow-sm shadow-orange-500/20 flex items-center justify-center">
                <div className="w-full h-full bg-stone-900 rounded-[10px] flex items-center justify-center">
                  <Hotel className="w-5 h-5 text-amber-400" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-sm sm:text-base tracking-tight text-amber-950 font-['Outfit',sans-serif]">
                    {settings?.hotelName || 'RELAX RESTO INN'}
                  </span>
                  <span className="hidden md:inline-block text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider bg-orange-100/80 text-orange-900 rounded-full border border-orange-200">
                    Front Desk Admin
                  </span>
                </div>
                <p className="text-xs text-stone-700 font-medium hidden sm:block">
                  {pageTitles[currentPage] || 'Hotel Billing System'}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Action Shortcuts & Status */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Checkin button */}
            <button
              onClick={() => onNavigate('checkin')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white shadow-xs shadow-orange-600/20 transition-all cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>+ Check-in</span>
            </button>

            {/* Quick Bill button */}
            <button
              onClick={() => onNavigate('manual_bill')}
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-100 hover:bg-amber-200/80 text-amber-950 border border-amber-300 transition-colors cursor-pointer"
            >
              <Receipt className="w-3.5 h-3.5 text-amber-700" />
              <span>+ Manual Bill</span>
            </button>

            {/* Network Online/Offline Pill */}
            <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${
              isOnline 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                : 'bg-amber-50 text-amber-800 border-amber-300 animate-pulse'
            }`}>
              {isOnline ? (
                <>
                  <Wifi className="w-3 h-3 text-emerald-600" />
                  <span className="hidden lg:inline">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-amber-600" />
                  <span>Offline (Cached)</span>
                </>
              )}
            </div>

            {/* Admin User Info & Logout */}
            <div className="flex items-center gap-2 pl-2 border-l border-amber-200">
              <div className="hidden lg:flex flex-col text-right">
                <span className="text-xs font-bold text-stone-900 truncate max-w-[130px]">
                  {user?.email || 'admin'}
                </span>
                <span className="text-[10px] text-amber-800 font-medium">Authorized Admin</span>
              </div>

              <button
                onClick={onLogout}
                title="Log out of Relax Resto Inn"
                className="p-2 text-stone-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
