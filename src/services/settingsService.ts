import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { HotelSettings } from '../types';
import { logActivity } from './activityService';
import { localFallbackStore } from './localFallbackStore';

export const DEFAULT_HOTEL_SETTINGS: HotelSettings = {
  hotelName: "RELAX RESTO INN",
  legalName: "Ashritha Sai Services & Trading Pvt Ltd",
  cin: "72501AP2021PTC120374",
  address: "#49-49-7, SHANTHIPURAM, REVENUE WARD NO-12, VISAKHAPATNAM-530016",
  phone: "0891-2713344, 927345, 962789456, 9912451116",
  email: "relaxrestroinn@gmail.com",
  gstin: "37AAWCA2881J2ZY",
  website: "www.ashrithasai.com",
  stateCode: "37",
  placeOfSupply: "ANDHRA PRADESH (37)",
  authorizedByName: "RELAX RESTO INN",
  verifiedByName: "FRONT DESK ADMIN",
  invoiceFooter: "Thank you for staying at Relax Resto Inn. Have a safe journey!",
  invoicePrefix: "RRI",
  invoiceStartSequence: 101,
  invoiceSuffix: "24-25",
  defaultCheckInTime: "12:00",
  defaultCheckOutTime: "11:00",
  defaultGSTRate: 12,
  hsnCode: "996311",
};

const SETTINGS_DOC_REF = doc(db, 'hotel_settings', 'main');

export async function getHotelSettings(): Promise<HotelSettings> {
  try {
    const docSnap = await getDoc(SETTINGS_DOC_REF);
    if (docSnap.exists()) {
      const merged = { ...DEFAULT_HOTEL_SETTINGS, ...docSnap.data() } as HotelSettings;
      localFallbackStore.saveSettings(merged);
      return merged;
    } else {
      try {
        await setDoc(SETTINGS_DOC_REF, {
          ...DEFAULT_HOTEL_SETTINGS,
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        // rules may be restricted
      }
      return DEFAULT_HOTEL_SETTINGS;
    }
  } catch (error) {
    // Permission error or network issue
    return localFallbackStore.getSettings();
  }
}

export async function updateHotelSettings(newSettings: Partial<HotelSettings>, userEmail = 'admin'): Promise<void> {
  const current = localFallbackStore.getSettings();
  const merged = { ...current, ...newSettings };
  localFallbackStore.saveSettings(merged);

  try {
    await setDoc(SETTINGS_DOC_REF, {
      ...merged,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    // Local fallback is already saved
  }

  await logActivity({
    action: 'SETTINGS_UPDATED',
    userEmail,
    entityType: 'settings',
    entityId: 'main',
    description: 'Hotel settings & invoice configuration updated',
  });
}

export async function saveHotelSettings(newSettings: Partial<HotelSettings>, userEmail = 'admin'): Promise<void> {
  return updateHotelSettings(newSettings, userEmail);
}
