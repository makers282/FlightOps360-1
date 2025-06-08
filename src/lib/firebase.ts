
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
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // Added measurementId
};

const nodeEnv = process.env.NODE_ENV;
console.log(`[Firebase Client Init] Detected NODE_ENV: ${nodeEnv}`);

// When running in development, we use a dummy project ID for emulators.
// Other config (apiKey, authDomain) is still needed for the SDK to initialize.
const effectiveProjectId = nodeEnv === 'development' ? 'dev-project' : firebaseConfig.projectId;

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

// If not in development mode, projectId from env is also strictly required.
if (nodeEnv !== 'development' && !firebaseConfig.projectId) {
  if (!missingVars.includes('projectId')) { // Avoid duplicate message
    missingVars.push('projectId');
  }
}

if (missingVars.length > 0) {
  const envVarNames = missingVars.map(key => `NEXT_PUBLIC_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`);
  missingVarsMessage = `Firebase configuration is incomplete. 
Missing required environment variables: ${envVarNames.join(', ')}.
Please create a .env file (or .env.local) in the root of your project and add your Firebase project's web app configuration.
You can find these values in your Firebase project settings:
Project settings > General > Your apps > Firebase SDK snippet > Config.

Example .env or .env.local content:
NEXT_PUBLIC_FIREBASE_API_KEY="YOUR_API_KEY"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="YOUR_AUTH_DOMAIN"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="YOUR_PROJECT_ID"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="YOUR_STORAGE_BUCKET"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="YOUR_MESSAGING_SENDER_ID"
NEXT_PUBLIC_FIREBASE_APP_ID="YOUR_APP_ID"
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="YOUR_MEASUREMENT_ID" # Optional
`;
  console.error("[Firebase Client Init ERROR]", missingVarsMessage);
}

// Initialize Firebase
let app;
if (!getApps().length) {
  if (missingVars.length > 0 && typeof window !== 'undefined') {
    console.error("[Firebase Client Init] Halting Firebase initialization due to missing env vars. App will likely not function correctly.");
    // Not throwing here to allow page to render with error message, but Firebase services will be unusable.
  } else if (missingVars.length > 0 && typeof window === 'undefined') {
    throw new Error(missingVarsMessage); // Fail fast on server-side if critical vars missing
  } else {
    console.log("[Firebase Client Init] Initializing Firebase app with effective config:", { ...firebaseConfig, projectId: effectiveProjectId });
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

  if (nodeEnv === 'development') {
      console.log("[Firebase Client Init] Development mode detected. Attempting to connect to Firebase emulators...");
      console.log("[Firebase Client Init] Target Project ID for emulators: dev-project");
      console.log("[Firebase Client Init] Emulator hosts: Auth (127.0.0.1:9099), Firestore (127.0.0.1:8080), Storage (127.0.0.1:9199)");
      try {
          connectFirestoreEmulator(db, '127.0.0.1', 8080);
          console.log("[Firebase Client Init] Firestore emulator connection attempt queued.");
      } catch (e: any) {
          if (e.message?.includes('already connected')) console.warn('[Firebase Client Init WARN] Firestore emulator already connected.');
          else console.error('[Firebase Client Init ERROR] Connecting to Firestore emulator:', e);
      }
      try {
          connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
          console.log("[Firebase Client Init] Auth emulator connection attempt queued.");
      } catch (e: any) {
          if (e.message?.includes('already connected')) console.warn('[Firebase Client Init WARN] Auth emulator already connected.');
          else console.error('[Firebase Client Init ERROR] Connecting to Auth emulator:', e);
      }
      try {
          connectStorageEmulator(storage, '127.0.0.1', 9199);
          console.log("[Firebase Client Init] Storage emulator connection attempt queued.");
      } catch (e: any) {
          if (e.message?.includes('already connected')) console.warn('[Firebase Client Init WARN] Storage emulator already connected.');
          else console.error('[Firebase Client Init ERROR] Connecting to Storage emulator:', e);
      }
  } else {
      console.log(`[Firebase Client Init] Production-like mode or emulators not configured. Connecting to live Firebase services for project: ${firebaseConfig.projectId}`);
  }
} else if (missingVars.length > 0) {
  console.error("[Firebase Client Init] Firebase app could not be initialized due to missing configuration. Firebase services (db, auth, storage) will be unavailable.");
}


export { db, app, auth, storage };
    
