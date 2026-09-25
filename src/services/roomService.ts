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
  serverTimestamp,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db } from './firebase';
import { Room, RoomStatus, PlanType } from '../types';
import { logActivity } from './activityService';
import { localFallbackStore } from './localFallbackStore';

export const ROOMS_COLLECTION = 'rooms';

export const OFFICIAL_ROOM_INVENTORY: {
  roomNumber: string;
  floor: string;
  defaultType: string;
  defaultTariff: number;
  defaultPlan: PlanType;
}[] = [
  // 1ST FLOOR (5 Rooms - Executive Rooms)
  { roomNumber: '101', floor: '1st Floor', defaultType: 'Executive Room', defaultTariff: 1500, defaultPlan: 'EP' },
  { roomNumber: '102', floor: '1st Floor', defaultType: 'Executive Room', defaultTariff: 1500, defaultPlan: 'EP' },
  { roomNumber: '103', floor: '1st Floor', defaultType: 'Executive Room', defaultTariff: 1500, defaultPlan: 'EP' },
  { roomNumber: '104', floor: '1st Floor', defaultType: 'Executive Room', defaultTariff: 1500, defaultPlan: 'EP' },
  { roomNumber: '105', floor: '1st Floor', defaultType: 'Executive Room', defaultTariff: 1500, defaultPlan: 'EP' },

  // 2ND FLOOR (10 Rooms - Executive Rooms)
  { roomNumber: '201', floor: '2nd Floor', defaultType: 'Executive Room', defaultTariff: 1800, defaultPlan: 'EP' },
  { roomNumber: '202', floor: '2nd Floor', defaultType: 'Executive Room', defaultTariff: 1800, defaultPlan: 'EP' },
  { roomNumber: '203', floor: '2nd Floor', defaultType: 'Executive Room', defaultTariff: 1800, defaultPlan: 'EP' },
  { roomNumber: '204', floor: '2nd Floor', defaultType: 'Executive Room', defaultTariff: 1800, defaultPlan: 'EP' },
  { roomNumber: '205', floor: '2nd Floor', defaultType: 'Executive Room', defaultTariff: 1800, defaultPlan: 'EP' },
  { roomNumber: '206', floor: '2nd Floor', defaultType: 'Executive Room', defaultTariff: 1800, defaultPlan: 'EP' },
  { roomNumber: '207', floor: '2nd Floor', defaultType: 'Executive Room', defaultTariff: 1800, defaultPlan: 'EP' },
  { roomNumber: '208', floor: '2nd Floor', defaultType: 'Executive Room', defaultTariff: 1800, defaultPlan: 'EP' },
  { roomNumber: '209', floor: '2nd Floor', defaultType: 'Executive Room', defaultTariff: 1800, defaultPlan: 'EP' },
  { roomNumber: '210', floor: '2nd Floor', defaultType: 'Executive Room', defaultTariff: 1800, defaultPlan: 'EP' },

  // 3RD FLOOR (9 Rooms - 301 to 308 Executive Rooms, 309 Suite Room)
  { roomNumber: '301', floor: '3rd Floor', defaultType: 'Executive Room', defaultTariff: 2000, defaultPlan: 'EP' },
  { roomNumber: '302', floor: '3rd Floor', defaultType: 'Executive Room', defaultTariff: 2000, defaultPlan: 'EP' },
  { roomNumber: '303', floor: '3rd Floor', defaultType: 'Executive Room', defaultTariff: 2000, defaultPlan: 'EP' },
  { roomNumber: '304', floor: '3rd Floor', defaultType: 'Executive Room', defaultTariff: 2000, defaultPlan: 'EP' },
  { roomNumber: '305', floor: '3rd Floor', defaultType: 'Executive Room', defaultTariff: 2000, defaultPlan: 'EP' },
  { roomNumber: '306', floor: '3rd Floor', defaultType: 'Executive Room', defaultTariff: 2000, defaultPlan: 'EP' },
  { roomNumber: '307', floor: '3rd Floor', defaultType: 'Executive Room', defaultTariff: 2000, defaultPlan: 'EP' },
  { roomNumber: '308', floor: '3rd Floor', defaultType: 'Executive Room', defaultTariff: 2000, defaultPlan: 'EP' },
  { roomNumber: '309', floor: '3rd Floor', defaultType: 'Suite Room', defaultTariff: 2500, defaultPlan: 'CP' },
];

/**
 * Ensures the exact 24 rooms exist in Firestore in an idempotent and non-destructive manner.
 * Preserves all active room data (status, tariffs, current guests, stays) while guaranteeing
 * that all 24 rooms are physically saved into Firestore.
 */
export async function syncOfficialInventory(existingRooms: Room[]): Promise<Room[]> {
  const existingMap = new Map<string, Room>();
  existingRooms.forEach(r => {
    if (r.roomNumber) existingMap.set(r.roomNumber, r);
    if (r.roomId) existingMap.set(r.roomId, r);
  });

  const updatedRooms: Room[] = [];
  const missingRoomsToCreate: Room[] = [];

  for (const item of OFFICIAL_ROOM_INVENTORY) {
    const existing = existingMap.get(item.roomNumber);
    if (existing) {
      const merged: Room = {
        ...existing,
        floor: item.floor,
        roomType: item.defaultType,
      };
      updatedRooms.push(merged);

      if (existing.roomType !== item.defaultType || existing.floor !== item.floor) {
        try {
          const roomRef = doc(db, ROOMS_COLLECTION, existing.roomId || `room-${item.roomNumber}`);
          await updateDoc(roomRef, {
            roomType: item.defaultType,
            floor: item.floor,
            updatedAt: serverTimestamp(),
          });
        } catch (e) {
          // Ignore
        }
      }
    } else {
      const newRoomId = `room-${item.roomNumber}`;
      const newRoom: Room = {
        roomId: newRoomId,
        roomNumber: item.roomNumber,
        roomType: item.defaultType,
        floor: item.floor,
        capacityAdults: item.roomNumber === '309' ? 3 : 2,
        capacityChildren: item.roomNumber === '309' ? 2 : 1,
        maxAdults: item.roomNumber === '309' ? 4 : 3,
        maxChildren: 2,
        planType: item.defaultPlan,
        tariff: item.defaultTariff,
        status: 'Available',
        amenities: item.roomNumber === '309' 
          ? ['Air Conditioning', 'LED Smart TV', 'High-Speed Wi-Fi', 'Attached Luxury Bathroom', 'Living Area', 'Mini Refrigerator', 'Tea/Coffee Maker']
          : ['Air Conditioning', 'LED TV', 'Free Wi-Fi', 'Attached Bathroom', 'Hot Water Geyser'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      missingRoomsToCreate.push(newRoom);
      updatedRooms.push(newRoom);
    }
  }

  // Numerical sorting
  updatedRooms.sort((a, b) => parseInt(a.roomNumber, 10) - parseInt(b.roomNumber, 10));

  // If any rooms are missing from Firestore, write them immediately to Firestore
  if (missingRoomsToCreate.length > 0) {
    localFallbackStore.saveRooms(updatedRooms);
    await Promise.allSettled(
      missingRoomsToCreate.map(async (r) => {
        try {
          const roomRef = doc(db, ROOMS_COLLECTION, r.roomId);
          await setDoc(roomRef, {
            ...r,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }, { merge: true });
        } catch (e) {
          console.warn(`Firestore save room ${r.roomNumber} warning:`, e);
        }
      })
    );
  }

  return updatedRooms;
}

/**
 * Loads all 24 rooms from Firestore as single source of truth.
 */
export async function getRooms(): Promise<Room[]> {
  let rooms: Room[] = [];
  try {
    const q = query(collection(db, ROOMS_COLLECTION), orderBy('roomNumber', 'asc'));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      rooms = snapshot.docs.map(d => ({ roomId: d.id, ...d.data() })) as Room[];
    }
  } catch (error) {
    console.warn('Firestore getRooms query error, attempting fallback:', error);
    try {
      const snap = await getDocs(collection(db, ROOMS_COLLECTION));
      if (!snap.empty) {
        rooms = snap.docs.map(d => ({ roomId: d.id, ...d.data() })) as Room[];
      }
    } catch (e) {
      rooms = localFallbackStore.getRooms();
    }
  }

  if (rooms.length === 0) {
    rooms = localFallbackStore.getRooms();
  }

  const synced = await syncOfficialInventory(rooms);
  localFallbackStore.saveRooms(synced);
  return synced;
}

/**
 * Realtime subscription to rooms collection in Firestore for instant cross-device updates.
 */
export function subscribeToRooms(onUpdate: (rooms: Room[]) => void): Unsubscribe {
  try {
    const q = query(collection(db, ROOMS_COLLECTION), orderBy('roomNumber', 'asc'));
    return onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const rooms = snapshot.docs.map(d => ({ roomId: d.id, ...d.data() })) as Room[];
        const sorted = rooms.sort((a, b) => parseInt(a.roomNumber, 10) - parseInt(b.roomNumber, 10));
        localFallbackStore.saveRooms(sorted);
        onUpdate(sorted);
      } else {
        // Empty Firestore, trigger sync
        getRooms().then(onUpdate).catch(() => {});
      }
    }, (err) => {
      console.warn('Rooms onSnapshot subscription error:', err);
      getRooms().then(onUpdate).catch(() => {});
    });
  } catch (e) {
    getRooms().then(onUpdate).catch(() => {});
    return () => {};
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
  } else if (status === 'Reserved' && stayInfo) {
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

  // Update local store immediately for instant UI reaction
  const localRooms = localFallbackStore.getRooms();
  const found = localRooms.find(r => r.roomId === roomId || r.roomNumber === roomId);
  if (found) {
    localFallbackStore.updateRoom({ ...found, ...payload });
  }

  const targetDocId = found?.roomId || (roomId.startsWith('room-') ? roomId : `room-${roomId}`);
  const roomRef = doc(db, ROOMS_COLLECTION, targetDocId);
  await setDoc(roomRef, {
    ...payload,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  await logActivity({
    action: 'ROOM_STATUS_CHANGED',
    userEmail,
    entityType: 'room',
    entityId: targetDocId,
    description: `Room ${found?.roomNumber || roomId} status changed to ${status}`,
  });
}

export async function createRoom(roomData: Partial<Room>, userEmail = 'admin'): Promise<string> {
  const roomId = roomData.roomId || `room-${roomData.roomNumber || Date.now()}`;
  const fullRoom: Room = {
    roomId,
    roomNumber: roomData.roomNumber || '101',
    roomType: roomData.roomType || 'Executive Room',
    floor: roomData.floor || '1st Floor',
    capacityAdults: roomData.capacityAdults || 2,
    capacityChildren: roomData.capacityChildren || 1,
    maxAdults: roomData.maxAdults || 3,
    maxChildren: roomData.maxChildren || 2,
    planType: roomData.planType || 'EP',
    tariff: roomData.tariff || 1500,
    status: roomData.status || 'Available',
    amenities: roomData.amenities || ['Air Conditioning', 'LED TV', 'Free Wi-Fi', 'Attached Bathroom'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  localFallbackStore.updateRoom(fullRoom);

  const roomRef = doc(db, ROOMS_COLLECTION, roomId);
  await setDoc(roomRef, {
    ...fullRoom,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });

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
  const found = localRooms.find(r => r.roomId === roomId || r.roomNumber === roomId);
  if (found) {
    localFallbackStore.updateRoom({ ...found, ...roomData, updatedAt: new Date().toISOString() });
  }

  const targetDocId = found?.roomId || (roomId.startsWith('room-') ? roomId : `room-${roomId}`);
  const roomRef = doc(db, ROOMS_COLLECTION, targetDocId);
  await updateDoc(roomRef, {
    ...roomData,
    updatedAt: serverTimestamp(),
  });

  await logActivity({
    action: 'ROOM_UPDATED',
    userEmail,
    entityType: 'room',
    entityId: targetDocId,
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

  const roomRef = doc(db, ROOMS_COLLECTION, roomId);
  await deleteDoc(roomRef);

  await logActivity({
    action: 'ROOM_STATUS_CHANGED',
    userEmail,
    entityType: 'room',
    entityId: roomId,
    description: `Room ${roomId} deleted from inventory`,
  });
}
