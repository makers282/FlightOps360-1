
// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

// Your web app's Firebase configuration
// IMPORTANT: These should be set in your .env.local file
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// When running in development, we use a dummy project ID for emulators.
// Other config (apiKey, authDomain) is still needed for the SDK to initialize.
const effectiveProjectId = process.env.NODE_ENV === 'development' ? 'dev-project' : firebaseConfig.projectId;

const requiredEnvVars: (keyof typeof firebaseConfig)[] = [
  'apiKey',
  'authDomain',
  // projectId is handled by effectiveProjectId, but the base one is needed if not in dev
  'storageBucket',
  'messagingSenderId',
  'appId',
];

let missingVarsMessage = "";
const missingVars = requiredEnvVars.filter(key => !firebaseConfig[key]);
if (!firebaseConfig.projectId && process.env.NODE_ENV !== 'development') {
  missingVars.push('projectId');
}

if (missingVars.length > 0) {
  const envVarNames = missingVars.map(key => `NEXT_PUBLIC_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`);
  missingVarsMessage = `Firebase configuration is incomplete. 
Missing required environment variables: ${envVarNames.join(', ')}.
Please create a .env.local file in the root of your project and add your Firebase project's web app configuration.
You can find these values in your Firebase project settings:
Project settings > General > Your apps > Firebase SDK snippet > Config.

Example .env.local content:
NEXT_PUBLIC_FIREBASE_API_KEY="YOUR_API_KEY"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="YOUR_AUTH_DOMAIN"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="YOUR_PROJECT_ID"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="YOUR_STORAGE_BUCKET"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="YOUR_MESSAGING_SENDER_ID"
NEXT_PUBLIC_FIREBASE_APP_ID="YOUR_APP_ID"
`;
  console.error("[Firebase Client Init ERROR]", missingVarsMessage);
  // This error will stop the app from loading further if critical configs are missing.
  // For client-side, this might still allow the page to render and then fail at Firebase interaction.
}

// Initialize Firebase
let app;
if (!getApps().length) {
  if (missingVars.length > 0 && typeof window !== 'undefined') {
    // If on client-side and vars are missing, don't attempt to initialize, let user see the error
    // This is mostly a safety net; the error thrown later should prevent most execution.
    console.error("[Firebase Client Init] Halting Firebase initialization due to missing env vars.");
  } else if (missingVars.length > 0 && typeof window === 'undefined') {
    // Server-side, throw immediately
    throw new Error(missingVarsMessage);
  } else {
    console.log("[Firebase Client Init] Initializing Firebase app with config:", { ...firebaseConfig, projectId: effectiveProjectId });
    app = initializeApp({ ...firebaseConfig, projectId: effectiveProjectId });
  }
} else {
  app = getApp();
  console.log("[Firebase Client Init] Using existing Firebase app.");
}

let db, auth, storage;

if (app) {
  db = getFirestore(app);
  auth = getAuth(app);
  storage = getStorage(app);

  if (process.env.NODE_ENV === 'development') {
      console.log("[Firebase Client Init] Development mode detected. Attempting to connect to Firebase emulators...");
      console.log("[Firebase Client Init] Emulator hosts: Auth (127.0.0.1:9099), Firestore (127.0.0.1:8080), Storage (127.0.0.1:9199)");
      try {
          // Ensure db, auth, storage are defined before connecting emulators
          connectFirestoreEmulator(db, '127.0.0.1', 8080);
          console.log("[Firebase Client Init] Firestore emulator connection attempt queued.");
          connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
          console.log("[Firebase Client Init] Auth emulator connection attempt queued.");
          connectStorageEmulator(storage, '127.0.0.1', 9199);
          console.log("[Firebase Client Init] Storage emulator connection attempt queued.");
          console.log('[Firebase Client Init] Successfully queued connections to emulators. Verify emulator suite is running.');
      } catch (error: any) {
          // Check if the error is "already connected" and ignore it, otherwise log it.
          if (error.code === 'firestore/emulator-already-connected' || 
              error.message?.includes('Auth emulator is already connected') || 
              error.message?.includes('Storage emulator is already connected') ||
              error.message?.includes('already connected to the Firestore emulator') // More general check for firestore
              ) { 
              console.warn('[Firebase Client Init WARN] Emulator already connected (this is common during Fast Refresh).');
          } else {
              console.error('[Firebase Client Init ERROR] Error attempting to connect to Firebase emulators:', error);
          }
      }
  } else {
      console.log("[Firebase Client Init] Production mode detected. Connecting to live Firebase services.");
  }
} else if (missingVars.length > 0) {
  // If app initialization was skipped due to missing vars on client, these will be undefined.
  // We'll throw a more specific error or handle it gracefully in components using Firebase.
  console.error("[Firebase Client Init] Firebase app could not be initialized due to missing configuration. Firebase services (db, auth, storage) will be unavailable.");
  // To make components fail gracefully, they should check if db/auth/storage are defined.
  // For now, we let them be undefined.
}


export { db, app, auth, storage };
    