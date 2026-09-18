import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import { Room, RoomStatus } from '../types';
import { logActivity } from './activityService';
import { localFallbackStore } from './localFallbackStore';

const ROOMS_COLLECTION = 'rooms';

export async function getRooms(): Promise<Room[]> {
  try {
    const q = query(collection(db, ROOMS_COLLECTION), orderBy('roomNumber', 'asc'));
    const snapshot = await getDocs(q);
    const rooms = snapshot.docs.map(d => ({ roomId: d.id, ...d.data() })) as Room[];
    localFallbackStore.saveRooms(rooms);
    return rooms;
  } catch (error) {
    try {
      const snap = await getDocs(collection(db, ROOMS_COLLECTION));
      const rooms = snap.docs.map(d => ({ roomId: d.id, ...d.data() })) as Room[];
      localFallbackStore.saveRooms(rooms);
      return rooms;
    } catch (e) {
      // Permission or network error -> use local fallback
    }
    return localFallbackStore.getRooms();
  }
}

export async function updateRoomStatus(
  roomId: string, 
  status: RoomStatus, 
  stayInfo?: { stayId?: string; guestName?: string; checkInDate?: string; expectedCheckOut?: string },
  userEmail = 'admin'
): Promise<void> {
  const payload: any = {
    status,
    updatedAt: new Date().toISOString(),
  };

  if (status === 'Occupied' && stayInfo) {
    payload.currentStayId = stayInfo.stayId || null;
    payload.currentGuestName = stayInfo.guestName || null;
    payload.currentCheckInDate = stayInfo.checkInDate || null;
    payload.currentExpectedCheckOut = stayInfo.expectedCheckOut || null;
  } else if (status === 'Available') {
    payload.currentStayId = null;
    payload.currentGuestName = null;
    payload.currentCheckInDate = null;
    payload.currentExpectedCheckOut = null;
  }

  // Update local store immediately
  const localRooms = localFallbackStore.getRooms();
  const found = localRooms.find(r => r.roomId === roomId);
  if (found) {
    localFallbackStore.updateRoom({ ...found, ...payload });
  }

  try {
    const roomRef = doc(db, ROOMS_COLLECTION, roomId);
    await updateDoc(roomRef, {
      ...payload,
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    // Handled via local fallback
  }

  await logActivity({
    action: 'ROOM_STATUS_CHANGED',
    userEmail,
    entityType: 'room',
    entityId: roomId,
    description: `Room ${roomId} status changed to ${status}`,
  });
}

export async function createRoom(roomData: Partial<Room>, userEmail = 'admin'): Promise<string> {
  const roomId = roomData.roomId || `room-${roomData.roomNumber || Date.now()}`;
  const fullRoom: Room = {
    roomId,
    roomNumber: roomData.roomNumber || '101',
    roomType: roomData.roomType || 'Deluxe Room',
    floor: roomData.floor || '1st Floor',
    capacityAdults: roomData.capacityAdults || 2,
    capacityChildren: roomData.capacityChildren || 1,
    maxAdults: roomData.capacityAdults || 2,
    maxChildren: roomData.capacityChildren || 1,
    planType: roomData.planType || 'EP',
    tariff: roomData.tariff || 1500,
    status: roomData.status || 'Available',
    amenities: roomData.amenities || ['AC', 'TV'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  localFallbackStore.updateRoom(fullRoom);

  try {
    const roomRef = doc(db, ROOMS_COLLECTION, roomId);
    await setDoc(roomRef, {
      ...fullRoom,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    // Handled via local fallback
  }

  await logActivity({
    action: 'ROOM_ADDED',
    userEmail,
    entityType: 'room',
    entityId: roomId,
    description: `Room ${roomData.roomNumber} (${roomData.roomType}) added to inventory`,
  });

  return roomId;
}

export async function updateRoom(roomId: string, roomData: Partial<Room>, userEmail = 'admin'): Promise<void> {
  const localRooms = localFallbackStore.getRooms();
  const found = localRooms.find(r => r.roomId === roomId);
  if (found) {
    localFallbackStore.updateRoom({ ...found, ...roomData, updatedAt: new Date().toISOString() });
  }

  try {
    const roomRef = doc(db, ROOMS_COLLECTION, roomId);
    await updateDoc(roomRef, {
      ...roomData,
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    // Handled via local fallback
  }

  await logActivity({
    action: 'ROOM_UPDATED',
    userEmail,
    entityType: 'room',
    entityId: roomId,
    description: `Room ${roomData.roomNumber || roomId} details updated`,
  });
}

export async function saveRoom(roomData: Partial<Room>, userEmail = 'admin'): Promise<string> {
  if (roomData.roomId) {
    await updateRoom(roomData.roomId, roomData, userEmail);
    return roomData.roomId;
  }
  return createRoom(roomData, userEmail);
}

export async function deleteRoom(roomId: string, userEmail = 'admin'): Promise<void> {
  const rooms = localFallbackStore.getRooms().filter(r => r.roomId !== roomId);
  localFallbackStore.saveRooms(rooms);

  try {
    await deleteDoc(doc(db, ROOMS_COLLECTION, roomId));
  } catch (e) {
    // Handled via local fallback
  }

  await logActivity({
    action: 'ROOM_STATUS_CHANGED',
    userEmail,
    entityType: 'room',
    entityId: roomId,
    description: `Room ${roomId} deleted from inventory`,
  });
}
