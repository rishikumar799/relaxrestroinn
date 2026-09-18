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
  DollarSign
} from 'lucide-react';
import { Room, RoomStatus, PlanType, HotelSettings } from '../types';
import { getRooms, updateRoomStatus, createRoom, updateRoom, deleteRoom } from '../services/roomService';
import { formatINR } from '../utils/currency';
import { useToast } from '../components/common/Toast';
import { ConfirmationModal } from '../components/common/ConfirmationModal';

interface RoomsProps {
  settings?: HotelSettings;
  onCheckInRoom?: (room: Room) => void;
}

export const Rooms: React.FC<RoomsProps> = ({ settings, onCheckInRoom }) => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);
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
  const [formAmenities, setFormAmenities] = useState('AC, TV, Geyser, Wi-Fi');
  const [savingRoom, setSavingRoom] = useState(false);

  // Status Change Popover
  const [activeStatusModalRoom, setActiveStatusModalRoom] = useState<Room | null>(null);

  // Delete Room Modal
  const [roomToDelete, setRoomToDelete] = useState<Room | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadRoomsData = async () => {
    try {
      setLoading(true);
      const data = await getRooms();
      setRooms(data);
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

  const handleOpenAdd = () => {
    setEditingRoom(null);
    setFormRoomNumber('');
    setFormRoomType('Deluxe Room');
    setFormFloor(2);
    setFormTariff(1500);
    setFormPlanType('EP');
    setFormMaxAdults(2);
    setFormMaxChildren(1);
    setFormAmenities('AC, LED TV, Geyser, Free Wi-Fi');
    setShowAddEditModal(true);
  };

  const handleOpenEdit = (room: Room) => {
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
      } else {
        await createRoom({
          roomNumber: formRoomNumber.trim(),
          roomType: formRoomType,
          floor: `${formFloor}${formFloor === 1 ? 'st' : formFloor === 2 ? 'nd' : formFloor === 3 ? 'rd' : 'th'} Floor`,
          tariff: formTariff,
          status: 'Available',
          planType: formPlanType,
          capacityAdults: formMaxAdults,
          capacityChildren: formMaxChildren,
          maxAdults: formMaxAdults,
          maxChildren: formMaxChildren,
          amenities: amenitiesArr,
        });
        toast.success('Room Created', `Room ${formRoomNumber} added to inventory.`);
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
      loadRoomsData();
    } catch (err: any) {
      toast.error('Update Failed', err.message || 'Could not update room status.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!roomToDelete) return;
    try {
      setDeleting(true);
      await deleteRoom(roomToDelete.roomId);
      toast.success('Room Deleted', `Room ${roomToDelete.roomNumber} removed.`);
      setRoomToDelete(null);
      loadRoomsData();
    } catch (err: any) {
      toast.error('Delete Failed', err.message || 'Could not delete room.');
    } finally {
      setDeleting(false);
    }
  };

  // Filtered rooms
  const filteredRooms = rooms.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (floorFilter !== 'all' && String(r.floor) !== floorFilter) return false;
    return true;
  });

  // Group by floor
  const floors = Array.from(new Set(rooms.map(r => String(r.floor || '1st Floor')))).sort();

  // Counts
  const availableCount = rooms.filter(r => r.status === 'Available').length;
  const occupiedCount = rooms.filter(r => r.status === 'Occupied').length;
  const cleaningCount = rooms.filter(r => r.status === 'Cleaning').length;
  const maintenanceCount = rooms.filter(r => r.status === 'Maintenance').length;

  return (
    <div className="max-w-7xl mx-auto pb-12 space-y-6 animate-in fade-in duration-200">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-amber-950 font-['Outfit',sans-serif]">
            Room Inventory & Housekeeping
          </h1>
          <p className="text-xs text-stone-600 mt-0.5">
            Manage tariffs, floor allocations, live occupancy and housekeeping status
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-orange-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Room</span>
          </button>
        </div>
      </div>

      {/* KPI Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div 
          onClick={() => setStatusFilter('Available')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'Available' ? 'bg-emerald-50 border-emerald-400 shadow-sm' : 'bg-[#FFFDF9] border-amber-200/80 shadow-xs'
          }`}
        >
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Available</span>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-700 font-['Outfit',sans-serif] mt-1">{availableCount}</div>
          <span className="text-[10px] text-stone-500">Ready for guest check-in</span>
        </div>

        <div 
          onClick={() => setStatusFilter('Occupied')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'Occupied' ? 'bg-orange-50 border-orange-400 shadow-sm' : 'bg-[#FFFDF9] border-amber-200/80 shadow-xs'
          }`}
        >
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-orange-800 uppercase tracking-wider">Occupied</span>
            <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
          </div>
          <div className="text-2xl font-black text-orange-900 font-['Outfit',sans-serif] mt-1">{occupiedCount}</div>
          <span className="text-[10px] text-stone-500">Currently staying</span>
        </div>

        <div 
          onClick={() => setStatusFilter('Cleaning')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'Cleaning' ? 'bg-amber-50 border-amber-400 shadow-sm' : 'bg-[#FFFDF9] border-amber-200/80 shadow-xs'
          }`}
        >
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Housekeeping</span>
            <Brush className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-900 font-['Outfit',sans-serif] mt-1">{cleaningCount}</div>
          <span className="text-[10px] text-stone-500">Cleaning in progress</span>
        </div>

        <div 
          onClick={() => setStatusFilter('Maintenance')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
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
          {['all', 'Available', 'Occupied', 'Cleaning', 'Maintenance', 'Reserved'].map((st) => (
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

        {floors.length > 1 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-stone-500 font-bold">Floor:</span>
            <select
              value={floorFilter}
              onChange={(e) => setFloorFilter(e.target.value)}
              className="px-2.5 py-1 bg-white border border-stone-300 rounded-xl text-xs font-semibold"
            >
              <option value="all">All Floors</option>
              {floors.map(f => (
                <option key={f} value={String(f)}>Floor {f}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Rooms Grid by Floor */}
      {loading ? (
        <div className="py-16 text-center text-stone-500">
          <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs">Loading rooms...</p>
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200 p-12 text-center">
          <BedDouble className="w-12 h-12 text-amber-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-stone-700">No rooms found</p>
          <p className="text-xs text-stone-500 mt-1">Try resetting filters or adding rooms.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {floors.map((floorNum) => {
            const floorRooms = filteredRooms.filter(r => (r.floor || 1) === floorNum);
            if (floorRooms.length === 0) return null;

            return (
              <div key={floorNum} className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-amber-100 text-amber-900 text-[10px] font-bold">
                    FL-{floorNum}
                  </div>
                  <h3 className="font-bold text-sm text-stone-900 font-['Outfit',sans-serif]">
                    Floor {floorNum} ({floorRooms.length} Rooms)
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {floorRooms.map((room) => {
                    const isAvailable = room.status === 'Available';
                    const isOccupied = room.status === 'Occupied';
                    const isCleaning = room.status === 'Cleaning';
                    const isMaintenance = room.status === 'Maintenance';

                    return (
                      <div
                        key={room.roomId}
                        className={`
                          bg-[#FFFDF9] rounded-2xl border p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between
                          ${isAvailable 
                            ? 'border-emerald-200 hover:border-emerald-400' 
                            : isOccupied 
                            ? 'border-orange-200 hover:border-orange-400' 
                            : isCleaning 
                            ? 'border-amber-300 hover:border-amber-500 bg-amber-50/20' 
                            : 'border-red-200 hover:border-red-400 opacity-80'
                          }
                        `}
                      >
                        {/* Room Card Header */}
                        <div>
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-lg font-black font-mono text-stone-950">
                                {room.roomNumber}
                              </span>
                              <div className="text-xs font-bold text-stone-700">
                                {room.roomType}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setActiveStatusModalRoom(room)}
                              className={`
                                text-[10px] font-bold px-2 py-0.5 rounded-full cursor-pointer transition-transform hover:scale-105
                                ${isAvailable ? 'bg-emerald-100 text-emerald-800' : isOccupied ? 'bg-orange-100 text-orange-900' : isCleaning ? 'bg-amber-100 text-amber-900' : 'bg-red-100 text-red-800'}
                              `}
                            >
                              {room.status} ▾
                            </button>
                          </div>

                          {/* Plan and Tariff */}
                          <div className="mt-3 flex items-center justify-between text-xs border-t border-amber-100/60 pt-2 font-mono">
                            <span className="text-stone-500 font-sans text-[11px]">Tariff / Day:</span>
                            <span className="font-extrabold text-stone-900 text-sm">
                              {formatINR(room.tariff)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-stone-500 mt-1">
                            <span>Plan: <b className="text-stone-800">{room.planType || 'EP'}</b></span>
                            <span>Max: {room.capacityAdults || room.maxAdults || 2}A {(room.capacityChildren || room.maxChildren) ? `+ ${room.capacityChildren || room.maxChildren}C` : ''}</span>
                          </div>

                          {/* Amenities list */}
                          {room.amenities && room.amenities.length > 0 && (
                            <div className="mt-2 text-[10px] text-stone-500 truncate">
                              {room.amenities.join(' • ')}
                            </div>
                          )}
                        </div>

                        {/* Card Footer Actions */}
                        <div className="mt-4 pt-2.5 border-t border-amber-100 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleOpenEdit(room)}
                              title="Edit Room"
                              className="p-1 text-stone-400 hover:text-stone-700 rounded cursor-pointer"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setRoomToDelete(room)}
                              title="Delete Room"
                              className="p-1 text-stone-400 hover:text-red-600 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {isAvailable && onCheckInRoom && (
                            <button
                              onClick={() => onCheckInRoom(room)}
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

      {/* Quick Status Modal */}
      {activeStatusModalRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200 shadow-2xl max-w-sm w-full p-5 space-y-4">
            <h3 className="font-bold text-sm text-stone-900 font-['Outfit',sans-serif]">
              Change Status for Room {activeStatusModalRoom.roomNumber}
            </h3>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {(['Available', 'Occupied', 'Cleaning', 'Maintenance', 'Reserved', 'Blocked'] as RoomStatus[]).map((st) => (
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

      {/* Add / Edit Room Modal */}
      {showAddEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[#FFFDF9] rounded-2xl border border-amber-200 shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-base text-stone-900 font-['Outfit',sans-serif]">
              {editingRoom ? `Edit Room ${editingRoom.roomNumber}` : 'Add New Hotel Room'}
            </h3>

            <form onSubmit={handleSaveRoom} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Room Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={formRoomNumber}
                    onChange={(e) => setFormRoomNumber(e.target.value)}
                    placeholder="e.g. 201"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Floor Level
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={formFloor}
                    onChange={(e) => setFormFloor(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Room Type
                  </label>
                  <input
                    type="text"
                    required
                    value={formRoomType}
                    onChange={(e) => setFormRoomType(e.target.value)}
                    placeholder="Deluxe Room"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Tariff per Day (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="50"
                    value={formTariff}
                    onChange={(e) => setFormTariff(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Plan
                  </label>
                  <select
                    value={formPlanType}
                    onChange={(e) => setFormPlanType(e.target.value as PlanType)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-bold"
                  >
                    <option value="EP">EP</option>
                    <option value="CP">CP</option>
                    <option value="MAP">MAP</option>
                    <option value="AP">AP</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Max Adults
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formMaxAdults}
                    onChange={(e) => setFormMaxAdults(parseInt(e.target.value) || 2)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Max Children
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formMaxChildren}
                    onChange={(e) => setFormMaxChildren(parseInt(e.target.value) || 0)}
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
                  placeholder="AC, TV, Geyser, Wi-Fi, Coffee Maker"
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-amber-100">
                <button
                  type="button"
                  onClick={() => setShowAddEditModal(false)}
                  className="px-4 py-2 text-xs font-bold text-stone-700 hover:bg-stone-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingRoom}
                  className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 hover:from-red-700 hover:to-amber-700 rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                >
                  {savingRoom ? 'Saving...' : 'Save Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!roomToDelete}
        title={`Delete Room ${roomToDelete?.roomNumber}?`}
        message={`Are you sure you want to remove Room ${roomToDelete?.roomNumber} from hotel inventory?`}
        confirmText={deleting ? 'Deleting...' : 'Delete Room'}
        isDanger={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setRoomToDelete(null)}
      />
    </div>
  );
};
