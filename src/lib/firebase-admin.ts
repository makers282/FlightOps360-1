
import { initializeApp, getApps, App, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getAuth } from 'firebase-admin/auth';
import serviceAccountCredentials from '@/../serviceAccountKey.json';
import { FIREBASE_CONFIG } from './config';

let adminApp: App;
let adminDb: ReturnType<typeof getFirestore>;
let adminStorage: ReturnType<typeof getStorage>;
let adminAuth: ReturnType<typeof getAuth>;

if (getApps().length === 0) {
  try {
    console.log('[firebase-admin] Initializing Firebase Admin SDK...');
    const serviceAccount = serviceAccountCredentials as ServiceAccount;
    adminApp = initializeApp({
      credential: cert(serviceAccount),
      storageBucket: FIREBASE_CONFIG.storageBucket,
    });
    console.log('[firebase-admin] Firebase Admin SDK initialized successfully.');
  } catch (error) {
    console.error('[firebase-admin] CRITICAL: Error initializing Firebase Admin SDK:', error);
    // In a server environment, if the admin SDK fails, the app is not viable.
    // Throwing an error here will crash the server on startup, which is the desired
    // behavior as it immediately alerts us to a critical configuration problem.
    throw new Error('Firebase Admin SDK initialization failed.');
  }
} else {
  adminApp = getApps()[0];
  console.log('[firebase-admin] Firebase Admin SDK already initialized.');
}

adminDb = getFirestore(adminApp);
adminStorage = getStorage(adminApp);
adminAuth = getAuth(adminApp);

export { adminApp, adminDb, adminStorage, adminAuth };
