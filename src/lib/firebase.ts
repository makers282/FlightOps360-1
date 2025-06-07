
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

if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !effectiveProjectId) {
  const missingVars = [];
  if (!firebaseConfig.apiKey) missingVars.push("NEXT_PUBLIC_FIREBASE_API_KEY");
  if (!firebaseConfig.authDomain) missingVars.push("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
  // projectId check is implicitly covered by effectiveProjectId, but if it's undefined and not dev, it's an issue.
  if (!firebaseConfig.projectId && process.env.NODE_ENV !== 'development') missingVars.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  if (!effectiveProjectId) missingVars.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID (is required even for development if NODE_ENV is not 'development')");


  const errorMessage = `Firebase configuration is incomplete. 
Missing required environment variables: ${missingVars.join(', ')}.
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

Note: For emulator usage, apiKey can often be a placeholder like "test-api-key", but authDomain and projectId are still important for SDK initialization.
`;
  console.error(errorMessage);
  // This will stop the app from starting if config is missing.
  throw new Error(errorMessage); 
}

// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp({ ...firebaseConfig, projectId: effectiveProjectId });
} else {
  app = getApp();
}

const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

if (process.env.NODE_ENV === 'development') {
    console.log('Connecting to Firebase emulators (Auth, Firestore, Storage)...');
    try {
        // For Firestore, host includes http:// by default in some SDK versions, others don't.
        // Sticking to host/port as per latest docs.
        connectFirestoreEmulator(db, '127.0.0.1', 8080); 
        connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
        connectStorageEmulator(storage, '127.0.0.1', 9199);
        console.log('Successfully attempted to connect to emulators.');
    } catch (error) {
        // This can happen on Next.js Fast Refresh if the module is re-evaluated.
        // console.warn('Error connecting to Firebase emulators (may be due to Fast Refresh):', error);
    }
}

export { db, app, auth, storage };
