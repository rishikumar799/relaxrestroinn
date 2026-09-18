import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { doc, getDoc, setDoc, getDocs, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { logActivity } from './activityService';

export interface AdminUserRecord {
  uid: string;
  email: string;
  displayName?: string;
  role: string;
  createdAt?: string;
  lastLoginAt?: string;
  status: 'active' | 'suspended';
}

/**
 * Ensures the admin record is saved to the 'admins' and 'users' Firestore collections
 */
export async function syncAdminToFirestore(user: User): Promise<void> {
  try {
    const adminDocRef = doc(db, 'admins', user.uid);
    const userDocRef = doc(db, 'users', user.uid);
    
    const existingSnap = await getDoc(adminDocRef);
    const nowIso = new Date().toISOString();

    const adminData: Record<string, any> = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || user.email?.split('@')[0] || 'Administrator',
      role: 'admin',
      status: 'active',
      lastLoginAt: nowIso,
      updatedAt: serverTimestamp(),
    };

    if (!existingSnap.exists()) {
      adminData.createdAt = nowIso;
    }

    await Promise.all([
      setDoc(adminDocRef, adminData, { merge: true }),
      setDoc(userDocRef, adminData, { merge: true }),
    ]);
  } catch (error) {
    // Firestore permission or offline
  }
}

export async function loginAdmin(email: string, pass: string): Promise<User> {
  const cleanEmail = email.trim();
  try {
    const credential = await signInWithEmailAndPassword(auth, cleanEmail, pass);
    await syncAdminToFirestore(credential.user);
    await logActivity({
      action: 'LOGIN',
      userEmail: credential.user.email || cleanEmail,
      userUid: credential.user.uid,
      entityType: 'auth',
      entityId: credential.user.uid,
      description: `Admin logged in successfully (${cleanEmail})`
    });
    return credential.user;
  } catch (error: any) {
    let message = 'Failed to sign in. Please verify your admin credentials.';
    if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
      message = 'Invalid email address or password.';
    } else if (error.code === 'auth/too-many-requests') {
      message = 'Access temporarily blocked due to multiple failed attempts. Please try again later.';
    } else if (error.code === 'auth/network-request-failed') {
      message = 'Network connection failed. Please check your internet connection.';
    } else if (error.message) {
      message = error.message;
    }
    throw new Error(message);
  }
}

export async function getAdminUsers(): Promise<AdminUserRecord[]> {
  try {
    const snap = await getDocs(collection(db, 'admins'));
    if (!snap.empty) {
      return snap.docs.map(d => ({ uid: d.id, ...d.data() } as AdminUserRecord));
    }
  } catch (error) {
    // ignore
  }

  const currentUser = auth.currentUser;
  if (currentUser) {
    return [{
      uid: currentUser.uid,
      email: currentUser.email || 'Admin',
      role: 'admin',
      status: 'active',
      lastLoginAt: new Date().toISOString()
    }];
  }
  return [];
}

export async function logoutAdmin(): Promise<void> {
  const currentEmail = auth.currentUser?.email || 'admin';
  const currentUid = auth.currentUser?.uid || '';
  try {
    await logActivity({
      action: 'LOGIN',
      userEmail: currentEmail,
      userUid: currentUid,
      entityType: 'auth',
      entityId: currentUid,
      description: `Admin logged out (${currentEmail})`
    });
  } catch (e) {
    // ignore
  }
  await signOut(auth);
}

export function subscribeAuthState(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser(): User | null {
  return auth.currentUser;
}
