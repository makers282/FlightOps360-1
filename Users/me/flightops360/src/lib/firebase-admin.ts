// src/lib/firebase-admin.ts
import { initializeApp, getApps, App, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import serviceAccountCredentials from '../../serviceAccountKey.json';

let adminApp: App;
let adminDb: ReturnType<typeof getFirestore> | null = null;
let adminStorage: ReturnType<typeof getStorage> | null = null;

const serviceAccount = serviceAccountCredentials as ServiceAccount;

if (!serviceAccount?.project_id) {
  console.error('[firebase-admin] CRITICAL ERROR: Service account credentials appear to be missing or malformed (missing project_id). Path: ../../serviceAccountKey.json. Admin features will not work.');
} else if (getApps().length === 0) {
  try {
    adminApp = initializeApp({
      credential: cert(serviceAccount),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, // Ensure this env var is set if using Admin Storage
    });
    console.log(`[firebase-admin] Firebase Admin SDK initialized successfully for project: ${serviceAccount.project_id}.`);
    adminDb = getFirestore(adminApp);
    if (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) {
      adminStorage = getStorage(adminApp);
    } else {
      console.warn('[firebase-admin] NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is not set. Firebase Admin Storage will not be initialized.');
    }
  } catch (error: any) {
    console.error(`[firebase-admin] CRITICAL ERROR initializing Firebase Admin SDK for project ${serviceAccount.project_id}:`, error.message);
  }
} else {
  adminApp = getApps()[0];
  console.log(`[firebase-admin] Firebase Admin SDK already initialized for project: ${adminApp.options?.projectId || 'unknown'}.`);
  // Ensure db and storage are assigned if app already exists
  if (adminApp) {
    adminDb = getFirestore(adminApp);
    if (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) {
      adminStorage = getStorage(adminApp);
    }
  }
}

export { adminApp, adminDb, adminStorage };
