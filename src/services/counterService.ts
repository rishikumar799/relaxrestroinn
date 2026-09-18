import { doc, runTransaction, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { getHotelSettings } from './settingsService';
import { localFallbackStore } from './localFallbackStore';

const COUNTER_DOC_REF = doc(db, 'counters', 'invoices');

export async function getNextInvoiceNumber(): Promise<string> {
  const settings = await getHotelSettings();
  const prefix = settings.invoicePrefix || 'RRI';
  const suffix = settings.invoiceSuffix ? `${settings.invoiceSuffix}` : '24-25';
  const startSeq = settings.invoiceStartSequence || 101;

  try {
    const nextSeq = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(COUNTER_DOC_REF);
      let currentSeq: number;

      if (!counterDoc.exists()) {
        currentSeq = startSeq;
        transaction.set(COUNTER_DOC_REF, {
          currentSequence: currentSeq,
          updatedAt: new Date().toISOString()
        });
        return currentSeq;
      } else {
        const data = counterDoc.data();
        currentSeq = (data.currentSequence || startSeq) + 1;
        transaction.update(COUNTER_DOC_REF, {
          currentSequence: currentSeq,
          updatedAt: new Date().toISOString()
        });
        return currentSeq;
      }
    });

    const paddedSeq = String(nextSeq).padStart(4, '0');
    return `${prefix}-${paddedSeq}${suffix ? `-${suffix}` : ''}`;
  } catch (error) {
    try {
      const snap = await getDoc(COUNTER_DOC_REF);
      let seq = startSeq;
      if (snap.exists()) {
        seq = (snap.data().currentSequence || startSeq) + 1;
      }
      await setDoc(COUNTER_DOC_REF, { currentSequence: seq, updatedAt: new Date().toISOString() }, { merge: true });
      const paddedSeq = String(seq).padStart(4, '0');
      return `${prefix}-${paddedSeq}${suffix ? `-${suffix}` : ''}`;
    } catch (e) {
      // Permission or offline fallback
      return localFallbackStore.getNextInvoiceNumber(prefix, startSeq, suffix);
    }
  }
}
