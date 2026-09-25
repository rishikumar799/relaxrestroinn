import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './services/firebase';
import { logoutAdmin } from './services/authService';
import { HotelSettings, Bill, Stay, Room } from './types';
import { getHotelSettings } from './services/settingsService';
import { getActiveStays, subscribeToActiveStays } from './services/stayService';
import { getRooms, subscribeToRooms } from './services/roomService';

// Layout & Common Components
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { ToastProvider, useToast } from './components/common/Toast';
import { InvoiceModal } from './components/invoice/InvoiceModal';

// Pages
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { CheckIn } from './pages/CheckIn';
import { CheckOut } from './pages/CheckOut';
import { ManualBill } from './pages/ManualBill';
import { Bills } from './pages/Bills';
import { Rooms } from './pages/Rooms';
import { Guests } from './pages/Guests';
import { CalendarView } from './pages/CalendarView';
import { Payments } from './pages/Payments';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { Menu } from 'lucide-react';

const MainApp: React.FC = () => {
  const toast = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [settings, setSettings] = useState<HotelSettings | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState<string>('dashboard');
  const [pageParams, setPageParams] = useState<any>(null);

  // Live sidebar badges
  const [activeStaysCount, setActiveStaysCount] = useState(0);
  const [availableRoomsCount, setAvailableRoomsCount] = useState(0);

  // Mobile sidebar open state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Active Bill Modal
  const [activeBillModal, setActiveBillModal] = useState<Bill | null>(null);

  // Listen to network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auth observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const loadInitialSettingsAndCounts = async () => {
    try {
      const s = await getHotelSettings();
      setSettings(s);
    } catch (e) {
      // ignore
    }
  };

  // Real-time subscriptions for stays and rooms badges
  useEffect(() => {
    loadInitialSettingsAndCounts();

    const unsubStays = subscribeToActiveStays((stays) => {
      setActiveStaysCount(stays.length);
    });

    const unsubRooms = subscribeToRooms((roomsList) => {
      setAvailableRoomsCount(roomsList.filter(r => r.status === 'Available').length);
    });

    return () => {
      unsubStays();
      unsubRooms();
    };
  }, [user]);

  const handleNavigate = (page: string, params?: any) => {
    setCurrentPage(page);
    setPageParams(params || null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = async () => {
    try {
      await logoutAdmin();
      setUser(null);
      setCurrentPage('dashboard');
      toast.info('Logged Out', 'You have been signed out of the front desk.');
    } catch (err: any) {
      setUser(null);
      toast.info('Logged Out', 'Signed out.');
    }
  };

  // If unauthenticated, show warm Admin Login
  if (!authLoading && !user) {
    return (
      <Login
        settings={settings}
        onLoginSuccess={() => {
          loadInitialSettingsAndCounts();
          setCurrentPage('dashboard');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFF8EE] via-[#FFF3E0]/70 to-[#FFEBE5]/60 text-stone-900 font-['Plus_Jakarta_Sans',sans-serif] flex flex-col">
      {/* Top Header */}
      <Header
        user={user}
        settings={settings}
        currentPage={currentPage}
        isOnline={isOnline}
        onLogout={handleLogout}
        onNavigate={handleNavigate}
      />

      {/* Main Body Layout */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Sidebar */}
        <Sidebar
          currentPage={currentPage}
          onNavigate={handleNavigate}
          activeStaysCount={activeStaysCount}
          availableRoomsCount={availableRoomsCount}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />

        {/* Content View */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
          {/* Mobile hamburger button */}
          <div className="lg:hidden mb-4 flex items-center justify-between no-print">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-amber-300 text-stone-800 text-xs font-bold shadow-xs cursor-pointer"
            >
              <Menu className="w-4 h-4 text-orange-600" />
              <span>Menu Navigation</span>
            </button>

            <span className="text-xs font-bold text-amber-950 font-mono">
              {settings?.hotelName || 'RELAX RESTO INN'}
            </span>
          </div>

          {/* Page Routing Switcher */}
          {currentPage === 'dashboard' && (
            <Dashboard
              settings={settings}
              onNavigate={handleNavigate}
              onViewBill={(bill) => setActiveBillModal(bill)}
            />
          )}

          {currentPage === 'checkin' && (
            <CheckIn
              settings={settings}
              initialTab={pageParams?.tab || 'walkin'}
              initialReservationId={pageParams?.reservationId}
              onSuccess={(stay) => {
                loadInitialSettingsAndCounts();
                handleNavigate('dashboard');
              }}
              onCancel={() => handleNavigate('dashboard')}
            />
          )}

          {currentPage === 'checkout' && (
            <CheckOut
              settings={settings}
              preSelectedStayId={pageParams?.stayId}
              onCheckOutComplete={(bill) => {
                loadInitialSettingsAndCounts();
                setActiveBillModal(bill);
              }}
              onCancel={() => handleNavigate('dashboard')}
            />
          )}

          {currentPage === 'manual_bill' && (
            <ManualBill
              settings={settings}
              onSuccess={(bill) => {
                loadInitialSettingsAndCounts();
                setActiveBillModal(bill);
              }}
              onCancel={() => handleNavigate('bills')}
            />
          )}

          {currentPage === 'bills' && (
            <Bills
              settings={settings}
              onViewBill={(bill) => setActiveBillModal(bill)}
              onNewManualBill={() => handleNavigate('manual_bill')}
            />
          )}

          {currentPage === 'rooms' && (
            <Rooms
              settings={settings}
              onNavigate={handleNavigate}
              onCheckInRoom={(room) => handleNavigate('checkin', { tab: 'walkin', roomId: room.roomId })}
            />
          )}

          {currentPage === 'guests' && (
            <Guests
              onViewBill={(bill) => setActiveBillModal(bill)}
            />
          )}

          {currentPage === 'calendar' && (
            <CalendarView
              settings={settings}
              onViewBill={(bill) => setActiveBillModal(bill)}
              onCheckIn={(params) => handleNavigate('checkin', params)}
            />
          )}

          {currentPage === 'payments' && (
            <Payments
              settings={settings}
              onViewBill={(bill) => setActiveBillModal(bill)}
            />
          )}

          {currentPage === 'reports' && (
            <Reports
              settings={settings}
            />
          )}

          {currentPage === 'settings' && (
            <Settings
              settings={settings}
              onSettingsUpdated={(newSet) => setSettings(newSet)}
            />
          )}
        </main>
      </div>

      {/* Global Invoice Modal View */}
      {activeBillModal && (
        <InvoiceModal
          bill={activeBillModal}
          settings={settings}
          onClose={() => setActiveBillModal(null)}
        />
      )}
    </div>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <MainApp />
    </ToastProvider>
  );
}
