import React from 'react';
import { 
  LayoutDashboard, 
  UserPlus, 
  LogOut as CheckOutIcon, 
  Receipt, 
  FileText, 
  BedDouble, 
  Users, 
  CalendarDays, 
  CreditCard, 
  BarChart3, 
  Settings as SettingsIcon,
  Sparkles
} from 'lucide-react';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  activeStaysCount?: number;
  availableRoomsCount?: number;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  activeStaysCount = 0,
  availableRoomsCount = 0,
  mobileOpen = false,
  onCloseMobile,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'checkin', label: 'New Check-in', icon: UserPlus, badge: 'New' },
    { id: 'checkout', label: 'Check-out', icon: CheckOutIcon, count: activeStaysCount },
    { id: 'bills', label: 'Tax Bills', icon: Receipt },
    { id: 'manual_bill', label: 'Manual / Old Bill', icon: FileText },
    { id: 'rooms', label: 'Rooms', icon: BedDouble, count: availableRoomsCount, countLabel: 'Free' },
    { id: 'guests', label: 'Guest Directory', icon: Users },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'reports', label: 'Reports & GST', icon: BarChart3 },
    { id: 'settings', label: 'Hotel Settings', icon: SettingsIcon },
  ];

  const handleItemClick = (id: string) => {
    onNavigate(id);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-stone-900/60 z-40 lg:hidden backdrop-blur-xs"
          onClick={onCloseMobile}
        />
      )}

      <aside className={`
        fixed lg:sticky top-0 lg:top-16 z-40 lg:z-20
        h-full lg:h-[calc(100vh-4rem)]
        w-64 bg-stone-900 text-stone-300
        flex flex-col justify-between
        border-r border-stone-800
        transition-transform duration-300 ease-in-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Navigation list */}
        <div className="p-3.5 space-y-1 overflow-y-auto flex-1">
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-amber-500/80">
            Front Desk Operations
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={`
                  w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold
                  transition-all duration-150 cursor-pointer
                  ${isActive 
                    ? 'bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 text-white shadow-md shadow-orange-950/40 font-bold' 
                    : 'text-stone-300 hover:text-white hover:bg-stone-800/70'
                  }
                `}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-amber-400'}`} />
                  <span>{item.label}</span>
                </div>

                {item.count !== undefined && item.count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    isActive ? 'bg-black/30 text-white' : 'bg-stone-800 text-amber-300 border border-stone-700'
                  }`}>
                    {item.count} {item.countLabel || ''}
                  </span>
                )}

                {item.badge && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full font-extrabold uppercase bg-amber-400 text-stone-950">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom Banner */}
        <div className="p-3.5 border-t border-stone-800 bg-stone-950/70">
          <div className="p-3 rounded-xl bg-gradient-to-br from-amber-950/40 via-orange-950/30 to-red-950/40 border border-amber-800/40 text-xs">
            <div className="flex items-center gap-1.5 text-amber-400 font-bold mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Relax Resto Inn</span>
            </div>
            <p className="text-[11px] text-stone-400 leading-tight">
              Visakhapatnam Hotel Billing & GST Suite
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};
