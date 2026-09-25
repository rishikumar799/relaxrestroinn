import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp,
  onSnapshot,
  Unsubscribe 
} from 'firebase/firestore';
import { db } from './firebase';
import { Stay, Room, Guest, Payment } from '../types';
import { saveOrUpdateGuest } from './guestService';
import { updateRoomStatus } from './roomService';
import { logActivity } from './activityService';
import { recordPayment } from './paymentService';
import { localFallbackStore } from './localFallbackStore';

export const STAYS_COLLECTION = 'stays';

/**
 * Creates a new check-in (walk-in or from reservation) with verified Firestore persistence.
 */
export async function createCheckIn(
  stayData: Omit<Stay, 'stayId' | 'status' | 'createdAt' | 'updatedAt'>,
  userEmail = 'admin'
): Promise<Stay> {
  const stayId = `STAY-${Date.now()}`;
  const stayRef = doc(db, STAYS_COLLECTION, stayId);

  // 1. Save / Update Guest Profile in Firestore
  const savedGuest = await saveOrUpdateGuest({
    guestName: stayData.guestName,
    phone: stayData.guestPhone,
    email: stayData.guestEmail,
    address: stayData.guestAddress,
    idType: stayData.idType as any,
    idNumber: stayData.idNumber,
    companyName: stayData.companyName,
    companyAddress: stayData.companyAddress,
    companyGSTIN: stayData.companyGSTIN,
    totalStays: 1,
  });

  const fullStay: Stay = {
    ...stayData,
    stayId,
    guestId: savedGuest.guestId || `GST-${Date.now()}`,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Save to local cache for instant UI response
  localFallbackStore.saveStay(fullStay);

  // 2. Persist stay document to Firestore
  await setDoc(stayRef, {
    ...fullStay,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  // 3. Mark Room as Occupied in Firestore
  await updateRoomStatus(stayData.roomId, 'Occupied', {
    stayId,
    guestName: stayData.guestName,
    checkInDate: stayData.checkInDate,
    expectedCheckOut: stayData.expectedCheckOutDate,
  }, userEmail);

  // 4. Record advance payment if > 0 in Firestore
  if (stayData.advancePaid && stayData.advancePaid > 0) {
    await recordPayment({
      billId: `PRE-${stayId}`,
      stayId,
      guestId: savedGuest.guestId || fullStay.guestId,
      guestName: stayData.guestName,
      roomNumber: stayData.roomNumber,
      amount: stayData.advancePaid,
      paymentType: stayData.paymentType,
      referenceNumber: stayData.bookingId || stayData.grcNumber || 'ADVANCE',
      paymentDate: stayData.checkInDate,
      notes: `Advance payment for Room ${stayData.roomNumber} (${stayData.guestName})`,
    }, userEmail);
  }

  // 5. Audit Activity Log
  await logActivity({
    action: 'CHECK_IN_CREATED',
    userEmail,
    entityType: 'stay',
    entityId: stayId,
    description: `Check-in created for ${stayData.guestName} in Room ${stayData.roomNumber} (Plan: ${stayData.planType})`,
  });

  return fullStay;
}

/**
 * Loads all currently active stays from Firestore.
 */
export async function getActiveStays(): Promise<Stay[]> {
  try {
    const q = query(
      collection(db, STAYS_COLLECTION),
      where('status', '==', 'active')
    );
    const snapshot = await getDocs(q);
    const stays = snapshot.docs.map(d => ({ stayId: d.id, ...d.data() })) as Stay[];
    stays.forEach(s => localFallbackStore.saveStay(s));
    return stays.sort((a, b) => (b.checkInDate || '').localeCompare(a.checkInDate || ''));
  } catch (error) {
    console.warn('Firestore getActiveStays warning, reading fallback:', error);
    return localFallbackStore.getStays().filter(s => s.status === 'active');
  }
}

/**
 * Realtime subscription to active stays in Firestore for multi-device sync.
 */
export function subscribeToActiveStays(onUpdate: (stays: Stay[]) => void): Unsubscribe {
  try {
    const q = query(
      collection(db, STAYS_COLLECTION),
      where('status', '==', 'active')
    );
    return onSnapshot(q, (snapshot) => {
      const stays = snapshot.docs.map(d => ({ stayId: d.id, ...d.data() })) as Stay[];
      stays.forEach(s => localFallbackStore.saveStay(s));
      const sorted = stays.sort((a, b) => (b.checkInDate || '').localeCompare(a.checkInDate || ''));
      onUpdate(sorted);
    }, (err) => {
      console.warn('Active stays subscription error:', err);
      getActiveStays().then(onUpdate).catch(() => {});
    });
  } catch (e) {
    getActiveStays().then(onUpdate).catch(() => {});
    return () => {};
  }
}

/**
 * Loads historical stays from Firestore.
 */
export async function getStays(maxLimit = 150): Promise<Stay[]> {
  try {
    const q = query(collection(db, STAYS_COLLECTION), limit(maxLimit));
    const snapshot = await getDocs(q);
    const stays = snapshot.docs.map(d => ({ stayId: d.id, ...d.data() })) as Stay[];
    stays.forEach(s => localFallbackStore.saveStay(s));
    return stays.sort((a, b) => (b.checkInDate || '').localeCompare(a.checkInDate || ''));
  } catch (error) {
    return localFallbackStore.getStays();
  }
}

export async function getGuestStays(guestId: string): Promise<Stay[]> {
  try {
    const q = query(
      collection(db, STAYS_COLLECTION),
      where('guestId', '==', guestId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ stayId: d.id, ...d.data() })) as Stay[];
  } catch (error) {
    return localFallbackStore.getStays().filter(s => s.guestId === guestId);
  }
}

export async function getStayById(stayId: string): Promise<Stay | null> {
  try {
    const snap = await getDoc(doc(db, STAYS_COLLECTION, stayId));
    if (snap.exists()) {
      return { stayId: snap.id, ...snap.data() } as Stay;
    }
  } catch (error) {
    // fallback
  }
  return localFallbackStore.getStays().find(s => s.stayId === stayId) || null;
}

export async function updateStay(stayId: string, updates: Partial<Stay>, userEmail = 'admin'): Promise<void> {
  const existing = localFallbackStore.getStays().find(s => s.stayId === stayId);
  if (existing) {
    localFallbackStore.saveStay({ ...existing, ...updates, updatedAt: new Date().toISOString() });
  }

  const stayRef = doc(db, STAYS_COLLECTION, stayId);
  await updateDoc(stayRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}
