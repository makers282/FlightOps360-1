// src/lib/firebase-admin.ts
import { initializeApp, getApps, App, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
// Correct the path to serviceAccountKey.json at the project root
// The '..' goes up from 'lib', then up from 'src' to the project root.
import serviceAccountCredentials from '../../serviceAccountKey.json';
import { FIREBASE_CONFIG } from './config';

let adminApp: App;

if (getApps().length === 0) {
  try {
    // Cast the imported JSON to the ServiceAccount type
    const serviceAccount = serviceAccountCredentials as ServiceAccount;

    adminApp = initializeApp({
      credential: cert(serviceAccount),
      storageBucket: FIREBASE_CONFIG.storageBucket,
    });
    console.log('[firebase-admin] Firebase Admin SDK initialized successfully.');
  } catch (error) {
    console.error('[firebase-admin] Error initializing Firebase Admin SDK:', error);
    // Depending on how critical admin access is at startup, you might re-throw the error
    // or allow the app to start with admin features potentially failing later.
    // For now, we log and let it proceed, flows using admin will fail if not initialized.
  }
} else {
  adminApp = getApps()[0];
  console.log('[firebase-admin] Firebase Admin SDK already initialized.');
}

// Ensure adminDb and adminStorage are exported correctly, even if initialization failed,
// so that runtime checks in flows can determine if they are usable.
// @ts-ignore adminApp might be uninitialized
const adminDb = adminApp ? getFirestore(adminApp) : null;
// @ts-ignore adminApp might be uninitialized
const adminStorage = adminApp ? getStorage(adminApp) : null;

export { adminApp, adminDb, adminStorage };
