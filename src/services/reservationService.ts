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
  runTransaction 
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

const RESERVATIONS_COLLECTION = 'reservations';
const STAYS_COLLECTION = 'stays';
const ROOMS_COLLECTION = 'rooms';

/**
 * Checks if two date ranges [startA, endA] and [startB, endB] overlap.
 * Hotel standard rule: Overlaps if startA < endB and endA > startB.
 * Allows same-day turnover (e.g. checkout 27th, checkin 27th).
 */
export function isDateRangeOverlapping(
  startA: string, 
  endA: string, 
  startB: string, 
  endB: string
): boolean {
  return startA < endB && endA > startB;
}

/**
 * Fetch all reservations from Firestore (with local fallback)
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
 * Check if a room is available for a given date range against Firestore.
 * Prevents double booking with existing active/confirmed reservations and active stays.
 */
export async function checkRoomAvailability(
  roomId: string,
  checkInDate: string,
  checkOutDate: string,
  excludeReservationId?: string
): Promise<{ isAvailable: boolean; conflictReason?: string }> {
  if (checkOutDate <= checkInDate) {
    return {
      isAvailable: false,
      conflictReason: 'Check-out date must be strictly after check-in date.',
    };
  }

  // 1. Fetch room operational status
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

  // 2. Check overlapping active stays in Firestore
  const activeStays = await getActiveStays();
  const overlappingStay = activeStays.find(s => 
    s.roomId === targetRoom.roomId &&
    s.status === 'active' &&
    isDateRangeOverlapping(checkInDate, checkOutDate, s.checkInDate, s.expectedCheckOutDate)
  );

  if (overlappingStay) {
    return {
      isAvailable: false,
      conflictReason: `Room ${targetRoom.roomNumber} is currently occupied by ${overlappingStay.guestName} until ${overlappingStay.expectedCheckOutDate}.`,
    };
  }

  // 3. Check overlapping reservations in Firestore
  const allReservations = await getReservations();
  const overlappingRes = allReservations.find(r => 
    r.roomId === targetRoom.roomId &&
    r.reservationId !== excludeReservationId &&
    (r.status === 'CONFIRMED' || r.status === 'PENDING') &&
    isDateRangeOverlapping(checkInDate, checkOutDate, r.checkInDate, r.checkOutDate)
  );

  if (overlappingRes) {
    return {
      isAvailable: false,
      conflictReason: `Room ${targetRoom.roomNumber} is already reserved for ${overlappingRes.guestName} (${overlappingRes.checkInDate} to ${overlappingRes.checkOutDate}).`,
    };
  }

  return { isAvailable: true };
}

/**
 * Search and categorize all 24 rooms for a given date range
 */
export async function findAvailableRooms(
  checkInDate: string,
  checkOutDate: string,
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
      isDateRangeOverlapping(checkInDate, checkOutDate, s.checkInDate, s.expectedCheckOutDate)
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
      isDateRangeOverlapping(checkInDate, checkOutDate, r.checkInDate, r.checkOutDate)
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
 * Create a new future reservation with strict Firestore double-booking validation
 */
export async function createReservation(
  reservationData: Omit<Reservation, 'reservationId' | 'status' | 'createdAt' | 'updatedAt'>,
  userEmail = 'admin'
): Promise<Reservation> {
  const { checkInDate, checkOutDate, roomId } = reservationData;

  // Strict date validation
  if (checkOutDate <= checkInDate) {
    throw new Error('Check-out date must be after check-in date.');
  }

  // Pre-flight availability check
  const availability = await checkRoomAvailability(roomId, checkInDate, checkOutDate);
  if (!availability.isAvailable) {
    throw new Error(availability.conflictReason || `Room is not available for ${checkInDate} to ${checkOutDate}.`);
  }

  // Save/update guest profile
  const guest = await saveOrUpdateGuest({
    guestName: reservationData.guestName,
    phone: reservationData.guestPhone,
    email: reservationData.guestEmail,
    address: reservationData.guestAddress,
    idType: 'Aadhaar Card',
    idNumber: '',
  });

  const reservationId = `RES-${Date.now()}`;
  const numberOfDays = calculateDaysBetween(checkInDate, checkOutDate) || 1;

  const fullReservation: Reservation = {
    ...reservationData,
    reservationId,
    guestId: guest.guestId,
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

  // 2. Save in Firestore
  try {
    const resRef = doc(db, RESERVATIONS_COLLECTION, reservationId);
    await setDoc(resRef, {
      ...fullReservation,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Firestore save error, saved locally:', err);
  }

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

  // 4. Update room status to 'Reserved' if check-in is today or upcoming
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

  if (updates.checkInDate && updates.checkOutDate && (updates.checkInDate !== existing.checkInDate || updates.checkOutDate !== existing.checkOutDate)) {
    const avail = await checkRoomAvailability(
      updates.roomId || existing.roomId,
      updates.checkInDate,
      updates.checkOutDate,
      reservationId
    );
    if (!avail.isAvailable) {
      throw new Error(avail.conflictReason || 'Room is unavailable for new dates.');
    }
  }

  const payload: Partial<Reservation> = {
    ...updates,
    updatedAt: new Date().toISOString(),
    updatedBy: userEmail,
  };

  localFallbackStore.saveReservation({ ...existing, ...payload });

  try {
    await updateDoc(doc(db, RESERVATIONS_COLLECTION, reservationId), {
      ...payload,
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    // Handled locally
  }

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

  try {
    await updateDoc(doc(db, RESERVATIONS_COLLECTION, reservationId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    // Local fallback
  }

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

  try {
    await updateDoc(doc(db, RESERVATIONS_COLLECTION, reservationId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    // Local fallback
  }

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

  const checkInDate = params.checkInDate || getTodayDateString();
  const checkInTime = params.checkInTime || getCurrentTimeString();
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
    numberOfDays: calculateDaysBetween(checkInDate, reservation.checkOutDate) || 1,
    roomTariff: reservation.tariff,
    gstRate: 12,
    discount: 0,
    extraCharges: 0,
    subtotal: reservation.tariff * (calculateDaysBetween(checkInDate, reservation.checkOutDate) || 1),
    taxableAmount: reservation.tariff * (calculateDaysBetween(checkInDate, reservation.checkOutDate) || 1),
    cgst: (reservation.tariff * (calculateDaysBetween(checkInDate, reservation.checkOutDate) || 1)) * 0.06,
    sgst: (reservation.tariff * (calculateDaysBetween(checkInDate, reservation.checkOutDate) || 1)) * 0.06,
    igst: 0,
    totalGST: (reservation.tariff * (calculateDaysBetween(checkInDate, reservation.checkOutDate) || 1)) * 0.12,
    grossTotal: (reservation.tariff * (calculateDaysBetween(checkInDate, reservation.checkOutDate) || 1)) * 1.12,
    advancePaid: totalAdvance,
    balanceDue: ((reservation.tariff * (calculateDaysBetween(checkInDate, reservation.checkOutDate) || 1)) * 1.12) - totalAdvance,
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

  try {
    await updateDoc(doc(db, RESERVATIONS_COLLECTION, reservationId), {
      ...resUpdates,
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    // handled
  }

  await logActivity({
    action: 'RESERVATION_CHECKED_IN',
    userEmail,
    entityType: 'reservation',
    entityId: reservationId,
    description: `Reservation ${reservationId} converted to Active Stay ${stay.stayId} in Room ${reservation.roomNumber}`,
  });

  return stay;
}
