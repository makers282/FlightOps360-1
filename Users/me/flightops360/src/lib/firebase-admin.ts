// src/lib/firebase-admin.ts
import { initializeApp, getApps, App, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';
// Import the raw JSON. The 'cert' function will handle its structure.
import serviceAccountCredentialsJson from '../../serviceAccountKey.json';

let adminApp: App | undefined = undefined;
let adminDb: Firestore | null = null;
let adminStorage: Storage | null = null;

console.log('[firebase-admin] MODULE LOAD: Starting firebase-admin.ts execution.');

try {
  // Use the raw JSON for checking project_id before casting or passing to cert()
  const rawServiceAccount = serviceAccountCredentialsJson as any;

  if (!rawServiceAccount?.project_id) {
    console.error('[firebase-admin] INIT ERROR: Service account JSON (serviceAccountKey.json) is missing or malformed (missing project_id property). Cannot initialize Admin SDK.');
  } else {
    // Cast to ServiceAccount type for passing to cert()
    const serviceAccount = serviceAccountCredentialsJson as ServiceAccount;

    if (getApps().length === 0) {
      console.log(`[firebase-admin] INIT ATTEMPT: No existing admin apps. Initializing new one for project: ${rawServiceAccount.project_id}.`);
      // Log the projectId that the typed ServiceAccount object *would* have, for TS conformity.
      // The cert() function will correctly process the underlying snake_case from the JSON.
      if (serviceAccount.projectId && serviceAccount.projectId !== 'skybase-nguee') {
         console.warn(`[firebase-admin] WARNING: ServiceAccount type's 'projectId' ('${serviceAccount.projectId}') does NOT match expected 'skybase-nguee' from raw JSON's 'project_id' ('${rawServiceAccount.project_id}'). This is usually fine as cert() handles the JSON.`);
      } else if (rawServiceAccount.project_id !== 'skybase-nguee') {
         console.warn(`[firebase-admin] WARNING: Raw JSON project_id ('${rawServiceAccount.project_id}') does NOT match expected 'skybase-nguee'. This is likely the issue if initialization fails related to project ID.`);
      }

      try {
        adminApp = initializeApp({
          credential: cert(serviceAccount), // Pass the typed serviceAccount here
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        });
        console.log(`[firebase-admin] INIT SUCCESS: Firebase Admin SDK initialized for project: ${adminApp.options?.projectId}.`);
      } catch (initError: any) {
        console.error(`[firebase-admin] INIT FAILURE: CRITICAL ERROR initializing Firebase Admin SDK for project ${rawServiceAccount.project_id}. Error: ${initError.message}`, initError);
      }
    } else {
      adminApp = getApps().find(app => app.name === '[DEFAULT]') || getApps()[0];
      if (adminApp) {
        console.log(`[firebase-admin] INIT INFO: Using existing Firebase Admin SDK instance. App Name: ${adminApp.name}, Project: ${adminApp.options?.projectId || 'unknown'}.`);
      } else {
        console.error('[firebase-admin] INIT ERROR: Could not retrieve an existing admin app instance despite getApps() having length > 0.');
      }
    }

    if (adminApp) {
      try {
        adminDb = getFirestore(adminApp);
        console.log('[firebase-admin] Firestore Admin Instance: Successfully obtained.');
        if (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) {
          adminStorage = getStorage(adminApp);
          console.log(`[firebase-admin] Storage Admin Instance: Successfully obtained for bucket: ${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}.`);
        } else {
          console.warn('[firebase-admin] Storage Admin Instance: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET not set. Storage will not be initialized.');
        }
      } catch (serviceError: any) {
        console.error(`[firebase-admin] SERVICE INIT ERROR: Error getting Firestore/Storage service from adminApp. Error: ${serviceError.message}`, serviceError);
        adminDb = null;
        adminStorage = null;
      }
    } else {
      console.error('[firebase-admin] POST-INIT ERROR: adminApp is undefined. Cannot get Firestore/Storage services.');
    }
  }
} catch (e: any) {
    console.error('[firebase-admin] TOP-LEVEL ERROR: Error during firebase-admin.ts execution (likely serviceAccountKey.json import issue or malformed JSON):', e.message, e);
}

if (!adminDb) {
  console.error('[firebase-admin] FINAL STATUS: adminDb IS NULL. Firestore operations using the Admin SDK will fail.');
} else {
  console.log('[firebase-admin] FINAL STATUS: adminDb IS INITIALIZED and ready.');
}

export { adminApp, adminDb, adminStorage };

    