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
import { convertAmountToWords } from '../utils/numberToWords';
import { roundToTwo } from '../utils/currency';
import { calculateDaysBetween, getTodayDateString, getCurrentTimeString } from '../utils/date';

const BILLS_COLLECTION = 'bills';
const STAYS_COLLECTION = 'stays';

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
    userEmail = 'admin'
  } = params;

  const settings = await getHotelSettings();
  const billNo = await getNextInvoiceNumber();
  const billId = `BILL-${Date.now()}`;
  const billDate = actualCheckOutDate || getTodayDateString();
  const billTime = actualCheckOutTime || getCurrentTimeString();

  // Calculations
  const roomTariff = stay.roomTariff || 0;
  const roomValue = roundToTwo(roomTariff * numberOfDays);
  const totalValue = roundToTwo(roomValue + extraCharges);
  const taxableAmount = roundToTwo(Math.max(0, totalValue - discount));
  
  const gstRate = stay.gstRate !== undefined ? stay.gstRate : (settings.defaultGSTRate || 12);
  const totalGST = roundToTwo((taxableAmount * gstRate) / 100);
  
  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (stay.isInterState) {
    igst = totalGST;
  } else {
    cgst = roundToTwo(totalGST / 2);
    sgst = roundToTwo(totalGST - cgst);
  }

  const grossTotal = roundToTwo(taxableAmount + totalGST);
  const totalAdvance = roundToTwo(stay.advancePaid || 0);
  const totalPaidSoFar = roundToTwo(totalAdvance + (finalPaymentAmount || 0));
  const balance = roundToTwo(Math.max(0, grossTotal - totalPaidSoFar));

  const amountInWords = convertAmountToWords(grossTotal);

  // Line items
  const lineItems: BillLineItem[] = [
    {
      id: `li-1`,
      date: stay.checkInDate,
      description: `TARIFF (${stay.roomNumber}-${(stay.roomType || 'ROOM').toUpperCase()})`,
      hsn: settings.hsnCode || '996311',
      rate: roomTariff,
      days: numberOfDays,
      value: roomValue,
      discount: discount > 0 && extraCharges === 0 ? discount : 0,
      total: roundToTwo(roomValue - (discount > 0 && extraCharges === 0 ? discount : 0)),
      gst: roundToTwo(((roomValue - (discount > 0 && extraCharges === 0 ? discount : 0)) * gstRate) / 100),
      netTotal: roundToTwo(roomValue + ((roomValue * gstRate) / 100)),
    }
  ];

  if (extraCharges > 0) {
    const extraGST = roundToTwo((extraCharges * gstRate) / 100);
    lineItems.push({
      id: `li-extra`,
      date: billDate,
      description: 'ADDITIONAL SERVICES / ROOM EXTRAS',
      hsn: settings.hsnCode || '996311',
      rate: extraCharges,
      days: 1,
      value: extraCharges,
      discount: discount > 0 ? discount : 0,
      total: roundToTwo(extraCharges - discount),
      gst: extraGST,
      netTotal: roundToTwo(extraCharges + extraGST),
    });
  }

  // Summary
  const summary: BillSummaryItem[] = [
    { accountName: 'TARIFF', amount: roomValue }
  ];
  if (extraCharges > 0) {
    summary.push({ accountName: 'EXTRAS', amount: extraCharges });
  }

  // Advance Receipts
  const advanceDetails: AdvanceReceiptItem[] = [];
  if (totalAdvance > 0) {
    advanceDetails.push({
      date: stay.checkInDate,
      desc: `ADVANCE (${stay.paymentType})`,
      refNo: stay.bookingId || stay.grcNumber || 'ADV-01',
      room: stay.roomNumber,
      amount: totalAdvance,
    });
  }
  if (finalPaymentAmount > 0) {
    advanceDetails.push({
      date: billDate,
      desc: `CHECKOUT PAYMENT (${finalPaymentType})`,
      refNo: finalPaymentRef || 'FINAL-01',
      room: stay.roomNumber,
      amount: finalPaymentAmount,
    });
  }

  // Tax Summary
  const taxSummary: TaxSummaryItem[] = [];
  if (stay.isInterState) {
    taxSummary.push({
      taxName: `IGST (${gstRate.toFixed(2)}%)`,
      taxableAmount,
      taxAmount: igst,
    });
  } else {
    taxSummary.push({
      taxName: `CGST (${(gstRate / 2).toFixed(2)}%)`,
      taxableAmount,
      taxAmount: cgst,
    });
    taxSummary.push({
      taxName: `SGST (${(gstRate / 2).toFixed(2)}%)`,
      taxableAmount,
      taxAmount: sgst,
    });
  }

  const paxText = `${stay.paxAdults || 1} Adult${(stay.paxAdults || 1) > 1 ? 's' : ''}${stay.paxChildren ? `, ${stay.paxChildren} Child` : ''}`;

  const bill: Bill = {
    billId,
    billNo,
    billDate,
    billTime,
    billType: 'stay',
    status: balance <= 0 ? 'paid' : 'partially_paid',
    stayId: stay.stayId,
    guestId: stay.guestId,
    guestName: stay.guestName,
    guestPhone: stay.guestPhone,
    guestAddress: stay.guestAddress || '',
    idCardNumber: stay.idNumber || '',
    idCardType: stay.idType || 'Aadhaar Card',
    pax: paxText,
    companyDetails: stay.companyName ? `${stay.companyName}${stay.companyAddress ? ', ' + stay.companyAddress : ''}` : '',
    companyGSTIN: stay.companyGSTIN || '',
    refOTA: stay.refOTA || '',
    refOTAGSTIN: stay.refOTAGSTIN || '',
    stateCode: settings.stateCode || '37',
    placeOfSupply: settings.placeOfSupply || 'ANDHRA PRADESH (37)',
    roomNumber: stay.roomNumber,
    roomDetails: `TARIFF (${stay.roomNumber}-${(stay.roomType || 'ROOM').toUpperCase()})`,
    roomType: stay.roomType,
    planType: stay.planType,
    checkInDate: stay.checkInDate,
    checkInTime: stay.checkInTime || settings.defaultCheckInTime || '12:00',
    checkOutDate: actualCheckOutDate,
    checkOutTime: actualCheckOutTime || settings.defaultCheckOutTime || '11:00',
    bookingId: stay.bookingId || '',
    grcNumber: stay.grcNumber || '',
    paymentType: finalPaymentType || stay.paymentType,
    numberOfDays,
    lineItems,
    subtotal: totalValue,
    discount,
    taxableAmount,
    cgst,
    sgst,
    igst,
    totalGST,
    grossTotal,
    advance: totalPaidSoFar,
    balance,
    amountInWords,
    summary,
    advanceDetails,
    taxSummary,
    authorizedBy: settings.authorizedByName || settings.hotelName,
    verifiedBy: settings.verifiedByName || 'FRONT DESK ADMIN',
    guestSignatureName: stay.guestName,
    guestSignaturePlace: 'VISAKHAPATNAM',
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
    subtotal: totalValue,
    taxableAmount,
    cgst,
    sgst,
    igst,
    totalGST,
    grossTotal,
    balanceDue: balance,
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
    totalSpent: grossTotal,
    lastStayDate: billDate,
  });

  // 6. Audit Log
  await logActivity({
    action: 'CHECKOUT_COMPLETED',
    userEmail,
    entityType: 'stay',
    entityId: stay.stayId,
    description: `Checkout completed for ${stay.guestName} (Room ${stay.roomNumber}). Invoice generated: ${billNo} (Gross: ₹${grossTotal})`,
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
  const grossTotal = roundToTwo(manualBillData.grossTotal || 0);
  const advance = roundToTwo(manualBillData.advance || 0);
  const balance = roundToTwo(manualBillData.balance !== undefined ? manualBillData.balance : (grossTotal - advance));
  const amountInWords = manualBillData.amountInWords || convertAmountToWords(grossTotal);

  // Save guest profile if guestName and phone exist
  let savedGuestId = manualBillData.guestId;
  if (manualBillData.guestName) {
    const saved = await saveOrUpdateGuest({
      guestName: manualBillData.guestName,
      phone: manualBillData.guestPhone || '',
      address: manualBillData.guestAddress || '',
      idNumber: manualBillData.idCardNumber || '',
      idType: (manualBillData.idCardType as any) || 'Aadhaar Card',
      companyName: manualBillData.companyDetails || '',
      companyGSTIN: manualBillData.companyGSTIN || '',
      totalStays: 1,
      totalSpent: grossTotal,
    });
    savedGuestId = saved.guestId;
  }

  const fullBill: Bill = {
    billId,
    billNo,
    billDate,
    billTime: manualBillData.billTime || getCurrentTimeString(),
    billType: 'manual',
    status: balance <= 0 ? 'paid' : (advance > 0 ? 'partially_paid' : 'pending'),
    guestId: savedGuestId,
    guestName: manualBillData.guestName || 'Guest',
    guestPhone: manualBillData.guestPhone || '',
    guestAddress: manualBillData.guestAddress || '',
    idCardNumber: manualBillData.idCardNumber || '',
    idCardType: manualBillData.idCardType || 'Aadhaar Card',
    pax: manualBillData.pax || '1 Adult',
    companyDetails: manualBillData.companyDetails || '',
    companyGSTIN: manualBillData.companyGSTIN || '',
    refOTA: manualBillData.refOTA || '',
    refOTAGSTIN: manualBillData.refOTAGSTIN || '',
    stateCode: manualBillData.stateCode || settings.stateCode || '37',
    placeOfSupply: manualBillData.placeOfSupply || settings.placeOfSupply || 'ANDHRA PRADESH (37)',
    roomNumber: manualBillData.roomNumber || '101',
    roomDetails: manualBillData.roomDetails || `TARIFF (${manualBillData.roomNumber || '101'}-${(manualBillData.roomType || 'ROOM').toUpperCase()})`,
    roomType: manualBillData.roomType || 'Deluxe Room',
    planType: manualBillData.planType || 'EP',
    checkInDate: manualBillData.checkInDate || billDate,
    checkInTime: manualBillData.checkInTime || settings.defaultCheckInTime || '12:00',
    checkOutDate: manualBillData.checkOutDate || billDate,
    checkOutTime: manualBillData.checkOutTime || settings.defaultCheckOutTime || '11:00',
    bookingId: manualBillData.bookingId || '',
    grcNumber: manualBillData.grcNumber || '',
    paymentType: manualBillData.paymentType || 'Cash',
    numberOfDays: manualBillData.numberOfDays || 1,
    lineItems: manualBillData.lineItems || [],
    subtotal: manualBillData.subtotal || grossTotal,
    discount: manualBillData.discount || 0,
    taxableAmount: manualBillData.taxableAmount || grossTotal,
    cgst: manualBillData.cgst || 0,
    sgst: manualBillData.sgst || 0,
    igst: manualBillData.igst || 0,
    totalGST: manualBillData.totalGST || 0,
    grossTotal,
    advance,
    balance,
    amountInWords,
    summary: manualBillData.summary || [{ accountName: 'TARIFF', amount: manualBillData.subtotal || grossTotal }],
    advanceDetails: manualBillData.advanceDetails || (advance > 0 ? [{ date: billDate, desc: `ADVANCE (${manualBillData.paymentType || 'Cash'})`, refNo: 'MANUAL-01', room: manualBillData.roomNumber || '', amount: advance }] : []),
    taxSummary: manualBillData.taxSummary || [],
    authorizedBy: manualBillData.authorizedBy || settings.authorizedByName || settings.hotelName,
    verifiedBy: manualBillData.verifiedBy || settings.verifiedByName || 'FRONT DESK ADMIN',
    guestSignatureName: manualBillData.guestSignatureName || manualBillData.guestName || '',
    guestSignaturePlace: manualBillData.guestSignaturePlace || 'VISAKHAPATNAM',
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

  if (advance > 0) {
    await recordPayment({
      billId,
      billNo,
      guestName: fullBill.guestName,
      roomNumber: fullBill.roomNumber,
      amount: advance,
      paymentType: (fullBill.paymentType as any) || 'Cash',
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
    description: `Manual / Old Tax Invoice ${billNo} added for ${fullBill.guestName} (Amount: ₹${grossTotal})`,
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
