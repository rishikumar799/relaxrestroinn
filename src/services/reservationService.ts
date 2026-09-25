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
import { Reservation, ReservationStatus, Room, Stay, Payment, PaymentMethod } from '../types';
import { getRooms, updateRoomStatus } from './roomService';
import { getActiveStays, createCheckIn } from './stayService';
import { recordPayment } from './paymentService';
import { logActivity } from './activityService';
import { saveOrUpdateGuest } from './guestService';
import { localFallbackStore } from './localFallbackStore';
import { calculateDaysBetween, getTodayDateString, getCurrentTimeString } from '../utils/date';

export const RESERVATIONS_COLLECTION = 'reservations';

/**
 * Normalizes time string to HH:mm 24-hour format
 */
function normalizeTime(t?: string, defaultTime = '12:00'): string {
  if (!t || !t.trim()) return defaultTime;
  const parts = t.trim().split(':');
  const h = parts[0].padStart(2, '0');
  const m = (parts[1] || '00').padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Checks if two date+time intervals overlap:
 * Interval A: [startA_date + startA_time, endA_date + endA_time]
 * Interval B: [startB_date + startB_time, endB_date + endB_time]
 * Overlaps if A_start < B_end and A_end > B_start.
 * Supports same-day stays and turnaround (e.g. 8:00 AM - 8:30 AM vs 9:00 AM - 10:00 AM on same date do NOT overlap!).
 */
export function isDateTimeRangeOverlapping(
  startA_date: string,
  startA_time: string,
  endA_date: string,
  endA_time: string,
  startB_date: string,
  startB_time: string,
  endB_date: string,
  endB_time: string
): boolean {
  const normTimeAStart = normalizeTime(startA_time, '12:00');
  const normTimeAEnd = normalizeTime(endA_time, '11:00');
  const normTimeBStart = normalizeTime(startB_time, '12:00');
  const normTimeBEnd = normalizeTime(endB_time, '11:00');

  const dtAStart = `${startA_date}T${normTimeAStart}`;
  const dtAEnd = `${endA_date}T${normTimeAEnd}`;
  const dtBStart = `${startB_date}T${normTimeBStart}`;
  const dtBEnd = `${endB_date}T${normTimeBEnd}`;

  return dtAStart < dtBEnd && dtAEnd > dtBStart;
}

/**
 * Legacy date-only overlap checker
 */
export function isDateRangeOverlapping(
  startA: string, 
  endA: string, 
  startB: string, 
  endB: string
): boolean {
  return isDateTimeRangeOverlapping(startA, '12:00', endA, '11:00', startB, '12:00', endB, '11:00');
}

/**
 * Fetch all reservations from Firestore
 */
export async function getReservations(params?: {
  startDate?: string;
  endDate?: string;
  status?: ReservationStatus;
  roomId?: string;
  maxLimit?: number;
}): Promise<Reservation[]> {
  try {
    const q = query(
      collection(db, RESERVATIONS_COLLECTION),
      orderBy('checkInDate', 'desc'),
      limit(params?.maxLimit || 300)
    );
    const snapshot = await getDocs(q);
    const reservations = snapshot.docs.map(d => ({ reservationId: d.id, ...d.data() })) as Reservation[];
    
    localFallbackStore.saveReservations(reservations);

    let filtered = reservations;
    if (params?.status) {
      filtered = filtered.filter(r => r.status === params.status);
    }
    if (params?.roomId) {
      filtered = filtered.filter(r => r.roomId === params.roomId);
    }
    if (params?.startDate && params?.endDate) {
      filtered = filtered.filter(r => 
        isDateRangeOverlapping(r.checkInDate, r.checkOutDate, params.startDate!, params.endDate!)
      );
    }
    return filtered;
  } catch (error) {
    let local = localFallbackStore.getReservations();
    if (params?.status) {
      local = local.filter(r => r.status === params.status);
    }
    if (params?.roomId) {
      local = local.filter(r => r.roomId === params.roomId);
    }
    if (params?.startDate && params?.endDate) {
      local = local.filter(r => 
        isDateRangeOverlapping(r.checkInDate, r.checkOutDate, params.startDate!, params.endDate!)
      );
    }
    return local;
  }
}

/**
 * Realtime subscription to reservations
 */
export function subscribeToReservations(onUpdate: (reservations: Reservation[]) => void): Unsubscribe {
  try {
    const q = query(
      collection(db, RESERVATIONS_COLLECTION),
      orderBy('checkInDate', 'desc'),
      limit(200)
    );
    return onSnapshot(q, (snapshot) => {
      const resList = snapshot.docs.map(d => ({ reservationId: d.id, ...d.data() })) as Reservation[];
      localFallbackStore.saveReservations(resList);
      onUpdate(resList);
    }, (err) => {
      console.warn('Reservations subscription error:', err);
      getReservations().then(onUpdate).catch(() => {});
    });
  } catch (e) {
    getReservations().then(onUpdate).catch(() => {});
    return () => {};
  }
}

/**
 * Get a single reservation by ID
 */
export async function getReservationById(reservationId: string): Promise<Reservation | null> {
  try {
    const snap = await getDoc(doc(db, RESERVATIONS_COLLECTION, reservationId));
    if (snap.exists()) {
      return { reservationId: snap.id, ...snap.data() } as Reservation;
    }
  } catch (e) {
    // fallback
  }
  return localFallbackStore.getReservations().find(r => r.reservationId === reservationId) || null;
}

/**
 * Check if a room is available for a given date + time range against Firestore.
 * Supports BOTH overnight stays and same-day turnaround stays.
 */
export async function checkRoomAvailability(
  roomId: string,
  checkInDate: string,
  checkOutDate: string,
  checkInTime = '12:00',
  checkOutTime = '11:00',
  excludeReservationId?: string
): Promise<{ isAvailable: boolean; conflictReason?: string }> {
  // 1. Basic validation
  if (checkOutDate < checkInDate) {
    return {
      isAvailable: false,
      conflictReason: 'Check-out date cannot be before check-in date.',
    };
  }

  if (checkOutDate === checkInDate) {
    const normIn = normalizeTime(checkInTime, '12:00');
    const normOut = normalizeTime(checkOutTime, '11:00');
    if (normOut <= normIn) {
      return {
        isAvailable: false,
        conflictReason: 'For a same-day stay, check-out time must be later than check-in time.',
      };
    }
  }

  // 2. Fetch room operational status
  const allRooms = await getRooms();
  const targetRoom = allRooms.find(r => r.roomId === roomId || r.roomNumber === roomId);
  if (!targetRoom) {
    return { isAvailable: false, conflictReason: 'Selected room does not exist in inventory.' };
  }

  if (targetRoom.status === 'Maintenance') {
    return { isAvailable: false, conflictReason: `Room ${targetRoom.roomNumber} is currently under Maintenance.` };
  }
  if (targetRoom.status === 'Blocked') {
    return { isAvailable: false, conflictReason: `Room ${targetRoom.roomNumber} is currently Blocked.` };
  }

  // 3. Check overlapping active stays in Firestore
  const activeStays = await getActiveStays();
  const overlappingStay = activeStays.find(s => 
    s.roomId === targetRoom.roomId &&
    s.status === 'active' &&
    isDateTimeRangeOverlapping(
      checkInDate, 
      checkInTime, 
      checkOutDate, 
      checkOutTime, 
      s.checkInDate, 
      s.checkInTime || '12:00', 
      s.expectedCheckOutDate, 
      s.expectedCheckOutTime || '11:00'
    )
  );

  if (overlappingStay) {
    return {
      isAvailable: false,
      conflictReason: `Room ${targetRoom.roomNumber} is currently occupied by ${overlappingStay.guestName} (${overlappingStay.checkInDate} ${overlappingStay.checkInTime || ''} to ${overlappingStay.expectedCheckOutDate} ${overlappingStay.expectedCheckOutTime || ''}).`,
    };
  }

  // 4. Check overlapping reservations in Firestore
  const allReservations = await getReservations();
  const overlappingRes = allReservations.find(r => 
    r.roomId === targetRoom.roomId &&
    r.reservationId !== excludeReservationId &&
    (r.status === 'CONFIRMED' || r.status === 'PENDING') &&
    isDateTimeRangeOverlapping(
      checkInDate, 
      checkInTime, 
      checkOutDate, 
      checkOutTime, 
      r.checkInDate, 
      r.checkInTime || '12:00', 
      r.checkOutDate, 
      r.checkOutTime || '11:00'
    )
  );

  if (overlappingRes) {
    return {
      isAvailable: false,
      conflictReason: `Room ${targetRoom.roomNumber} is reserved for ${overlappingRes.guestName} (${overlappingRes.checkInDate} to ${overlappingRes.checkOutDate}).`,
    };
  }

  return { isAvailable: true };
}

/**
 * Search and categorize all 24 rooms for a given date + time range
 */
export async function findAvailableRooms(
  checkInDate: string,
  checkOutDate: string,
  checkInTime = '12:00',
  checkOutTime = '11:00',
  excludeReservationId?: string
): Promise<{
  availableRooms: Room[];
  occupiedRooms: Room[];
  reservedRooms: Room[];
  maintenanceRooms: Room[];
}> {
  const [rooms, activeStays, reservations] = await Promise.all([
    getRooms(),
    getActiveStays(),
    getReservations()
  ]);

  const availableRooms: Room[] = [];
  const occupiedRooms: Room[] = [];
  const reservedRooms: Room[] = [];
  const maintenanceRooms: Room[] = [];

  for (const room of rooms) {
    if (room.status === 'Maintenance' || room.status === 'Blocked') {
      maintenanceRooms.push(room);
      continue;
    }

    // Check active stay overlap
    const stayConflict = activeStays.find(s => 
      s.roomId === room.roomId &&
      s.status === 'active' &&
      isDateTimeRangeOverlapping(
        checkInDate, 
        checkInTime, 
        checkOutDate, 
        checkOutTime, 
        s.checkInDate, 
        s.checkInTime || '12:00', 
        s.expectedCheckOutDate, 
        s.expectedCheckOutTime || '11:00'
      )
    );

    if (stayConflict) {
      occupiedRooms.push({
        ...room,
        currentGuestName: stayConflict.guestName,
        currentExpectedCheckOut: stayConflict.expectedCheckOutDate
      });
      continue;
    }

    // Check reservation overlap
    const resConflict = reservations.find(r => 
      r.roomId === room.roomId &&
      r.reservationId !== excludeReservationId &&
      (r.status === 'CONFIRMED' || r.status === 'PENDING') &&
      isDateTimeRangeOverlapping(
        checkInDate, 
        checkInTime, 
        checkOutDate, 
        checkOutTime, 
        r.checkInDate, 
        r.checkInTime || '12:00', 
        r.checkOutDate, 
        r.checkOutTime || '11:00'
      )
    );

    if (resConflict) {
      reservedRooms.push({
        ...room,
        upcomingReservation: {
          reservationId: resConflict.reservationId,
          guestName: resConflict.guestName,
          checkInDate: resConflict.checkInDate,
          checkOutDate: resConflict.checkOutDate,
        }
      });
      continue;
    }

    availableRooms.push(room);
  }

  return {
    availableRooms,
    occupiedRooms,
    reservedRooms,
    maintenanceRooms
  };
}

/**
 * Create a new future or same-day reservation with strict Firestore double-booking validation
 */
export async function createReservation(
  reservationData: Omit<Reservation, 'reservationId' | 'status' | 'createdAt' | 'updatedAt'>,
  userEmail = 'admin'
): Promise<Reservation> {
  const { checkInDate, checkOutDate, checkInTime = '12:00', checkOutTime = '11:00', roomId } = reservationData;

  // Strict date & time validation
  if (checkOutDate < checkInDate) {
    throw new Error('Check-out date cannot be before check-in date.');
  }
  if (checkOutDate === checkInDate && normalizeTime(checkOutTime) <= normalizeTime(checkInTime)) {
    throw new Error('For a same-day stay, check-out time must be later than check-in time.');
  }

  // Pre-flight availability check against Firestore
  const availability = await checkRoomAvailability(roomId, checkInDate, checkOutDate, checkInTime, checkOutTime);
  if (!availability.isAvailable) {
    throw new Error(availability.conflictReason || `Room is not available for the requested period.`);
  }

  // Save/update guest profile in Firestore
  const guest = await saveOrUpdateGuest({
    guestName: reservationData.guestName,
    phone: reservationData.guestPhone,
    email: reservationData.guestEmail,
    address: reservationData.guestAddress,
    idType: 'Aadhaar Card',
    idNumber: '',
  });

  const reservationId = `RES-${Date.now()}`;
  const daysDiff = calculateDaysBetween(checkInDate, checkOutDate);
  const numberOfDays = daysDiff > 0 ? daysDiff : 1; // Same-day is 1 day-use stay

  const fullReservation: Reservation = {
    ...reservationData,
    reservationId,
    guestId: guest.guestId,
    checkInTime,
    checkOutTime,
    numberOfDays,
    status: 'CONFIRMED',
    confirmedAt: new Date().toISOString(),
    confirmedBy: userEmail,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: userEmail,
  };

  // 1. Save to local fallback
  localFallbackStore.saveReservation(fullReservation);

  // 2. Persist to Firestore
  const resRef = doc(db, RESERVATIONS_COLLECTION, reservationId);
  await setDoc(resRef, {
    ...fullReservation,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  // 3. If advance amount > 0, record real Payment record in `payments` collection
  if (reservationData.advanceAmount && reservationData.advanceAmount > 0) {
    await recordPayment({
      reservationId,
      billId: `ADV-${reservationId}`,
      guestId: guest.guestId,
      guestName: reservationData.guestName,
      roomNumber: reservationData.roomNumber,
      amount: reservationData.advanceAmount,
      paymentType: (reservationData.paymentType as PaymentMethod) || 'Cash',
      referenceNumber: `ADV-RES-${reservationId.slice(-6)}`,
      paymentDate: getTodayDateString(),
      notes: `Advance booking payment for Room ${reservationData.roomNumber} (${checkInDate} to ${checkOutDate})`,
    }, userEmail);
  }

  // 4. Update room status to 'Reserved' if check-in is today
  const today = getTodayDateString();
  if (checkInDate === today) {
    await updateRoomStatus(roomId, 'Reserved', {
      stayId: reservationId,
      guestName: reservationData.guestName,
      checkInDate: checkInDate,
      expectedCheckOut: checkOutDate,
    }, userEmail);
  }

  // 5. Activity log
  await logActivity({
    action: 'RESERVATION_CREATED',
    userEmail,
    entityType: 'reservation',
    entityId: reservationId,
    description: `Reservation created for ${reservationData.guestName} in Room ${reservationData.roomNumber} (${checkInDate} to ${checkOutDate})`,
  });

  return fullReservation;
}

/**
 * Update an existing reservation
 */
export async function updateReservation(
  reservationId: string,
  updates: Partial<Reservation>,
  userEmail = 'admin'
): Promise<void> {
  const existing = await getReservationById(reservationId);
  if (!existing) throw new Error('Reservation not found');

  const checkInDate = updates.checkInDate || existing.checkInDate;
  const checkOutDate = updates.checkOutDate || existing.checkOutDate;
  const checkInTime = updates.checkInTime || existing.checkInTime || '12:00';
  const checkOutTime = updates.checkOutTime || existing.checkOutTime || '11:00';
  const targetRoomId = updates.roomId || existing.roomId;

  if (updates.checkInDate || updates.checkOutDate || updates.roomId || updates.checkInTime || updates.checkOutTime) {
    const avail = await checkRoomAvailability(
      targetRoomId,
      checkInDate,
      checkOutDate,
      checkInTime,
      checkOutTime,
      reservationId
    );
    if (!avail.isAvailable) {
      throw new Error(avail.conflictReason || 'Room is unavailable for requested schedule.');
    }
  }

  const payload: Partial<Reservation> = {
    ...updates,
    updatedAt: new Date().toISOString(),
    updatedBy: userEmail,
  };

  localFallbackStore.saveReservation({ ...existing, ...payload });

  await updateDoc(doc(db, RESERVATIONS_COLLECTION, reservationId), {
    ...payload,
    updatedAt: serverTimestamp(),
  });

  await logActivity({
    action: 'RESERVATION_UPDATED',
    userEmail,
    entityType: 'reservation',
    entityId: reservationId,
    description: `Reservation ${reservationId} updated for ${existing.guestName}`,
  });
}

/**
 * Cancel a reservation
 */
export async function cancelReservation(
  reservationId: string,
  reason = 'Cancelled by guest request',
  userEmail = 'admin'
): Promise<void> {
  const existing = await getReservationById(reservationId);
  if (!existing) throw new Error('Reservation not found');

  const updates: Partial<Reservation> = {
    status: 'CANCELLED',
    cancelledAt: new Date().toISOString(),
    cancelledBy: userEmail,
    cancellationReason: reason,
    updatedAt: new Date().toISOString(),
    updatedBy: userEmail,
  };

  localFallbackStore.saveReservation({ ...existing, ...updates });

  await updateDoc(doc(db, RESERVATIONS_COLLECTION, reservationId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });

  // Release room if it was set to Reserved for this reservation
  const allRooms = await getRooms();
  const room = allRooms.find(r => r.roomId === existing.roomId);
  if (room && room.status === 'Reserved') {
    await updateRoomStatus(existing.roomId, 'Available', undefined, userEmail);
  }

  await logActivity({
    action: 'RESERVATION_CANCELLED',
    userEmail,
    entityType: 'reservation',
    entityId: reservationId,
    description: `Reservation ${reservationId} for ${existing.guestName} cancelled. Reason: ${reason}`,
  });
}

/**
 * Mark a reservation as NO-SHOW
 */
export async function markReservationNoShow(
  reservationId: string,
  userEmail = 'admin'
): Promise<void> {
  const existing = await getReservationById(reservationId);
  if (!existing) throw new Error('Reservation not found');

  const updates: Partial<Reservation> = {
    status: 'NO_SHOW',
    noShowAt: new Date().toISOString(),
    noShowBy: userEmail,
    updatedAt: new Date().toISOString(),
    updatedBy: userEmail,
  };

  localFallbackStore.saveReservation({ ...existing, ...updates });

  await updateDoc(doc(db, RESERVATIONS_COLLECTION, reservationId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });

  // Release room
  const allRooms = await getRooms();
  const room = allRooms.find(r => r.roomId === existing.roomId);
  if (room && room.status === 'Reserved') {
    await updateRoomStatus(existing.roomId, 'Available', undefined, userEmail);
  }

  await logActivity({
    action: 'RESERVATION_NO_SHOW',
    userEmail,
    entityType: 'reservation',
    entityId: reservationId,
    description: `Reservation ${reservationId} for ${existing.guestName} marked as NO-SHOW`,
  });
}

/**
 * Check in from an existing reservation:
 * Transfers reservation to active Stay, sets reservation -> CHECKED_IN, room -> OCCUPIED.
 */
export async function checkInFromReservation(params: {
  reservationId: string;
  checkInDate?: string;
  checkInTime?: string;
  additionalAdvance?: number;
  paymentType?: PaymentMethod;
  idType?: string;
  idNumber?: string;
  paxAdults?: number;
  paxChildren?: number;
  userEmail?: string;
}): Promise<Stay> {
  const { reservationId, userEmail = 'admin' } = params;
  const reservation = await getReservationById(reservationId);

  if (!reservation) {
    throw new Error('Reservation not found');
  }

  if (reservation.status === 'CHECKED_IN') {
    throw new Error('This reservation is already checked in.');
  }
  if (reservation.status === 'CANCELLED' || reservation.status === 'NO_SHOW') {
    throw new Error(`Cannot check in a ${reservation.status} reservation.`);
  }

  const checkInDate = params.checkInDate || reservation.checkInDate || getTodayDateString();
  const checkInTime = params.checkInTime || reservation.checkInTime || getCurrentTimeString();
  const totalAdvance = (reservation.advanceAmount || 0) + (params.additionalAdvance || 0);

  // If additional advance given at check-in time, record payment
  if (params.additionalAdvance && params.additionalAdvance > 0) {
    await recordPayment({
      reservationId,
      billId: `ADV-${reservationId}`,
      guestId: reservation.guestId,
      guestName: reservation.guestName,
      roomNumber: reservation.roomNumber,
      amount: params.additionalAdvance,
      paymentType: params.paymentType || (reservation.paymentType as PaymentMethod) || 'Cash',
      referenceNumber: `CHECKIN-ADV-${Date.now().toString().slice(-4)}`,
      paymentDate: checkInDate,
      notes: `Check-in advance payment for Room ${reservation.roomNumber} (${reservation.guestName})`,
    }, userEmail);
  }

  const calculatedDays = calculateDaysBetween(checkInDate, reservation.checkOutDate);
  const stayDays = calculatedDays > 0 ? calculatedDays : 1;

  // Create Stay document using stayService architecture
  const stay = await createCheckIn({
    guestId: reservation.guestId || `GST-${Date.now()}`,
    guestName: reservation.guestName,
    guestPhone: reservation.guestPhone,
    guestEmail: reservation.guestEmail || '',
    guestAddress: reservation.guestAddress || '',
    idType: params.idType || 'Aadhaar Card',
    idNumber: params.idNumber || '',
    roomId: reservation.roomId,
    roomNumber: reservation.roomNumber,
    roomType: reservation.roomType,
    planType: reservation.planType,
    paxAdults: params.paxAdults || reservation.adults || 1,
    paxChildren: params.paxChildren || reservation.children || 0,
    bookingId: reservation.reservationId,
    checkInDate,
    checkInTime,
    expectedCheckOutDate: reservation.checkOutDate,
    expectedCheckOutTime: reservation.checkOutTime || '11:00',
    numberOfDays: stayDays,
    roomTariff: reservation.tariff,
    gstRate: 12,
    discount: 0,
    extraCharges: 0,
    subtotal: reservation.tariff * stayDays,
    taxableAmount: reservation.tariff * stayDays,
    cgst: (reservation.tariff * stayDays) * 0.06,
    sgst: (reservation.tariff * stayDays) * 0.06,
    igst: 0,
    totalGST: (reservation.tariff * stayDays) * 0.12,
    grossTotal: (reservation.tariff * stayDays) * 1.12,
    advancePaid: totalAdvance,
    balanceDue: ((reservation.tariff * stayDays) * 1.12) - totalAdvance,
    paymentType: params.paymentType || (reservation.paymentType as PaymentMethod) || 'Cash',
    notes: reservation.specialRequests || '',
  }, userEmail);

  // Update Reservation status -> CHECKED_IN
  const resUpdates: Partial<Reservation> = {
    status: 'CHECKED_IN',
    checkedInAt: new Date().toISOString(),
    checkedInBy: userEmail,
    stayId: stay.stayId,
    updatedAt: new Date().toISOString(),
    updatedBy: userEmail,
  };

  localFallbackStore.saveReservation({ ...reservation, ...resUpdates });

  await updateDoc(doc(db, RESERVATIONS_COLLECTION, reservationId), {
    ...resUpdates,
    updatedAt: serverTimestamp(),
  });

  await logActivity({
    action: 'RESERVATION_CHECKED_IN',
    userEmail,
    entityType: 'reservation',
    entityId: reservationId,
    description: `Reservation ${reservationId} converted to Active Stay ${stay.stayId} in Room ${reservation.roomNumber}`,
  });

  return stay;
}
