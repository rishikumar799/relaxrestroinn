import { collection, getDocs, deleteDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { localFallbackStore } from './localFallbackStore';
import { OFFICIAL_ROOM_INVENTORY, ROOMS_COLLECTION } from './roomService';
import { Room } from '../types';

/**
 * Completely purges all existing check-in, check-out, bill, reservation, payment,
 * and activity records from both Firestore and LocalStorage, and resets all 24
 * official rooms to pristine 'Available' status.
 */
export async function purgeAllDataAndStartFresh(): Promise<{ success: boolean; countDeleted: number }> {
  let countDeleted = 0;

  // 1. Wipe Firestore collections: stays, bills, reservations, payments, activities, guests
  const collectionsToClear = ['stays', 'bills', 'reservations', 'payments', 'activities', 'guests'];

  for (const colName of collectionsToClear) {
    try {
      const snap = await getDocs(collection(db, colName));
      const deletePromises = snap.docs.map(async (docSnap) => {
        try {
          await deleteDoc(doc(db, colName, docSnap.id));
          countDeleted++;
        } catch (e) {
          console.warn(`Error deleting doc ${docSnap.id} in ${colName}:`, e);
        }
      });
      await Promise.allSettled(deletePromises);
    } catch (e) {
      console.warn(`Error fetching ${colName} for purge:`, e);
    }
  }

  // 2. Reset all 24 official rooms in Firestore to clean 'Available' state
  const cleanRooms: Room[] = OFFICIAL_ROOM_INVENTORY.map((item) => {
    const roomId = `room-${item.roomNumber}`;
    return {
      roomId,
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
      currentStayId: undefined,
      currentGuestName: undefined,
      currentCheckInDate: undefined,
      currentExpectedCheckOut: undefined,
      amenities: item.roomNumber === '309' 
        ? ['Air Conditioning', 'LED Smart TV', 'High-Speed Wi-Fi', 'Attached Luxury Bathroom', 'Living Area', 'Mini Refrigerator', 'Tea/Coffee Maker']
        : ['Air Conditioning', 'LED TV', 'Free Wi-Fi', 'Attached Bathroom', 'Hot Water Geyser'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });

  // Save clean rooms in Firestore
  await Promise.allSettled(
    cleanRooms.map(async (room) => {
      try {
        const roomRef = doc(db, ROOMS_COLLECTION, room.roomId);
        await setDoc(roomRef, {
          ...room,
          status: 'Available',
          currentStayId: null,
          currentGuestName: null,
          currentCheckInDate: null,
          currentExpectedCheckOut: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        console.warn(`Error resetting room ${room.roomNumber}:`, e);
      }
    })
  );

  // 3. Clear LocalStorage caches completely
  try {
    localStorage.removeItem('rri_stays');
    localStorage.removeItem('rri_bills');
    localStorage.removeItem('rri_reservations');
    localStorage.removeItem('rri_payments');
    localStorage.removeItem('rri_activities');
    localStorage.removeItem('rri_guests');
    localStorage.removeItem('rri_invoice_seq');
    // Save pristine 24 rooms into local cache
    localFallbackStore.saveRooms(cleanRooms);
    localFallbackStore.saveStays([]);
    localFallbackStore.saveBills([]);
    localFallbackStore.saveReservations([]);
    localFallbackStore.savePayments([]);
    localFallbackStore.saveGuests([]);
  } catch (e) {
    console.warn('LocalStorage clear error:', e);
  }

  return { success: true, countDeleted };
}
