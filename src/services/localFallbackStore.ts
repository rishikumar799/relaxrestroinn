import { Room, Stay, Guest, Bill, Payment, HotelSettings, ActivityLog, Reservation } from '../types';
import { DEFAULT_HOTEL_SETTINGS } from './settingsService';

function getStored<T>(key: string, defaultVal: T): T {
  try {
    const item = localStorage.getItem(`rri_${key}`);
    if (!item) return defaultVal;
    return JSON.parse(item);
  } catch (e) {
    return defaultVal;
  }
}

function setStored<T>(key: string, val: T): void {
  try {
    localStorage.setItem(`rri_${key}`, JSON.stringify(val));
  } catch (e) {
    // ignore
  }
}

export const localFallbackStore = {
  // Reservations
  getReservations: (): Reservation[] => {
    return getStored<Reservation[]>('reservations', []);
  },
  saveReservations: (reservations: Reservation[]) => {
    setStored('reservations', reservations);
  },
  saveReservation: (res: Reservation) => {
    const list = localFallbackStore.getReservations();
    const idx = list.findIndex(r => r.reservationId === res.reservationId);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...res };
    } else {
      list.unshift(res);
    }
    localFallbackStore.saveReservations(list);
  },

  // Rooms
  getRooms: (): Room[] => {
    return getStored<Room[]>('rooms', []);
  },
  saveRooms: (rooms: Room[]) => {
    setStored('rooms', rooms);
  },
  updateRoom: (room: Room) => {
    const rooms = localFallbackStore.getRooms();
    const idx = rooms.findIndex(r => r.roomId === room.roomId || r.roomNumber === room.roomNumber);
    if (idx >= 0) {
      rooms[idx] = { ...rooms[idx], ...room };
    } else {
      rooms.push(room);
    }
    localFallbackStore.saveRooms(rooms);
  },

  // Stays
  getStays: (): Stay[] => {
    return getStored<Stay[]>('stays', []);
  },
  saveStays: (stays: Stay[]) => {
    setStored('stays', stays);
  },
  saveStay: (stay: Stay) => {
    const stays = localFallbackStore.getStays();
    const idx = stays.findIndex(s => s.stayId === stay.stayId);
    if (idx >= 0) {
      stays[idx] = { ...stays[idx], ...stay };
    } else {
      stays.unshift(stay);
    }
    localFallbackStore.saveStays(stays);
  },

  // Guests
  getGuests: (): Guest[] => {
    return getStored<Guest[]>('guests', []);
  },
  saveGuests: (guests: Guest[]) => {
    setStored('guests', guests);
  },
  saveGuest: (guest: Guest) => {
    const guests = localFallbackStore.getGuests();
    const idx = guests.findIndex(g => g.guestId === guest.guestId || (guest.phone && g.phone === guest.phone));
    if (idx >= 0) {
      guests[idx] = { ...guests[idx], ...guest };
    } else {
      guests.unshift(guest);
    }
    localFallbackStore.saveGuests(guests);
  },

  // Bills
  getBills: (): Bill[] => {
    return getStored<Bill[]>('bills', []);
  },
  saveBills: (bills: Bill[]) => {
    setStored('bills', bills);
  },
  saveBill: (bill: Bill) => {
    const bills = localFallbackStore.getBills();
    const idx = bills.findIndex(b => b.billId === bill.billId);
    if (idx >= 0) {
      bills[idx] = { ...bills[idx], ...bill };
    } else {
      bills.unshift(bill);
    }
    localFallbackStore.saveBills(bills);
  },

  // Payments
  getPayments: (): Payment[] => {
    return getStored<Payment[]>('payments', []);
  },
  savePayments: (payments: Payment[]) => {
    setStored('payments', payments);
  },
  savePayment: (payment: Payment) => {
    const payments = localFallbackStore.getPayments();
    payments.unshift(payment);
    localFallbackStore.savePayments(payments);
  },

  // Settings
  getSettings: (): HotelSettings => {
    return getStored<HotelSettings>('settings', DEFAULT_HOTEL_SETTINGS);
  },
  saveSettings: (settings: HotelSettings) => {
    setStored('settings', settings);
  },

  // Activities
  getActivities: (): ActivityLog[] => {
    return getStored<ActivityLog[]>('activities', []);
  },
  saveActivity: (act: ActivityLog) => {
    const activities = localFallbackStore.getActivities();
    activities.unshift(act);
    if (activities.length > 100) activities.pop();
    setStored('activities', activities);
  },

  // Invoice Counter
  getNextInvoiceNumber: (prefix = 'RRI', startSeq = 101, suffix = '24-25'): string => {
    const current = getStored<number>('invoice_seq', startSeq);
    setStored('invoice_seq', current + 1);
    const padded = String(current).padStart(4, '0');
    return `${prefix}-${padded}${suffix ? `-${suffix}` : ''}`;
  }
};
