import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import { Guest } from '../types';
import { localFallbackStore } from './localFallbackStore';

const GUESTS_COLLECTION = 'guests';

export async function getGuests(maxLimit = 100): Promise<Guest[]> {
  try {
    const q = query(collection(db, GUESTS_COLLECTION), orderBy('updatedAt', 'desc'), limit(maxLimit));
    const snapshot = await getDocs(q);
    const guests = snapshot.docs.map(d => ({ guestId: d.id, ...d.data() })) as Guest[];
    guests.forEach(g => localFallbackStore.saveGuest(g));
    return guests;
  } catch (error) {
    try {
      const q = query(collection(db, GUESTS_COLLECTION), limit(maxLimit));
      const snapshot = await getDocs(q);
      const guests = snapshot.docs.map(d => ({ guestId: d.id, ...d.data() })) as Guest[];
      guests.forEach(g => localFallbackStore.saveGuest(g));
      return guests;
    } catch (e) {
      return localFallbackStore.getGuests();
    }
  }
}

export async function searchGuests(searchTerm: string): Promise<Guest[]> {
  const all = await getGuests(200);
  if (!searchTerm.trim()) return all;
  const term = searchTerm.toLowerCase().trim();
  return all.filter(g =>
    (g.guestName && g.guestName.toLowerCase().includes(term)) ||
    (g.phone && g.phone.toLowerCase().includes(term)) ||
    (g.idNumber && g.idNumber.toLowerCase().includes(term)) ||
    (g.companyName && g.companyName.toLowerCase().includes(term))
  );
}

export async function findGuestByPhone(phone: string): Promise<Guest | null> {
  if (!phone || phone.trim().length < 4) return null;
  try {
    const q = query(collection(db, GUESTS_COLLECTION), where('phone', '==', phone.trim()), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docData = snap.docs[0];
      const guest = { guestId: docData.id, ...docData.data() } as Guest;
      localFallbackStore.saveGuest(guest);
      return guest;
    }
  } catch (error) {
    // try local
  }
  return localFallbackStore.getGuests().find(g => g.phone === phone.trim()) || null;
}

export async function findGuestByIdNumber(idNumber: string): Promise<Guest | null> {
  if (!idNumber || idNumber.trim().length < 3) return null;
  try {
    const q = query(collection(db, GUESTS_COLLECTION), where('idNumber', '==', idNumber.trim()), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docData = snap.docs[0];
      const guest = { guestId: docData.id, ...docData.data() } as Guest;
      localFallbackStore.saveGuest(guest);
      return guest;
    }
  } catch (error) {
    // try local
  }
  return localFallbackStore.getGuests().find(g => g.idNumber === idNumber.trim()) || null;
}

export async function saveOrUpdateGuest(guestData: Partial<Guest>): Promise<Guest> {
  const phone = guestData.phone?.trim() || '';
  const idNumber = guestData.idNumber?.trim() || '';

  let existingGuest: Guest | null = null;
  if (guestData.guestId) {
    existingGuest = await getGuestById(guestData.guestId);
  }

  if (!existingGuest && phone) {
    existingGuest = await findGuestByPhone(phone);
  }

  if (!existingGuest && idNumber) {
    existingGuest = await findGuestByIdNumber(idNumber);
  }

  const guestId = existingGuest?.guestId || guestData.guestId || `G-${Date.now()}`;
  const guestDocRef = doc(db, GUESTS_COLLECTION, guestId);

  const payload: any = {
    guestName: guestData.guestName || existingGuest?.guestName || 'Guest',
    phone: phone || existingGuest?.phone || '',
    email: guestData.email || existingGuest?.email || '',
    address: guestData.address || existingGuest?.address || '',
    idType: guestData.idType || existingGuest?.idType || 'Aadhaar Card',
    idNumber: idNumber || existingGuest?.idNumber || '',
    companyName: guestData.companyName || existingGuest?.companyName || '',
    companyAddress: guestData.companyAddress || existingGuest?.companyAddress || '',
    companyGSTIN: guestData.companyGSTIN || existingGuest?.companyGSTIN || '',
    totalStays: (existingGuest?.totalStays || 0) + (guestData.totalStays !== undefined ? guestData.totalStays : 0),
    totalSpent: (existingGuest?.totalSpent || 0) + (guestData.totalSpent !== undefined ? guestData.totalSpent : 0),
    updatedAt: new Date().toISOString(),
  };

  if (!existingGuest) {
    payload.createdAt = new Date().toISOString();
    payload.totalStays = guestData.totalStays || 1;
    payload.totalSpent = guestData.totalSpent || 0;
  }

  const fullGuest: Guest = {
    guestId,
    ...payload,
  };

  localFallbackStore.saveGuest(fullGuest);

  try {
    await setDoc(guestDocRef, {
      ...payload,
      updatedAt: serverTimestamp(),
      ...(existingGuest ? {} : { createdAt: serverTimestamp() }),
    }, { merge: true });
  } catch (e) {
    // Handled locally
  }

  return fullGuest;
}

export async function getGuestById(guestId: string): Promise<Guest | null> {
  try {
    const snap = await getDoc(doc(db, GUESTS_COLLECTION, guestId));
    if (snap.exists()) {
      const data = { guestId: snap.id, ...snap.data() } as Guest;
      localFallbackStore.saveGuest(data);
      return data;
    }
  } catch (error) {
    // fallback
  }
  return localFallbackStore.getGuests().find(g => g.guestId === guestId) || null;
}
