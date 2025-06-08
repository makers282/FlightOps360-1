
// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
// IMPORTANT: These should be set in your .env.local file
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const nodeEnv = process.env.NODE_ENV;
console.log(`[Firebase Client Init] Detected NODE_ENV: ${nodeEnv}`);

// Check for missing environment variables
const requiredEnvVarKeys: (keyof typeof firebaseConfig)[] = [
  'apiKey',
  'authDomain',
  'projectId', // projectId is now always required
  'storageBucket',
  'messagingSenderId',
  'appId',
];

let missingVarsMessage = "";
const missingVars = requiredEnvVarKeys.filter(key => !firebaseConfig[key]);

if (missingVars.length > 0) {
  const envVarNames = missingVars.map(key => `NEXT_PUBLIC_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`);
  missingVarsMessage = `Firebase configuration is incomplete.
Missing required environment variables: ${envVarNames.join(', ')}.
Please check your .env.local file.
`;
  console.error("[Firebase Client Init ERROR]", missingVarsMessage);
}

// Initialize Firebase
let app;
if (!getApps().length) {
  if (missingVars.length > 0) {
    console.error("[Firebase Client Init] Halting Firebase initialization due to missing env vars. App will likely not function correctly.");
    // Potentially throw an error here if running client-side and vars are critical
    if (typeof window !== 'undefined') {
        alert("Firebase configuration is missing. Please check console for details.");
    }
  } else {
    // Always use the configuration directly from .env.local
    console.log("[Firebase Client Init] Initializing Firebase app with live config from .env.local for project:", firebaseConfig.projectId);
    app = initializeApp(firebaseConfig);
  }
} else {
  app = getApp();
  console.log("[Firebase Client Init] Using existing Firebase app. Configured for project:", app.options.projectId);
}

let db, auth, storage;

if (app) {
  db = getFirestore(app);
  auth = getAuth(app);
  storage = getStorage(app);
  console.log(`[Firebase Client Init] Successfully configured Firebase. Attempting to connect to live services for project: ${firebaseConfig.projectId}`);
} else {
  console.error("[Firebase Client Init] Firebase app could not be initialized. Firebase services (db, auth, storage) will be unavailable.");
}

export { db, app, auth, storage };
