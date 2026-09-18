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
  writeBatch 
} from 'firebase/firestore';
import { db } from './firebase';
import { Stay, Room, Guest, Payment } from '../types';
import { saveOrUpdateGuest } from './guestService';
import { updateRoomStatus } from './roomService';
import { logActivity } from './activityService';
import { recordPayment } from './paymentService';
import { localFallbackStore } from './localFallbackStore';

const STAYS_COLLECTION = 'stays';

export async function createCheckIn(
  stayData: Omit<Stay, 'stayId' | 'status' | 'createdAt' | 'updatedAt'>,
  userEmail = 'admin'
): Promise<Stay> {
  const stayId = `STAY-${Date.now()}`;
  const stayRef = doc(db, STAYS_COLLECTION, stayId);

  // 1. Save / Update Guest
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
    guestId: savedGuest.guestId,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Save to local fallback
  localFallbackStore.saveStay(fullStay);

  // 2. Save stay document in Firestore
  try {
    await setDoc(stayRef, {
      ...fullStay,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    // Firestore error gracefully handled by local fallback
  }

  // 3. Mark Room as Occupied
  await updateRoomStatus(stayData.roomId, 'Occupied', {
    stayId,
    guestName: stayData.guestName,
    checkInDate: stayData.checkInDate,
    expectedCheckOut: stayData.expectedCheckOutDate,
  }, userEmail);

  // 4. Record advance payment if > 0
  if (stayData.advancePaid && stayData.advancePaid > 0) {
    await recordPayment({
      billId: `PRE-${stayId}`,
      stayId,
      guestId: savedGuest.guestId,
      guestName: stayData.guestName,
      roomNumber: stayData.roomNumber,
      amount: stayData.advancePaid,
      paymentType: stayData.paymentType,
      referenceNumber: stayData.bookingId || stayData.grcNumber || 'ADVANCE',
      paymentDate: stayData.checkInDate,
      notes: `Advance payment for Room ${stayData.roomNumber} (${stayData.guestName})`,
    });
  }

  // 5. Activity log
  await logActivity({
    action: 'CHECK_IN_CREATED',
    userEmail,
    entityType: 'stay',
    entityId: stayId,
    description: `Check-in created for ${stayData.guestName} in Room ${stayData.roomNumber} (Plan: ${stayData.planType})`,
  });

  return fullStay;
}

export async function getActiveStays(): Promise<Stay[]> {
  try {
    const q = query(
      collection(db, STAYS_COLLECTION),
      where('status', '==', 'active')
    );
    const snapshot = await getDocs(q);
    const stays = snapshot.docs.map(d => ({ stayId: d.id, ...d.data() })) as Stay[];
    // sync active stays
    stays.forEach(s => localFallbackStore.saveStay(s));
    return stays.sort((a, b) => (b.checkInDate || '').localeCompare(a.checkInDate || ''));
  } catch (error) {
    // Fallback to local
    return localFallbackStore.getStays().filter(s => s.status === 'active');
  }
}

export async function getStays(maxLimit = 100): Promise<Stay[]> {
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
    // try local
  }
  return localFallbackStore.getStays().find(s => s.stayId === stayId) || null;
}

export async function updateStay(stayId: string, updates: Partial<Stay>, userEmail = 'admin'): Promise<void> {
  const existing = localFallbackStore.getStays().find(s => s.stayId === stayId);
  if (existing) {
    localFallbackStore.saveStay({ ...existing, ...updates, updatedAt: new Date().toISOString() });
  }

  try {
    const stayRef = doc(db, STAYS_COLLECTION, stayId);
    await updateDoc(stayRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    // Handled locally
  }
}
