import React, { useState, useEffect } from 'react';
import { 
  BedDouble, 
  Plus, 
  Edit, 
  Trash2, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Wrench, 
  Brush, 
  Filter, 
  Building,
  DollarSign,
  User,
  Calendar,
  BookmarkCheck,
  Eye,
  ArrowRight
} from 'lucide-react';
import { Room, RoomStatus, PlanType, HotelSettings, Reservation, Stay } from '../types';
import { getRooms, updateRoomStatus, createRoom, updateRoom } from '../services/roomService';
import { getReservations } from '../services/reservationService';
import { getActiveStays } from '../services/stayService';
import { formatINR } from '../utils/currency';
import { formatDateForDisplay } from '../utils/date';
import { useToast } from '../components/common/Toast';

interface RoomsProps {
  settings?: HotelSettings;
  onCheckInRoom?: (room: Room) => void;
  onNavigate?: (page: string, params?: any) => void;
}

export const Rooms: React.FC<RoomsProps> = ({ settings, onCheckInRoom, onNavigate }) => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [activeStays, setActiveStays] = useState<Stay[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [floorFilter, setFloorFilter] = useState<string>('all');

  // Modal States
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [formRoomNumber, setFormRoomNumber] = useState('');
  const [formRoomType, setFormRoomType] = useState('Deluxe Room');
  const [formFloor, setFormFloor] = useState(2);
  const [formTariff, setFormTariff] = useState(1500);
  const [formPlanType, setFormPlanType] = useState<PlanType>('EP');
  const [formMaxAdults, setFormMaxAdults] = useState(2);
  const [formMaxChildren, setFormMaxChildren] = useState(1);
  const [formAmenities, setFormAmenities] = useState('AC, LED TV, Free Wi-Fi, Attached Bathroom');
  const [savingRoom, setSavingRoom] = useState(false);

  // Room Details & History Modal
  const [selectedRoomDetails, setSelectedRoomDetails] = useState<Room | null>(null);

  // Status Change Popover
  const [activeStatusModalRoom, setActiveStatusModalRoom] = useState<Room | null>(null);

  const loadRoomsData = async () => {
    try {
      setLoading(true);
      const [roomsData, resData, staysData] = await Promise.all([
        getRooms(),
        getReservations(),
        getActiveStays()
      ]);
      setRooms(roomsData);
      setReservations(resData);
      setActiveStays(staysData);
    } catch (err) {
      console.error('Error fetching rooms:', err);
      toast.error('Failed to load rooms', 'Could not load room list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoomsData();
  }, []);

  const handleOpenEdit = (room: Room, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingRoom(room);
    setFormRoomNumber(room.roomNumber);
    setFormRoomType(room.roomType);
    const parsedFloor = typeof room.floor === 'number' ? room.floor : parseInt(String(room.floor).replace(/\D/g, '') || '1', 10);
    setFormFloor(parsedFloor);
    setFormTariff(room.tariff || 1500);
    setFormPlanType(room.planType || 'EP');
    setFormMaxAdults(room.maxAdults || room.capacityAdults || 2);
    setFormMaxChildren(room.maxChildren || room.capacityChildren || 1);
    setFormAmenities(room.amenities?.join(', ') || '');
    setShowAddEditModal(true);
  };

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRoomNumber.trim()) {
      toast.error('Validation Error', 'Room number is required.');
      return;
    }

    try {
      setSavingRoom(true);
      const amenitiesArr = formAmenities.split(',').map(a => a.trim()).filter(Boolean);

      if (editingRoom) {
        await updateRoom(editingRoom.roomId, {
          roomNumber: formRoomNumber.trim(),
          roomType: formRoomType,
          floor: `${formFloor}${formFloor === 1 ? 'st' : formFloor === 2 ? 'nd' : formFloor === 3 ? 'rd' : 'th'} Floor`,
          tariff: formTariff,
          planType: formPlanType,
          capacityAdults: formMaxAdults,
          capacityChildren: formMaxChildren,
          maxAdults: formMaxAdults,
          maxChildren: formMaxChildren,
          amenities: amenitiesArr,
        });
        toast.success('Room Updated', `Room ${formRoomNumber} saved successfully.`);
      }

      setShowAddEditModal(false);
      loadRoomsData();
    } catch (err: any) {
      toast.error('Save Failed', err.message || 'Could not save room.');
    } finally {
      setSavingRoom(false);
    }
  };

  const handleStatusChange = async (roomId: string, newStatus: RoomStatus) => {
    try {
      await updateRoomStatus(roomId, newStatus);
      toast.success('Status Updated', `Room status changed to ${newStatus}.`);
      setActiveStatusModalRoom(null);
      if (selectedRoomDetails && selectedRoomDetails.roomId === roomId) {
        setSelectedRoomDetails({ ...selectedRoomDetails, status: newStatus });
      }
      loadRoomsData();
    } catch (err: any) {
      toast.error('Update Failed', err.message || 'Could not update room status.');
    }
  };

  // Filtered rooms
  const filteredRooms = rooms.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (floorFilter !== 'all' && String(r.floor) !== floorFilter) return false;
    return true;
  });

  // Strict 3 Floors in correct ascending order
  const floorOrder = ['1st Floor', '2nd Floor', '3rd Floor'];

  // Status Counts
  const availableCount = rooms.filter(r => r.status === 'Available').length;
  const occupiedCount = rooms.filter(r => r.status === 'Occupied').length;
  const reservedCount = rooms.filter(r => r.status === 'Reserved').length;
  const cleaningCount = rooms.filter(r => r.status === 'Cleaning').length;
  const maintenanceCount = rooms.filter(r => r.status === 'Maintenance').length;

  return (
    <div className="max-w-7xl mx-auto pb-12 space-y-6 animate-in fade-in duration-200">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-amber-950 font-['Outfit',sans-serif]">
            Room Inventory ({rooms.length} Rooms)
          </h1>
          <p className="text-xs text-stone-600 mt-0.5">
            1st Floor (101–105) • 2nd Floor (201–210) • 3rd Floor (301–309)
          </p>
        </div>

        {onNavigate && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('checkin', { tab: 'new_reservation' })}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-amber-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <BookmarkCheck className="w-4 h-4 text-amber-400" />
              <span>New Reservation</span>
            </button>
            <button
              onClick={() => onNavigate('checkin', { tab: 'walkin' })}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-orange-600/30 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Walk-in Check-in</span>
            </button>
          </div>
        )}
      </div>

      {/* KPI Status Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div 
          onClick={() => setStatusFilter(statusFilter === 'Available' ? 'all' : 'Available')}
          className={`p-3 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'Available' ? 'bg-emerald-50 border-emerald-400 shadow-sm' : 'bg-[#FFFDF9] border-amber-200/80 shadow-xs'
          }`}
        >
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Available</span>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-700 font-['Outfit',sans-serif] mt-1">{availableCount}</div>
          <span className="text-[10px] text-stone-500">Ready for check-in</span>
        </div>

        <div 
          onClick={() => setStatusFilter(statusFilter === 'Occupied' ? 'all' : 'Occupied')}
          className={`p-3 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'Occupied' ? 'bg-orange-50 border-orange-400 shadow-sm' : 'bg-[#FFFDF9] border-amber-200/80 shadow-xs'
          }`}
        >
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-orange-800 uppercase tracking-wider">Occupied</span>
            <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
          </div>
          <div className="text-2xl font-black text-orange-900 font-['Outfit',sans-serif] mt-1">{occupiedCount}</div>
          <span className="text-[10px] text-stone-500">Currently in-house</span>
        </div>

        <div 
          onClick={() => setStatusFilter(statusFilter === 'Reserved' ? 'all' : 'Reserved')}
          className={`p-3 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'Reserved' ? 'bg-blue-50 border-blue-400 shadow-sm' : 'bg-[#FFFDF9] border-amber-200/80 shadow-xs'
          }`}
        >
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Reserved</span>
            <BookmarkCheck className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-900 font-['Outfit',sans-serif] mt-1">{reservedCount}</div>
          <span className="text-[10px] text-stone-500">Upcoming arrivals</span>
        </div>

        <div 
          onClick={() => setStatusFilter(statusFilter === 'Cleaning' ? 'all' : 'Cleaning')}
          className={`p-3 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'Cleaning' ? 'bg-amber-50 border-amber-400 shadow-sm' : 'bg-[#FFFDF9] border-amber-200/80 shadow-xs'
          }`}
        >
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Cleaning</span>
            <Brush className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-900 font-['Outfit',sans-serif] mt-1">{cleaningCount}</div>
          <span className="text-[10px] text-stone-500">Housekeeping</span>
        </div>

        <div 
          onClick={() => setStatusFilter(statusFilter === 'Maintenance' ? 'all' : 'Maintenance')}
          className={`p-3 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'Maintenance' ? 'bg-red-50 border-red-400 shadow-sm' : 'bg-[#FFFDF9] border-amber-200/80 shadow-xs'
          }`}
        >
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-red-800 uppercase tracking-wider">Maintenance</span>
            <Wrench className="w-3.5 h-3.5 text-red-600" />
          </div>
          <div className="text-2xl font-black text-red-700 font-['Outfit',sans-serif] mt-1">{maintenanceCount}</div>
          <span className="text-[10px] text-stone-500">Out of order</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#FFFDF9] p-3 rounded-2xl border border-amber-200/80 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-stone-500 font-bold mr-1">Status:</span>
          {['all', 'Available', 'Occupied', 'Reserved', 'Cleaning', 'Maintenance', 'Blocked'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === st 
                  ? 'bg-stone-900 text-amber-300 shadow-xs' 
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              {st === 'all' ? 'All Rooms' : st}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-stone-500 font-bold">Floor:</span>
          <select
            value={floorFilter}
            onChange={(e) => setFloorFilter(e.target.value)}
            className="px-2.5 py-1 bg-white border border-stone-300 rounded-xl text-xs font-semibold"
          >
            <option value="all">All Floors (1st, 2nd, 3rd)</option>
            <option value="1st Floor">1st Floor (101-105)</option>
            <option value="2nd Floor">2nd Floor (201-210)</option>
            <option value="3rd Floor">3rd Floor (301-309)</option>
          </select>
        </div>
      </div>

      {/* Rooms Grid Grouped by Floor */}
      {loading ? (
        <div className="py-16 text-center text-stone-500">
          <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs">Loading room inventory...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {floorOrder.map((floorLabel) => {
            const floorRooms = filteredRooms.filter(r => String(r.floor) === floorLabel);
            if (floorRooms.length === 0) return null;

            return (
              <div key={floorLabel} className="space-y-3">
                <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-stone-900 text-amber-300 text-xs font-black font-mono">
                      {floorLabel.toUpperCase()}
                    </span>
                    <h2 className="font-bold text-sm text-stone-900 font-['Outfit',sans-serif]">
                      {floorLabel === '1st Floor' ? 'Rooms 101 – 105 (5 Rooms)' : floorLabel === '2nd Floor' ? 'Rooms 201 – 210 (10 Rooms)' : 'Rooms 301 – 309 (9 Rooms)'}
                    </h2>
                  </div>
                  <span className="text-xs text-stone-500 font-medium">
                    {floorRooms.filter(r => r.status === 'Available').length} Available
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
                  {floorRooms.map((room) => {
                    const isAvailable = room.status === 'Available';
                    const isOccupied = room.status === 'Occupied';
                    const isReserved = room.status === 'Reserved';
                    const isCleaning = room.status === 'Cleaning';
                    const isMaintenance = room.status === 'Maintenance';

                    const matchingStay = activeStays.find(s => s.roomId === room.roomId && s.status === 'active');
                    const matchingRes = reservations.find(r => r.roomId === room.roomId && (r.status === 'CONFIRMED' || r.status === 'PENDING'));

                    return (
                      <div
                        key={room.roomId}
                        onClick={() => setSelectedRoomDetails(room)}
                        className={`
                          bg-[#FFFDF9] rounded-2xl border p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer relative
                          ${isAvailable 
                            ? 'border-emerald-300 hover:border-emerald-500' 
                            : isOccupied 
                            ? 'border-orange-300 hover:border-orange-500 bg-orange-50/15' 
                            : isReserved
                            ? 'border-blue-300 hover:border-blue-500 bg-blue-50/15'
                            : isCleaning 
                            ? 'border-amber-300 hover:border-amber-500 bg-amber-50/30' 
                            : 'border-red-300 hover:border-red-500 bg-red-50/10'
                          }
                        `}
                      >
                        <div>
                          {/* Room Header */}
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-xl font-black font-mono text-stone-950">
                                {room.roomNumber}
                              </span>
                              <div className="text-[11px] font-bold text-stone-700">
                                {room.roomType}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveStatusModalRoom(room);
                              }}
                              className={`
                                text-[10px] font-extrabold px-2 py-0.5 rounded-full cursor-pointer transition-transform hover:scale-105
                                ${isAvailable ? 'bg-emerald-100 text-emerald-800' : isOccupied ? 'bg-orange-100 text-orange-900' : isReserved ? 'bg-blue-100 text-blue-900' : isCleaning ? 'bg-amber-100 text-amber-900' : 'bg-red-100 text-red-800'}
                              `}
                            >
                              {room.status} ▾
                            </button>
                          </div>

                          {/* Occupancy or Reservation Details */}
                          {isOccupied && matchingStay && (
                            <div className="mt-2.5 p-2 bg-orange-100/60 rounded-xl border border-orange-200 text-[10px]">
                              <div className="font-bold text-orange-950 truncate flex items-center gap-1">
                                <User className="w-3 h-3 text-orange-700" />
                                <span>{matchingStay.guestName}</span>
                              </div>
                              <div className="text-orange-800 font-mono mt-0.5">
                                Out: {matchingStay.expectedCheckOutDate}
                              </div>
                            </div>
                          )}

                          {!isOccupied && matchingRes && (
                            <div className="mt-2.5 p-2 bg-blue-50 rounded-xl border border-blue-200 text-[10px]">
                              <div className="font-bold text-blue-950 truncate flex items-center gap-1">
                                <BookmarkCheck className="w-3 h-3 text-blue-700" />
                                <span>{matchingRes.guestName}</span>
                              </div>
                              <div className="text-blue-800 font-mono mt-0.5">
                                {matchingRes.checkInDate} to {matchingRes.checkOutDate}
                              </div>
                            </div>
                          )}

                          {/* Tariff & Plan */}
                          <div className="mt-3 flex items-center justify-between text-xs border-t border-amber-100/80 pt-2 font-mono">
                            <span className="text-stone-500 font-sans text-[11px]">Tariff:</span>
                            <span className="font-extrabold text-stone-900 text-sm">
                              {formatINR(room.tariff)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-stone-500 mt-0.5">
                            <span>Plan: <b className="text-stone-800">{room.planType || 'EP'}</b></span>
                            <span>Max: {room.capacityAdults || 2}A + {room.capacityChildren || 1}C</span>
                          </div>
                        </div>

                        {/* Footer Quick Action */}
                        <div className="mt-3 pt-2 border-t border-amber-100 flex items-center justify-between">
                          <button
                            onClick={(e) => handleOpenEdit(room, e)}
                            title="Edit room configuration"
                            className="p-1 text-stone-400 hover:text-stone-800 rounded cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {isAvailable && onCheckInRoom && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onCheckInRoom(room);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-red-600 to-orange-600 text-white text-[11px] font-bold shadow-xs cursor-pointer hover:scale-102 transition-transform"
                            >
                              Check-in
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Room Details Modal */}
      {selectedRoomDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200 shadow-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex justify-between items-start border-b border-amber-100 pb-3">
              <div>
                <div className="text-2xl font-black font-mono text-stone-950">
                  Room {selectedRoomDetails.roomNumber}
                </div>
                <div className="text-xs font-bold text-stone-700">
                  {selectedRoomDetails.roomType} • {selectedRoomDetails.floor}
                </div>
              </div>

              <span className={`text-xs font-extrabold px-3 py-1 rounded-full ${
                selectedRoomDetails.status === 'Available' ? 'bg-emerald-100 text-emerald-800' :
                selectedRoomDetails.status === 'Occupied' ? 'bg-orange-100 text-orange-900' :
                selectedRoomDetails.status === 'Reserved' ? 'bg-blue-100 text-blue-900' : 'bg-amber-100 text-amber-900'
              }`}>
                {selectedRoomDetails.status}
              </span>
            </div>

            {/* Config details */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-amber-50/50 p-3 rounded-xl border border-amber-100 font-mono">
              <div>
                <span className="text-stone-500 block text-[10px]">Standard Tariff:</span>
                <span className="font-extrabold text-stone-900 text-sm">{formatINR(selectedRoomDetails.tariff)} / night</span>
              </div>
              <div>
                <span className="text-stone-500 block text-[10px]">Meal Plan:</span>
                <span className="font-bold text-stone-900">{selectedRoomDetails.planType || 'EP'}</span>
              </div>
              <div>
                <span className="text-stone-500 block text-[10px]">Max Occupancy:</span>
                <span className="font-bold text-stone-900">{selectedRoomDetails.capacityAdults || 2} Adults + {selectedRoomDetails.capacityChildren || 1} Children</span>
              </div>
              <div>
                <span className="text-stone-500 block text-[10px]">Floor:</span>
                <span className="font-bold text-stone-900">{selectedRoomDetails.floor}</span>
              </div>
            </div>

            {/* Quick Status Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-stone-800">
                Change Operational Status:
              </label>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {(['Available', 'Occupied', 'Reserved', 'Cleaning', 'Maintenance', 'Blocked'] as RoomStatus[]).map((st) => (
                  <button
                    key={st}
                    onClick={() => handleStatusChange(selectedRoomDetails.roomId, st)}
                    className={`py-2 px-1 rounded-xl border font-bold text-center cursor-pointer transition-all ${
                      selectedRoomDetails.status === st
                        ? 'bg-stone-900 text-amber-300 border-stone-900'
                        : 'bg-white hover:bg-amber-50 text-stone-800 border-stone-200'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-amber-100">
              <button
                type="button"
                onClick={() => {
                  handleOpenEdit(selectedRoomDetails);
                  setSelectedRoomDetails(null);
                }}
                className="px-3 py-1.5 text-xs font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl cursor-pointer"
              >
                Edit Pricing / Details
              </button>

              <button
                type="button"
                onClick={() => setSelectedRoomDetails(null)}
                className="px-4 py-1.5 text-xs font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Room Modal */}
      {showAddEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200 shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-base text-stone-900 font-['Outfit',sans-serif]">
              {editingRoom ? `Edit Room ${editingRoom.roomNumber} Configuration` : 'Add Room'}
            </h3>

            <form onSubmit={handleSaveRoom} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Room Number
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={formRoomNumber}
                    className="w-full px-3 py-2 bg-stone-100 border border-stone-300 rounded-xl text-xs font-bold font-mono text-stone-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Floor
                  </label>
                  <select
                    value={formFloor}
                    onChange={(e) => setFormFloor(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-bold"
                  >
                    <option value={1}>1st Floor (101-105)</option>
                    <option value={2}>2nd Floor (201-210)</option>
                    <option value={3}>3rd Floor (301-309)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Room Type *
                  </label>
                  <select
                    value={formRoomType}
                    onChange={(e) => setFormRoomType(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-bold"
                  >
                    <option value="Deluxe Room">Deluxe Room</option>
                    <option value="Executive Room">Executive Room</option>
                    <option value="Suite Room">Suite Room</option>
                    <option value="Standard Room">Standard Room</option>
                    <option value="Luxury Suite">Luxury Suite</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Tariff / Night (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formTariff}
                    onChange={(e) => setFormTariff(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Meal Plan
                  </label>
                  <select
                    value={formPlanType}
                    onChange={(e) => setFormPlanType(e.target.value as PlanType)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-bold"
                  >
                    <option value="EP">EP (Room Only)</option>
                    <option value="CP">CP (Breakfast)</option>
                    <option value="MAP">MAP (Breakfast+Meal)</option>
                    <option value="AP">AP (All Meals)</option>
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
                    value={formMaxAdults}
                    onChange={(e) => setFormMaxAdults(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs"
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
                    value={formMaxChildren}
                    onChange={(e) => setFormMaxChildren(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  Amenities (comma-separated)
                </label>
                <input
                  type="text"
                  value={formAmenities}
                  onChange={(e) => setFormAmenities(e.target.value)}
                  placeholder="AC, LED TV, Free Wi-Fi, Geyser"
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-amber-100">
                <button
                  type="button"
                  onClick={() => setShowAddEditModal(false)}
                  className="px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingRoom}
                  className="px-4 py-2 bg-gradient-to-r from-red-600 to-orange-600 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer"
                >
                  {savingRoom ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Status Modal */}
      {activeStatusModalRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200 shadow-2xl max-w-sm w-full p-5 space-y-4">
            <h3 className="font-bold text-sm text-stone-900 font-['Outfit',sans-serif]">
              Change Status for Room {activeStatusModalRoom.roomNumber}
            </h3>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {(['Available', 'Occupied', 'Reserved', 'Cleaning', 'Maintenance', 'Blocked'] as RoomStatus[]).map((st) => (
                <button
                  key={st}
                  onClick={() => handleStatusChange(activeStatusModalRoom.roomId, st)}
                  className={`p-2.5 rounded-xl border text-center font-bold transition-all cursor-pointer ${
                    activeStatusModalRoom.status === st
                      ? 'bg-stone-900 text-amber-300 border-amber-400'
                      : 'bg-white hover:bg-amber-50 text-stone-800 border-stone-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setActiveStatusModalRoom(null)}
                className="px-3 py-1.5 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
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
