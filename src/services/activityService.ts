import { collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { ActivityLog } from '../types';
import { localFallbackStore } from './localFallbackStore';

const ACTIVITY_COLLECTION = 'activity_logs';

export async function logActivity(data: {
  action: ActivityLog['action'];
  userEmail?: string;
  userUid?: string;
  entityType: ActivityLog['entityType'];
  entityId: string;
  description: string;
}): Promise<void> {
  const logItem: ActivityLog = {
    logId: `log-${Date.now()}`,
    action: data.action,
    userEmail: data.userEmail || 'admin',
    userUid: data.userUid || '',
    entityType: data.entityType,
    entityId: data.entityId,
    description: data.description,
    timestamp: new Date().toISOString(),
  };

  localFallbackStore.saveActivity(logItem);

  try {
    await addDoc(collection(db, ACTIVITY_COLLECTION), {
      ...data,
      userEmail: data.userEmail || 'admin',
      timestamp: serverTimestamp()
    });
  } catch (error) {
    // Handled locally
  }
}

export async function getRecentActivities(maxCount = 15): Promise<ActivityLog[]> {
  try {
    const q = query(
      collection(db, ACTIVITY_COLLECTION),
      orderBy('timestamp', 'desc'),
      limit(maxCount)
    );
    const snapshot = await getDocs(q);
    const activities = snapshot.docs.map(doc => ({
      logId: doc.id,
      ...doc.data()
    })) as ActivityLog[];
    activities.forEach(a => localFallbackStore.saveActivity(a));
    return activities;
  } catch (error) {
    return localFallbackStore.getActivities().slice(0, maxCount);
  }
}
