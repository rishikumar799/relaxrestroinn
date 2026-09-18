import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  Building, 
  Calendar, 
  History, 
  CreditCard,
  Eye,
  UserCheck
} from 'lucide-react';
import { Guest, Stay, Bill } from '../types';
import { getGuests, searchGuests } from '../services/guestService';
import { getGuestStays } from '../services/stayService';
import { getBillsByGuestName } from '../services/billService';
import { formatINR } from '../utils/currency';
import { formatDateForDisplay } from '../utils/date';
import { useToast } from '../components/common/Toast';

interface GuestsProps {
  onViewBill: (bill: Bill) => void;
}

export const Guests: React.FC<GuestsProps> = ({ onViewBill }) => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Selected Guest Modal Details
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [guestHistoryLoading, setGuestHistoryLoading] = useState(false);
  const [guestStays, setGuestStays] = useState<Stay[]>([]);
  const [guestBills, setGuestBills] = useState<Bill[]>([]);

  const loadAllGuests = async () => {
    try {
      setLoading(true);
      const data = await getGuests(100);
      setGuests(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load guests', 'Could not retrieve guest directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllGuests();
  }, []);

  const handleSearch = async () => {
    try {
      setLoading(true);
      const results = await searchGuests(searchTerm.trim());
      setGuests(results);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectGuest = async (guest: Guest) => {
    setSelectedGuest(guest);
    try {
      setGuestHistoryLoading(true);
      const [stays, bills] = await Promise.all([
        getGuestStays(guest.guestId),
        getBillsByGuestName(guest.guestName),
      ]);
      setGuestStays(stays);
      setGuestBills(bills);
    } catch (err) {
      console.error(err);
    } finally {
      setGuestHistoryLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto pb-12 space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-amber-950 font-['Outfit',sans-serif]">
            Guest Directory & Stay History
          </h1>
          <p className="text-xs text-stone-600 mt-0.5">
            Maintain guest CRM, previous bookings, company GST details & billing logs
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200/80 shadow-xs p-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search by Guest Name, Mobile Number, or ID..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-amber-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Search
          </button>
          <button
            onClick={() => {
              setSearchTerm('');
              loadAllGuests();
            }}
            className="px-3 py-2 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Guests Table */}
      <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-stone-500">
            <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs">Loading guest profiles...</p>
          </div>
        ) : guests.length === 0 ? (
          <div className="py-16 text-center text-stone-500">
            <Users className="w-12 h-12 text-amber-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-stone-700">No guests in directory</p>
            <p className="text-xs text-stone-500 mt-0.5">Checked-in guests are automatically cataloged here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-amber-50/70 text-stone-700 font-bold uppercase text-[10px] tracking-wider border-b border-amber-200">
                <tr>
                  <th className="p-3">Guest Name</th>
                  <th className="p-3">Mobile & Email</th>
                  <th className="p-3">ID Document</th>
                  <th className="p-3">Company Details</th>
                  <th className="p-3 text-center">Stays</th>
                  <th className="p-3 text-right">Total Spent</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100 font-sans">
                {guests.map((g) => (
                  <tr key={g.guestId} className="hover:bg-amber-50/40 transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-stone-900 uppercase">{g.guestName}</div>
                      {g.address && <div className="text-[11px] text-stone-500 truncate max-w-xs">{g.address}</div>}
                    </td>
                    <td className="p-3">
                      <div className="text-stone-800 font-medium">{g.phone || '-'}</div>
                      <div className="text-[10px] text-stone-400">{g.email || ''}</div>
                    </td>
                    <td className="p-3 text-stone-700">
                      <span className="font-semibold text-stone-800">{g.idType || 'ID'}</span>
                      <div className="font-mono text-[10px] text-stone-500">{g.idNumber || '-'}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-stone-900">{g.companyName || '-'}</div>
                      {g.companyGSTIN && (
                        <div className="font-mono text-[10px] text-amber-900 font-bold">GSTIN: {g.companyGSTIN}</div>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold text-[11px]">
                        {g.totalStays || 1} stays
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-stone-900">
                      {formatINR(g.totalSpent || 0)}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleSelectGuest(g)}
                        className="px-2.5 py-1 bg-stone-900 hover:bg-stone-800 text-amber-300 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        History
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Guest Profile & Stay History Modal */}
      {selectedGuest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200 shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-amber-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-orange-600" />
                  <h3 className="text-base font-extrabold uppercase text-stone-900 font-['Outfit',sans-serif]">
                    {selectedGuest.guestName}
                  </h3>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  Phone: {selectedGuest.phone || '-'} • Address: {selectedGuest.address || 'N/A'}
                </p>
              </div>

              <div className="text-right">
                <div className="text-xs text-stone-500">Lifetime Spent</div>
                <div className="text-base font-mono font-black text-amber-950">
                  {formatINR(selectedGuest.totalSpent || 0)}
                </div>
              </div>
            </div>

            {/* Invoices List for this Guest */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-950 font-['Outfit',sans-serif] mb-2">
                Invoices & Tax Bills ({guestBills.length})
              </h4>

              {guestHistoryLoading ? (
                <p className="text-xs text-stone-400 py-4 text-center">Loading guest invoices...</p>
              ) : guestBills.length === 0 ? (
                <p className="text-xs text-stone-500 py-3 text-center bg-stone-50 rounded-xl">
                  No invoices recorded yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {guestBills.map((b) => (
                    <div
                      key={b.billId}
                      className="p-3 rounded-xl border border-amber-200 bg-white flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-stone-900">{b.billNo}</span>
                          <span className="text-[10px] px-1.5 py-0.2 bg-stone-100 text-stone-700 rounded font-mono">
                            Room {b.roomNumber}
                          </span>
                        </div>
                        <div className="text-[11px] text-stone-500 mt-0.5">
                          Date: {formatDateForDisplay(b.billDate)}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-mono font-bold text-stone-950">{formatINR(b.grossTotal)}</div>
                          <div className="text-[10px] text-emerald-700 font-bold uppercase">{b.status}</div>
                        </div>

                        <button
                          onClick={() => {
                            setSelectedGuest(null);
                            onViewBill(b);
                          }}
                          className="p-1.5 bg-stone-900 text-amber-300 rounded-lg hover:bg-stone-800 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-amber-100">
              <button
                type="button"
                onClick={() => setSelectedGuest(null)}
                className="px-4 py-2 text-xs font-bold text-stone-700 hover:bg-stone-100 rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
