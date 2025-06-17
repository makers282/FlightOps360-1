
// src/lib/firebase-admin.ts
import { initializeApp, getApps, App, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
// Correct the path to serviceAccountKey.json at the project root
import serviceAccountCredentials from '../../serviceAccountKey.json';

let adminApp: App | undefined = undefined;
let adminDb: ReturnType<typeof getFirestore> | null = null;
let adminStorage: ReturnType<typeof getStorage> | null = null;

const storageBucketFromEnv = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

console.log('[firebase-admin] Attempting to initialize Firebase Admin SDK...');
if (!storageBucketFromEnv) {
  console.error('[firebase-admin] CRITICAL ERROR: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET environment variable is not set. Admin Storage will not be available.');
}

if (getApps().length === 0) {
  try {
    const serviceAccount = serviceAccountCredentials as ServiceAccount;
    if (!serviceAccount || !serviceAccount.project_id) {
      console.error('[firebase-admin] CRITICAL ERROR: Service account credentials appear to be missing or malformed (missing project_id). Path: ../../serviceAccountKey.json');
      throw new Error('Malformed service account credentials.');
    }
    console.log(`[firebase-admin] Initializing with service account for project: ${serviceAccount.project_id}. Storage Bucket from env: ${storageBucketFromEnv}`);
    
    adminApp = initializeApp({
      credential: cert(serviceAccount),
      storageBucket: storageBucketFromEnv, // Use the env variable
    });
    
    console.log(`[firebase-admin] Firebase Admin SDK initialized successfully. AdminApp Project ID: ${adminApp.options.projectId}`);
  } catch (error: any) {
    console.error('[firebase-admin] CRITICAL ERROR initializing Firebase Admin SDK:', error.message, error.stack);
    // adminApp remains undefined
  }
} else {
  adminApp = getApps()[0];
  if (adminApp) {
    console.log(`[firebase-admin] Firebase Admin SDK already initialized. AdminApp Project ID: ${adminApp.options.projectId}`);
  } else {
    console.error('[firebase-admin] CRITICAL ERROR: getApps() returned an array, but the first element was undefined.');
  }
}

if (adminApp) {
  try {
    adminDb = getFirestore(adminApp);
    console.log('[firebase-admin] Firestore Admin instance obtained.');
  } catch (e: any) {
    console.error('[firebase-admin] Error obtaining Firestore Admin instance:', e.message);
    adminDb = null;
  }
  if (storageBucketFromEnv) { // Only try to get storage if bucket is configured
    try {
      adminStorage = getStorage(adminApp);
      console.log('[firebase-admin] Storage Admin instance obtained.');
    } catch (e: any) {
      console.error('[firebase-admin] Error obtaining Storage Admin instance:', e.message);
      adminStorage = null;
    }
  } else {
    console.warn('[firebase-admin] Storage Admin instance not initialized because storage bucket ENV var is missing.');
    adminStorage = null;
  }
} else {
  console.error('[firebase-admin] Firebase Admin App is not available. Firestore and Storage Admin instances will be null.');
}

export { adminApp, adminDb, adminStorage };
