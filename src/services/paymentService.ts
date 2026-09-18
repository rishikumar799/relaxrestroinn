import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  query, 
  where, 
  limit, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import { Payment, PaymentMethod } from '../types';
import { logActivity } from './activityService';
import { localFallbackStore } from './localFallbackStore';

const PAYMENTS_COLLECTION = 'payments';

export async function recordPayment(paymentData: Omit<Payment, 'paymentId' | 'createdAt'>, userEmail = 'admin'): Promise<Payment> {
  const paymentId = `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const fullPayment: Payment = {
    ...paymentData,
    paymentId,
    createdAt: new Date().toISOString(),
  };

  localFallbackStore.savePayment(fullPayment);

  try {
    const paymentRef = doc(db, PAYMENTS_COLLECTION, paymentId);
    await setDoc(paymentRef, {
      ...fullPayment,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    // Handled locally
  }

  await logActivity({
    action: 'PAYMENT_ADDED',
    userEmail,
    entityType: 'payment',
    entityId: paymentId,
    description: `Payment of ₹${paymentData.amount.toFixed(2)} received via ${paymentData.paymentType || paymentData.paymentMethod} for Bill ${paymentData.billNo || paymentData.billId}`,
  });

  return fullPayment;
}

export async function addPaymentToBill(params: {
  billId: string;
  billNo: string;
  guestName: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentType?: string;
  referenceNumber?: string;
  notes?: string;
}, userEmail = 'admin'): Promise<Payment> {
  const payment = await recordPayment({
    billId: params.billId,
    billNo: params.billNo,
    guestName: params.guestName,
    amount: params.amount,
    paymentType: params.paymentMethod,
    paymentMethod: params.paymentMethod,
    referenceNumber: params.referenceNumber || '',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: params.notes || `Settlement payment for Bill ${params.billNo}`,
  }, userEmail);

  return payment;
}

export async function getPaymentsByBill(billId: string): Promise<Payment[]> {
  try {
    const q = query(
      collection(db, PAYMENTS_COLLECTION),
      where('billId', '==', billId)
    );
    const snap = await getDocs(q);
    const payments = snap.docs.map(d => ({ paymentId: d.id, ...d.data() })) as Payment[];
    payments.forEach(p => localFallbackStore.savePayment(p));
    return payments;
  } catch (error) {
    return localFallbackStore.getPayments().filter(p => p.billId === billId);
  }
}

export async function getPaymentsByStay(stayId: string): Promise<Payment[]> {
  try {
    const q = query(
      collection(db, PAYMENTS_COLLECTION),
      where('stayId', '==', stayId)
    );
    const snap = await getDocs(q);
    const payments = snap.docs.map(d => ({ paymentId: d.id, ...d.data() })) as Payment[];
    payments.forEach(p => localFallbackStore.savePayment(p));
    return payments;
  } catch (error) {
    return localFallbackStore.getPayments().filter(p => p.stayId === stayId);
  }
}

export async function getAllPayments(maxLimit = 100): Promise<Payment[]> {
  try {
    const q = query(collection(db, PAYMENTS_COLLECTION), limit(maxLimit));
    const snap = await getDocs(q);
    const payments = snap.docs.map(d => ({ paymentId: d.id, ...d.data() })) as Payment[];
    payments.forEach(p => localFallbackStore.savePayment(p));
    return payments.sort((a, b) => (b.paymentDate || '').localeCompare(a.paymentDate || ''));
  } catch (error) {
    return localFallbackStore.getPayments();
  }
}
