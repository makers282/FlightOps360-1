
// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const effectiveProjectId = firebaseConfig.projectId || '(Not Set)';
console.log(`[Firebase Client Init] Attempting to initialize Firebase. Project ID from env: ${effectiveProjectId}.`);

let missingVarsMessage = "";
// Define which keys are absolutely required for the app to function.
// measurementId is often for Analytics and can be optional for core functionality.
const requiredEnvVarKeys: (keyof Omit<typeof firebaseConfig, 'measurementId'>)[] = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
];

// Check if any of the *required* env vars are missing or are still the placeholder "your-..."
const missingOrPlaceholderVars = requiredEnvVarKeys.filter(key => {
  const value = firebaseConfig[key];
  return !value || (typeof value === 'string' && value.startsWith('your-'));
});

if (missingOrPlaceholderVars.length > 0) {
  const envVarNames = missingOrPlaceholderVars.map(key => `NEXT_PUBLIC_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`);
  const targetProjectName = firebaseConfig.projectId || "the TARGET Firebase project"; // Use projectId if available, otherwise generic
  missingVarsMessage = `Firebase configuration is incomplete or contains placeholders.
Missing or placeholder environment variables: ${envVarNames.join(', ')}.
Ensure these are set in your .env file for the '${targetProjectName}'. App functionality will be affected.
`;
  console.error("[Firebase Client Init ERROR]", missingVarsMessage);
}

let app;
if (!getApps().length) {
  if (missingOrPlaceholderVars.length > 0) {
    console.error("[Firebase Client Init] Halting Firebase initialization due to missing or placeholder env vars. Firebase services will be unavailable.");
    // app remains undefined, services will be null
  } else {
    console.log("[Firebase Client Init] Initializing new Firebase app with live config for project:", firebaseConfig.projectId);
    app = initializeApp(firebaseConfig);
  }
} else {
  app = getApp();
  console.log("[Firebase Client Init] Using existing Firebase app. Configured for project:", app.options.projectId);
}

// Initialize Firebase services if app was successfully initialized
const db = app ? getFirestore(app) : null;
const auth = app ? getAuth(app) : null;
const storage = app ? getStorage(app) : null;

if (app) {
  console.log(`[Firebase Client Init] Firebase app configured for project: ${firebaseConfig.projectId}. Firestore: ${!!db}, Auth: ${!!auth}, Storage: ${!!storage}`);
} else {
  console.error("[Firebase Client Init] Firebase app object is undefined. Services (db, auth, storage) are NOT initialized.");
}

export { db, app, auth, storage };
