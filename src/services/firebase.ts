import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  getFirestore 
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCTXZccoiGtXFIkCYkQCai1EF15CJgpMXw",
  authDomain: "relaxrestoinn-710d2.firebaseapp.com",
  projectId: "relaxrestoinn-710d2",
  storageBucket: "relaxrestoinn-710d2.firebasestorage.app",
  messagingSenderId: "1036261337162",
  appId: "1:1036261337162:web:aa05472de13301fab6deb3",
  measurementId: "G-F4JE1YR238"
};

// Initialize Firebase App singleton
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Auth with browserLocalPersistence to preserve session across reloads
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn("Firebase Auth persistence error:", err);
});

// Firestore with offline cache enabled
let firestoreDb;
try {
  firestoreDb = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (e) {
  // Fallback to standard firestore if already initialized
  firestoreDb = getFirestore(app);
}

export const db = firestoreDb;
export const storage = getStorage(app);
