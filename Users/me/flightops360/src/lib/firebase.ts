
// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
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

console.log(`[Firebase Client Init] Attempting to initialize with Firebase config. Project ID from env: ${firebaseConfig.projectId}. Intended project: SkyBase.`);

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
Ensure these are set in your .env file for the 'SkyBase' project. App functionality will be affected.
`;
  console.error("[Firebase Client Init ERROR]", missingVarsMessage);
}

let app;
if (!getApps().length) {
  if (missingOrPlaceholderVars.length > 0) {
    console.error("[Firebase Client Init] Halting Firebase initialization due to missing or placeholder env vars. Firebase services will be unavailable.");
  } else {
    console.log("[Firebase Client Init] Initializing new Firebase app with live config for project:", firebaseConfig.projectId);
    app = initializeApp(firebaseConfig);
  }
} else {
  app = getApp();
  console.log("[Firebase Client Init] Using existing Firebase app. Configured for project:", app.options.projectId);
}

const db = app ? getFirestore(app) : null;
const auth = app ? getAuth(app) : null;
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
  if (auth) {
    try {
      connectAuthEmulator(auth, 'http://127.0.0.1:9100', { disableWarnings: true }); // Port from firebase.json
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
  console.log(`[Firebase Client Init] Firebase app configured for project: ${firebaseConfig.projectId}. Firestore: ${!!db}, Auth: ${!!auth}, Storage: ${!!storage}`);
} else {
  console.error("[Firebase Client Init] Firebase app object is undefined. Services (db, auth, storage) are NOT initialized.");
}

export { db, app, auth, storage };
