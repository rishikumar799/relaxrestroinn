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
import { Bill, Stay, Room, Payment, BillLineItem, TaxSummaryItem, BillSummaryItem, AdvanceReceiptItem } from '../types';
import { getNextInvoiceNumber } from './counterService';
import { getHotelSettings } from './settingsService';
import { updateRoomStatus } from './roomService';
import { saveOrUpdateGuest } from './guestService';
import { recordPayment } from './paymentService';
import { logActivity } from './activityService';
import { localFallbackStore } from './localFallbackStore';
import { formatAmountInWords, convertAmountToWords } from '../utils/numberToWords';
import { roundToTwo } from '../utils/currency';
import { calculateDaysBetween, getTodayDateString, getCurrentTimeString } from '../utils/date';
import { calculateLineItem, computeTaxSummary, computeBillTotals } from '../utils/tax';

const BILLS_COLLECTION = 'bills';
const STAYS_COLLECTION = 'stays';
const RESERVATIONS_COLLECTION = 'reservations';

export async function createCheckoutBill(params: {
  stay: Stay;
  actualCheckOutDate: string;
  actualCheckOutTime: string;
  numberOfDays: number;
  extraCharges?: number;
  discount?: number;
  finalPaymentAmount?: number;
  finalPaymentType?: Stay['paymentType'];
  finalPaymentRef?: string;
  notes?: string;
  userEmail?: string;
  customLineItems?: BillLineItem[];
  customRounding?: number;
}): Promise<Bill> {
  const { 
    stay, 
    actualCheckOutDate, 
    actualCheckOutTime, 
    numberOfDays, 
    extraCharges = 0, 
    discount = 0, 
    finalPaymentAmount = 0,
    finalPaymentType = stay.paymentType,
    finalPaymentRef = '',
    notes = '',
    userEmail = 'admin',
    customLineItems,
    customRounding
  } = params;

  const settings = await getHotelSettings();
  const billNo = await getNextInvoiceNumber();
  const billId = `BILL-${Date.now()}`;
  const billDate = actualCheckOutDate || getTodayDateString();
  const billTime = actualCheckOutTime || getCurrentTimeString();

  const gstRate = stay.gstRate !== undefined ? stay.gstRate : (settings.defaultGSTRate || 12);
  const roomTariff = stay.roomTariff || 0;
  const roomValue = roundToTwo(roomTariff * numberOfDays);
  const roomDetailsStr = `${stay.roomNumber}-${(stay.roomType || 'ROOM').toUpperCase()}${stay.planType ? ` ( Plan Type : ${stay.planType} )` : ''}`;
  const itemRoomDetails = `${stay.roomNumber}-${(stay.roomType || 'ROOM').toUpperCase()}`;

  // Build line items
  let lineItems: BillLineItem[] = [];
  if (customLineItems && customLineItems.length > 0) {
    lineItems = customLineItems.map(calculateLineItem);
  } else {
    // 1. Room tariff item
    lineItems.push(calculateLineItem({
      id: `li-1`,
      date: stay.checkInDate,
      roomDetails: itemRoomDetails,
      description: 'TARIFF',
      rate: roomTariff,
      numberOfDays: numberOfDays,
      days: numberOfDays,
      value: roomValue,
      discount: discount > 0 && extraCharges === 0 ? discount : 0,
      gstRate: gstRate,
      hsn: settings.hsnCode || '996311',
    }));

    // 2. Extra charges items if any
    if (stay.extraChargesList && stay.extraChargesList.length > 0) {
      stay.extraChargesList.forEach((extra, idx) => {
        const isFood = extra.description.toLowerCase().includes('food') || extra.description.toLowerCase().includes('restaurant') || extra.description.toLowerCase().includes('dining');
        const extraGSTRate = isFood ? 5 : gstRate;
        lineItems.push(calculateLineItem({
          id: `li-extra-${idx}`,
          date: extra.date || billDate,
          roomDetails: itemRoomDetails,
          description: extra.description || 'Food Charges',
          rate: extra.amount,
          numberOfDays: '-',
          value: extra.amount,
          discount: 0,
          gstRate: extraGSTRate,
          hsn: isFood ? '996331' : (settings.hsnCode || '996311'),
        }));
      });
    } else if (extraCharges > 0) {
      lineItems.push(calculateLineItem({
        id: `li-extra`,
        date: billDate,
        roomDetails: itemRoomDetails,
        description: 'Food Charges',
        rate: extraCharges,
        numberOfDays: '-',
        value: extraCharges,
        discount: discount > 0 ? discount : 0,
        gstRate: 5,
        hsn: '996331',
      }));
    }
  }

  const totalAdvance = roundToTwo(stay.advancePaid || 0);
  const totalPaid = roundToTwo(totalAdvance + (finalPaymentAmount || 0));

  const totals = computeBillTotals(lineItems, totalPaid, customRounding);
  const taxSummary = computeTaxSummary(lineItems, stay.isInterState);

  // Summary accounts
  const summary: BillSummaryItem[] = [
    { accountName: 'TARIFF', amount: roomValue }
  ];
  if (extraCharges > 0) {
    summary.push({ accountName: 'FOOD & EXTRAS', amount: extraCharges });
  }

  // Advance Receipts
  const advanceDetails: AdvanceReceiptItem[] = [];
  if (totalAdvance > 0) {
    advanceDetails.push({
      date: stay.checkInDate,
      description: stay.paymentType ? `Bank ( ${stay.paymentType} )` : 'Cash',
      desc: stay.paymentType ? `Bank ( ${stay.paymentType} )` : 'Cash',
      refNo: stay.bookingId || stay.grcNumber || `A-R-${stay.roomNumber}-${stay.checkInDate.slice(-5)}`,
      roomDetails: stay.roomNumber,
      room: stay.roomNumber,
      amount: totalAdvance,
      paymentType: stay.paymentType,
    });
  }
  if (finalPaymentAmount > 0) {
    advanceDetails.push({
      date: billDate,
      description: finalPaymentType ? `Bank ( ${finalPaymentType} )` : 'Cash',
      desc: finalPaymentType ? `Bank ( ${finalPaymentType} )` : 'Cash',
      refNo: finalPaymentRef || `FINAL-${stay.roomNumber}`,
      roomDetails: stay.roomNumber,
      room: stay.roomNumber,
      amount: finalPaymentAmount,
      paymentType: finalPaymentType,
    });
  }

  const adultCount = stay.paxAdults !== undefined ? stay.paxAdults : 1;
  const childCount = stay.paxChildren !== undefined ? stay.paxChildren : 0;
  const paxText = `(Adult : ${adultCount}, Child : ${childCount})`;

  const bill: Bill = {
    billId,
    billNo,
    billDate,
    billTime,
    billType: 'stay',
    status: totals.balance <= 0 ? 'paid' : 'partially_paid',
    stayId: stay.stayId,
    guestId: stay.guestId,
    guestName: stay.guestName,
    guestPhone: stay.guestPhone,
    guestAddress: stay.guestAddress || '',
    guestEmail: stay.guestEmail || '',
    paxAdult: adultCount,
    paxChild: childCount,
    pax: paxText,
    idCardNumber: stay.idNumber || '',
    idCardType: stay.idType || 'Aadhaar Card',
    companyName: stay.companyName || '',
    companyAddress: stay.companyAddress || '',
    companyDetails: stay.companyName ? `${stay.companyName}${stay.companyAddress ? ' ' + stay.companyAddress : ''}` : '',
    companyGSTIN: stay.companyGSTIN || '',
    refOTA: stay.refOTA || '',
    refOTAGSTIN: stay.refOTAGSTIN || '',
    stateCode: settings.stateCode || '28',
    placeOfSupply: settings.placeOfSupply || 'VISAKHAPATNAM-530016',
    roomNumber: stay.roomNumber,
    roomDetails: roomDetailsStr,
    roomType: stay.roomType,
    planType: stay.planType || 'CP',
    checkInDate: stay.checkInDate,
    checkInTime: stay.checkInTime || settings.defaultCheckInTime || '12:00',
    checkOutDate: actualCheckOutDate,
    checkOutTime: actualCheckOutTime || settings.defaultCheckOutTime || '11:00',
    bookingId: stay.bookingId || '',
    reservationId: stay.bookingId || '',
    grcNumber: stay.grcNumber || '',
    paymentType: finalPaymentType || stay.paymentType || 'Wallet',
    numberOfDays,
    lineItems,
    subtotal: totals.subtotal,
    roundingAmount: totals.roundingAmount,
    grossTotalBeforeRounding: totals.grossTotalBeforeRounding,
    grossTotal: totals.grossTotal,
    advance: totalPaid,
    balance: totals.balance,
    amountInWords: totals.amountInWords,
    discount: totals.totalDiscount,
    taxableAmount: totals.subtotal,
    cgst: stay.isInterState ? 0 : roundToTwo(totals.totalGST / 2),
    sgst: stay.isInterState ? 0 : roundToTwo(totals.totalGST / 2),
    igst: stay.isInterState ? totals.totalGST : 0,
    totalGST: totals.totalGST,
    isInterState: !!stay.isInterState,
    summary,
    advanceDetails,
    advanceReceiptDetails: advanceDetails,
    taxSummary,
    authorizedBy: settings.authorizedByName || 'RELAX RESTO INN',
    verifiedBy: settings.verifiedByName || 'FRONT DESK ADMIN',
    guestSignatureName: stay.companyName || stay.guestName,
    guestSignaturePlace: settings.placeOfSupply || 'VISAKHAPATNAM-530016',
    notes: notes || stay.notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 1. Save Bill Document
  localFallbackStore.saveBill(bill);
  try {
    await setDoc(doc(db, BILLS_COLLECTION, billId), {
      ...bill,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    // Handled via local fallback
  }

  // 2. Update Stay Document -> status: 'checked_out', billId
  await updateDoc(doc(db, STAYS_COLLECTION, stay.stayId), {
    status: 'checked_out',
    billId,
    actualCheckOutDate,
    actualCheckOutTime,
    numberOfDays,
    extraCharges,
    discount,
    subtotal: totals.subtotal,
    taxableAmount: totals.subtotal,
    totalGST: totals.totalGST,
    grossTotal: totals.grossTotal,
    balanceDue: totals.balance,
    updatedAt: serverTimestamp(),
  });

  // 3. Update Room Status -> Available
  await updateRoomStatus(stay.roomId, 'Available', undefined, userEmail);

  // 4. Record checkout payment if any
  if (finalPaymentAmount > 0) {
    await recordPayment({
      billId,
      billNo,
      stayId: stay.stayId,
      guestId: stay.guestId,
      guestName: stay.guestName,
      roomNumber: stay.roomNumber,
      amount: finalPaymentAmount,
      paymentType: finalPaymentType,
      referenceNumber: finalPaymentRef || 'CHECKOUT',
      paymentDate: billDate,
      notes: `Checkout payment for Bill ${billNo} (${stay.guestName})`,
    }, userEmail);
  }

  // 5. Update Guest totalSpent
  await saveOrUpdateGuest({
    guestId: stay.guestId,
    totalSpent: totals.grossTotal,
    lastStayDate: billDate,
  });

  // 5.5 If stay was created from a reservation, update reservation status -> CHECKED_OUT
  const linkedResId = stay.bookingId || (stay as any).reservationId;
  if (linkedResId && linkedResId.startsWith('RES-')) {
    try {
      const resRef = doc(db, RESERVATIONS_COLLECTION, linkedResId);
      await updateDoc(resRef, {
        status: 'CHECKED_OUT',
        checkedOutAt: new Date().toISOString(),
        checkedOutBy: userEmail,
        billId,
        updatedAt: serverTimestamp(),
      });
      const localRes = localFallbackStore.getReservations().find(r => r.reservationId === linkedResId);
      if (localRes) {
        localFallbackStore.saveReservation({
          ...localRes,
          status: 'CHECKED_OUT',
          checkedOutAt: new Date().toISOString(),
          checkedOutBy: userEmail,
          billId,
        });
      }
    } catch (err) {
      console.warn('Reservation status update warning on checkout:', err);
    }
  }

  // 6. Audit Log
  await logActivity({
    action: 'CHECKOUT_COMPLETED',
    userEmail,
    entityType: 'stay',
    entityId: stay.stayId,
    description: `Checkout completed for ${stay.guestName} (Room ${stay.roomNumber}). Invoice generated: ${billNo} (Gross: ₹${totals.grossTotal})`,
  });

  await logActivity({
    action: 'BILL_CREATED',
    userEmail,
    entityType: 'bill',
    entityId: billId,
    description: `Tax Invoice ${billNo} generated for ${stay.guestName}`,
  });

  return bill;
}

export async function createManualBill(manualBillData: Partial<Bill>, userEmail = 'admin'): Promise<Bill> {
  const settings = await getHotelSettings();
  const billId = `BILL-${Date.now()}`;
  const billNo = manualBillData.billNo?.trim() || (await getNextInvoiceNumber());
  
  const billDate = manualBillData.billDate || getTodayDateString();
  const billTime = manualBillData.billTime || getCurrentTimeString();

  // Clean and prepare line items
  const rawItems = manualBillData.lineItems && manualBillData.lineItems.length > 0
    ? manualBillData.lineItems
    : [
        {
          id: 'li-1',
          date: manualBillData.checkInDate || billDate,
          roomDetails: manualBillData.roomDetails || `${manualBillData.roomNumber || '309'}-${(manualBillData.roomType || 'SUIT ROOM').toUpperCase()}`,
          description: 'TARIFF',
          rate: manualBillData.subtotal || 1785.71,
          numberOfDays: manualBillData.numberOfDays || 1,
          value: manualBillData.subtotal || 1785.71,
          discount: manualBillData.discount || 0,
          total: manualBillData.taxableAmount || 1785.71,
          gstRate: 12,
          gstAmount: roundToTwo((1785.71 * 12) / 100),
          netTotal: roundToTwo(1785.71 * 1.12),
        }
      ];

  const lineItems = rawItems.map(calculateLineItem);
  const totalAdvance = roundToTwo(manualBillData.advance || 0);
  const totals = computeBillTotals(lineItems, totalAdvance, manualBillData.roundingAmount);
  const taxSummary = (manualBillData.taxSummary && manualBillData.taxSummary.length > 0)
    ? manualBillData.taxSummary
    : computeTaxSummary(lineItems, manualBillData.isInterState);

  // Save guest profile if guestName and phone exist
  let savedGuestId = manualBillData.guestId;
  if (manualBillData.guestName) {
    const saved = await saveOrUpdateGuest({
      guestName: manualBillData.guestName,
      phone: manualBillData.guestPhone || '',
      address: manualBillData.guestAddress || '',
      idNumber: manualBillData.idCardNumber || '',
      idType: (manualBillData.idCardType as any) || 'Aadhaar Card',
      companyName: manualBillData.companyDetails || manualBillData.companyName || '',
      companyGSTIN: manualBillData.companyGSTIN || '',
      totalStays: 1,
      totalSpent: totals.grossTotal,
    });
    savedGuestId = saved.guestId;
  }

  const adultCount = manualBillData.paxAdult !== undefined ? manualBillData.paxAdult : 1;
  const childCount = manualBillData.paxChild !== undefined ? manualBillData.paxChild : 0;
  const paxText = manualBillData.pax || `(Adult : ${adultCount}, Child : ${childCount})`;

  const roomDetailsStr = manualBillData.roomDetails || `${manualBillData.roomNumber || '309'}-${(manualBillData.roomType || 'SUIT ROOM').toUpperCase()}${manualBillData.planType ? ` ( Plan Type : ${manualBillData.planType} )` : ''}`;

  const advanceDetails = manualBillData.advanceReceiptDetails || manualBillData.advanceDetails || (totalAdvance > 0 ? [{
    date: billDate,
    description: manualBillData.paymentType ? `Bank ( ${manualBillData.paymentType} )` : 'Wallet',
    desc: manualBillData.paymentType ? `Bank ( ${manualBillData.paymentType} )` : 'Wallet',
    refNo: manualBillData.bookingId || manualBillData.grcNumber || `A-R-${manualBillData.roomNumber || '309'}-01`,
    roomDetails: manualBillData.roomNumber || '309',
    room: manualBillData.roomNumber || '309',
    amount: totalAdvance,
    paymentType: manualBillData.paymentType as any || 'Wallet',
  }] : []);

  const fullBill: Bill = {
    billId,
    billNo,
    billDate,
    billTime,
    billType: 'manual',
    status: totals.balance <= 0 ? 'paid' : (totalAdvance > 0 ? 'partially_paid' : 'pending'),
    guestId: savedGuestId,
    guestName: manualBillData.guestName || 'Guest',
    guestPhone: manualBillData.guestPhone || '',
    guestAddress: manualBillData.guestAddress || '',
    guestEmail: manualBillData.guestEmail || '',
    paxAdult: adultCount,
    paxChild: childCount,
    pax: paxText,
    idCardNumber: manualBillData.idCardNumber || '',
    idCardType: manualBillData.idCardType || 'Voter ID',
    companyName: manualBillData.companyName || manualBillData.companyDetails || '',
    companyAddress: manualBillData.companyAddress || '',
    companyDetails: manualBillData.companyDetails || manualBillData.companyName || '',
    companyGSTIN: manualBillData.companyGSTIN || '',
    refOTA: manualBillData.refOTA || '',
    refOTAGSTIN: manualBillData.refOTAGSTIN || '',
    stateCode: manualBillData.stateCode || settings.stateCode || '28',
    placeOfSupply: manualBillData.placeOfSupply || settings.placeOfSupply || 'VISAKHAPATNAM-530016',
    roomNumber: manualBillData.roomNumber || '309',
    roomDetails: roomDetailsStr,
    roomType: manualBillData.roomType || 'SUIT ROOM',
    planType: manualBillData.planType || 'CP',
    checkInDate: manualBillData.checkInDate || billDate,
    checkInTime: manualBillData.checkInTime || settings.defaultCheckInTime || '12:00',
    checkOutDate: manualBillData.checkOutDate || billDate,
    checkOutTime: manualBillData.checkOutTime || settings.defaultCheckOutTime || '11:00',
    bookingId: manualBillData.bookingId || '',
    reservationId: manualBillData.reservationId || manualBillData.bookingId || '',
    grcNumber: manualBillData.grcNumber || '',
    paymentType: manualBillData.paymentType || 'Wallet',
    numberOfDays: manualBillData.numberOfDays || 1,
    lineItems,
    subtotal: totals.subtotal,
    roundingAmount: totals.roundingAmount,
    grossTotalBeforeRounding: totals.grossTotalBeforeRounding,
    grossTotal: totals.grossTotal,
    advance: totalAdvance,
    balance: totals.balance,
    amountInWords: totals.amountInWords,
    discount: totals.totalDiscount,
    taxableAmount: totals.subtotal,
    cgst: manualBillData.isInterState ? 0 : roundToTwo(totals.totalGST / 2),
    sgst: manualBillData.isInterState ? 0 : roundToTwo(totals.totalGST / 2),
    igst: manualBillData.isInterState ? totals.totalGST : 0,
    totalGST: totals.totalGST,
    isInterState: !!manualBillData.isInterState,
    summary: manualBillData.summary || [{ accountName: 'TARIFF', amount: totals.subtotal }],
    advanceDetails,
    advanceReceiptDetails: advanceDetails,
    taxSummary,
    authorizedBy: manualBillData.authorizedBy || settings.authorizedByName || 'RELAX RESTO INN',
    verifiedBy: manualBillData.verifiedBy || settings.verifiedByName || 'FRONT DESK ADMIN',
    guestSignatureName: manualBillData.guestSignatureName || manualBillData.companyDetails || manualBillData.companyName || manualBillData.guestName || '',
    guestSignaturePlace: manualBillData.guestSignaturePlace || settings.placeOfSupply || 'VISAKHAPATNAM-530016',
    notes: manualBillData.notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  localFallbackStore.saveBill(fullBill);
  try {
    await setDoc(doc(db, BILLS_COLLECTION, billId), {
      ...fullBill,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    // Handled via local fallback
  }

  if (totalAdvance > 0) {
    await recordPayment({
      billId,
      billNo,
      guestName: fullBill.guestName,
      roomNumber: fullBill.roomNumber,
      amount: totalAdvance,
      paymentType: (fullBill.paymentType as any) || 'Wallet',
      referenceNumber: 'MANUAL-PAY',
      paymentDate: billDate,
      notes: `Manual entry payment for Bill ${billNo}`,
    }, userEmail);
  }

  await logActivity({
    action: 'MANUAL_BILL_CREATED',
    userEmail,
    entityType: 'bill',
    entityId: billId,
    description: `Manual / Old Tax Invoice ${billNo} added for ${fullBill.guestName} (Amount: ₹${totals.grossTotal})`,
  });

  return fullBill;
}


export async function getBills(maxLimit = 100): Promise<Bill[]> {
  try {
    const q = query(
      collection(db, BILLS_COLLECTION),
      orderBy('createdAt', 'desc'),
      limit(maxLimit)
    );
    const snap = await getDocs(q);
    const bills = snap.docs
      .map(d => ({ billId: d.id, ...d.data() } as Bill))
      .filter(b => !b.deleted);
    bills.forEach(b => localFallbackStore.saveBill(b));
    return bills;
  } catch (error) {
    try {
      const q = query(collection(db, BILLS_COLLECTION), limit(maxLimit));
      const snap = await getDocs(q);
      const bills = snap.docs
        .map(d => ({ billId: d.id, ...d.data() } as Bill))
        .filter(b => !b.deleted);
      bills.forEach(b => localFallbackStore.saveBill(b));
      return bills.sort((a, b) => (b.billDate || '').localeCompare(a.billDate || ''));
    } catch (e) {
      return localFallbackStore.getBills().filter(b => !b.deleted);
    }
  }
}

export async function searchBills(filterParam: string | { searchTerm?: string; status?: string; billType?: string; startDate?: string; endDate?: string }): Promise<Bill[]> {
  const all = await getBills(300);
  if (!filterParam) return all;

  if (typeof filterParam === 'string') {
    if (!filterParam.trim()) return all;
    const term = filterParam.toLowerCase().trim();
    return all.filter(b => 
      b.billNo.toLowerCase().includes(term) ||
      b.guestName.toLowerCase().includes(term) ||
      b.guestPhone.toLowerCase().includes(term) ||
      b.roomNumber.toLowerCase().includes(term) ||
      (b.companyGSTIN && b.companyGSTIN.toLowerCase().includes(term))
    );
  }

  const { searchTerm, status, billType, startDate, endDate } = filterParam;
  return all.filter(b => {
    if (status && b.status !== status) return false;
    if (billType && b.billType !== billType) return false;
    if (startDate && b.billDate < startDate) return false;
    if (endDate && b.billDate > endDate) return false;
    if (searchTerm && searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      const matches = 
        b.billNo.toLowerCase().includes(term) ||
        b.guestName.toLowerCase().includes(term) ||
        b.guestPhone.toLowerCase().includes(term) ||
        b.roomNumber.toLowerCase().includes(term) ||
        (b.companyGSTIN && b.companyGSTIN.toLowerCase().includes(term));
      if (!matches) return false;
    }
    return true;
  });
}

export async function getBillsByGuestName(guestName: string): Promise<Bill[]> {
  const all = await getBills(200);
  const term = guestName.toLowerCase().trim();
  return all.filter(b => b.guestName.toLowerCase().includes(term));
}

export async function getBillById(billId: string): Promise<Bill | null> {
  try {
    const snap = await getDoc(doc(db, BILLS_COLLECTION, billId));
    if (snap.exists()) {
      const data = { billId: snap.id, ...snap.data() } as Bill;
      localFallbackStore.saveBill(data);
      return data;
    }
  } catch (error) {
    // try fallback
  }
  return localFallbackStore.getBills().find(b => b.billId === billId) || null;
}

export async function voidBill(billId: string, voidReason: string, userEmail = 'admin'): Promise<void> {
  const localBill = localFallbackStore.getBills().find(b => b.billId === billId);
  if (localBill) {
    localFallbackStore.saveBill({ ...localBill, status: 'void', voidReason, updatedAt: new Date().toISOString() });
  }

  try {
    const billRef = doc(db, BILLS_COLLECTION, billId);
    await updateDoc(billRef, {
      status: 'void',
      voidReason,
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    // Handled locally
  }

  await logActivity({
    action: 'BILL_VOIDED',
    userEmail,
    entityType: 'bill',
    entityId: billId,
    description: `Bill ${billId} was marked as VOID: ${voidReason}`,
  });
}

export async function softDeleteBill(billId: string, userEmail = 'admin'): Promise<void> {
  const localBill = localFallbackStore.getBills().find(b => b.billId === billId);
  if (localBill) {
    localFallbackStore.saveBill({ ...localBill, deleted: true, deletedAt: new Date().toISOString() });
  }

  try {
    const billRef = doc(db, BILLS_COLLECTION, billId);
    await updateDoc(billRef, {
      deleted: true,
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    // Handled locally
  }

  await logActivity({
    action: 'BILL_DELETED',
    userEmail,
    entityType: 'bill',
    entityId: billId,
    description: `Bill ${billId} soft-deleted`,
  });
}

export async function deleteBill(billId: string, userEmail = 'admin'): Promise<void> {
  return softDeleteBill(billId, userEmail);
}

export async function updateBill(billId: string, updates: Partial<Bill>, userEmail = 'admin'): Promise<void> {
  const localBill = localFallbackStore.getBills().find(b => b.billId === billId);
  if (localBill) {
    localFallbackStore.saveBill({ ...localBill, ...updates, updatedAt: new Date().toISOString() });
  }

  try {
    const billRef = doc(db, BILLS_COLLECTION, billId);
    await updateDoc(billRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    // Handled locally
  }

  await logActivity({
    action: 'BILL_EDITED',
    userEmail,
    entityType: 'bill',
    entityId: billId,
    description: `Bill ${billId} was updated`,
  });
}
