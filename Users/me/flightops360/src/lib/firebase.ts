
// src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, connectAuthEmulator } from 'firebase/auth';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

console.log(`[Firebase Client Init DEBUG] Using apiKey: ${firebaseConfig.apiKey ? 'SET' : 'NOT SET'}`);
console.log(`[Firebase Client Init DEBUG] Using authDomain: ${firebaseConfig.authDomain}`);
console.log(`[Firebase Client Init DEBUG] Raw env NEXT_PUBLIC_FIREBASE_PROJECT_ID: '${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}'`);
console.log(`[Firebase Client Init DEBUG] Configured to initialize with Project ID: '${firebaseConfig.projectId}'.`);

let missingVarsMessage = "";
const requiredEnvVarKeys: (keyof typeof firebaseConfig)[] = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
];

const missingOrPlaceholderVars = requiredEnvVarKeys.filter(key => {
  const value = firebaseConfig[key];
  return !value || (typeof value === 'string' && value.startsWith('your-'));
});

if (missingOrPlaceholderVars.length > 0) {
  const envVarNames = missingOrPlaceholderVars.map(key => `NEXT_PUBLIC_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`);
  missingVarsMessage = `Firebase configuration is incomplete or contains placeholders.
Missing or placeholder environment variables: ${envVarNames.join(', ')}.
Ensure these are set in your .env file. App functionality will be affected.
`;
  console.error("[Firebase Client Init ERROR]", missingVarsMessage);
}

let app: FirebaseApp | undefined;
if (!getApps().length) {
  if (missingOrPlaceholderVars.length > 0) {
    console.error("[Firebase Client Init DEBUG] Halting Firebase initialization due to missing or placeholder env vars.");
  } else {
    try {
      console.log("[Firebase Client Init DEBUG] Attempting to initialize new Firebase app with live config for project:", firebaseConfig.projectId);
      app = initializeApp(firebaseConfig);
      console.log("[Firebase Client Init DEBUG] Successfully initialized new Firebase app. App Name:", app.name);
      console.log("[Firebase Client Init DEBUG] Initialized App's Actual Project ID (from app.options):", app.options.projectId);
    } catch (initError) {
      console.error("[Firebase Client Init CRITICAL ERROR] Error during initializeApp:", initError);
      app = undefined;
    }
  }
} else {
  app = getApp();
  console.log("[Firebase Client Init DEBUG] Using existing Firebase app. App Name:", app.name);
  console.log("[Firebase Client Init DEBUG] Existing App's Actual Project ID (from app.options):", app.options.projectId);
}

const db = app ? getFirestore(app) : null;
const authInstance = app ? getAuth(app) : null;
const storage = app ? getStorage(app) : null;

// Connect to emulators if in development and app was initialized
if (app && process.env.NODE_ENV === 'development') {
  console.log("[Firebase Client Init] Development mode detected. Attempting to connect to emulators.");
  if (db) {
    try {
      connectFirestoreEmulator(db, '127.0.0.1', 8081); // Port from firebase.json
      console.log("[Firebase Client Init] Connected to Firestore Emulator on port 8081.");
    } catch (e) {
      console.warn("[Firebase Client Init] Error connecting to Firestore Emulator:", e);
    }
  }
  if (authInstance) {
    try {
      // Corrected emulator URL format
      connectAuthEmulator(authInstance, 'http://127.0.0.1:9100', { disableWarnings: true }); // Port from firebase.json
      console.log("[Firebase Client Init] Connected to Auth Emulator on port 9100.");
    } catch (e) {
      console.warn("[Firebase Client Init] Error connecting to Auth Emulator:", e);
    }
  }
  if (storage) {
    try {
      connectStorageEmulator(storage, '127.0.0.1', 9200); // Port from firebase.json
      console.log("[Firebase Client Init] Connected to Storage Emulator on port 9200.");
    } catch (e) {
      console.warn("[Firebase Client Init] Error connecting to Storage Emulator:", e);
    }
  }
}

if (app) {
  console.log(`[Firebase Client Init DEBUG] Firebase app object IS ${app ? 'defined' : 'UNDEFINED'}.`);
  console.log(`[Firebase Client Init DEBUG] Effective Project ID: ${app.options.projectId}. Services: Firestore=${!!db}, Auth=${!!authInstance}, Storage=${!!storage}`);
  if (authInstance) {
    onAuthStateChanged(authInstance, (user) => {
      if (user) {
        console.log("[Firebase Auth State DEBUG] User IS signed in. UID:", user.uid, "Email:", user.email);
      } else {
        console.log("[Firebase Auth State DEBUG] User IS signed out.");
      }
    });
  } else {
    console.warn("[Firebase Client Init DEBUG] Auth service (authInstance) is not available to set onAuthStateChanged listener.");
  }
} else {
  console.error("[Firebase Client Init DEBUG] Firebase app object is UNDEFINED. Services (db, auth, storage) are NOT initialized.");
}

export { db, app, authInstance as auth, storage };
