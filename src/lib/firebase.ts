
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
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, 
};

const nodeEnv = process.env.NODE_ENV;
console.log(`[Firebase Client Init] Detected NODE_ENV: ${nodeEnv}`);

// When running in development, we use a dummy project ID for emulators.
// Other config (apiKey, authDomain) is still needed for the SDK to initialize.
const effectiveProjectId = nodeEnv === 'development' ? 'dev-project' : firebaseConfig.projectId;

const requiredEnvVarKeys: (keyof typeof firebaseConfig)[] = [
  'apiKey',
  'authDomain',
  'storageBucket',
  'messagingSenderId',
  'appId',
];

// projectId is only strictly required if not in 'development' mode
if (nodeEnv !== 'development') {
  requiredEnvVarKeys.push('projectId');
}

let missingVarsMessage = "";
const missingVars = requiredEnvVarKeys.filter(key => !firebaseConfig[key]);

if (missingVars.length > 0) {
  const envVarNames = missingVars.map(key => `NEXT_PUBLIC_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`);
  missingVarsMessage = `Firebase configuration is incomplete. 
Missing required environment variables: ${envVarNames.join(', ')}.
Please create a .env.local file in the root of your project and add your Firebase project's web app configuration.
You can find these values in your Firebase project settings.
`;
  console.error("[Firebase Client Init ERROR]", missingVarsMessage);
}

// Initialize Firebase
let app;
if (!getApps().length) {
  if (missingVars.length > 0 && typeof window !== 'undefined') {
    console.error("[Firebase Client Init] Halting Firebase initialization due to missing env vars. App will likely not function correctly.");
  } else if (missingVars.length > 0 && typeof window === 'undefined') {
    // For server-side rendering in Next.js, this might throw during build if vars are missing.
    // If using client-side only Firebase, this specific check might be too aggressive.
    // Consider if this throw is appropriate for your setup or if just logging is better.
    throw new Error(missingVarsMessage); 
  } else {
    const initConfig = { ...firebaseConfig, projectId: effectiveProjectId };
    console.log("[Firebase Client Init] Initializing Firebase app with effective config:", initConfig);
    app = initializeApp(initConfig);
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
      // Updated ports here
      console.log("[Firebase Client Init] Emulator hosts: Auth (127.0.0.1:9100), Firestore (127.0.0.1:8081), Storage (127.0.0.1:9200)");
      
      try {
          if (!(auth as any).emulatorConfig) { // Check if already connected
              connectAuthEmulator(auth, 'http://127.0.0.1:9100', { disableWarnings: true });
              console.log("[Firebase Client Init] Auth emulator connection attempt queued for port 9100.");
          } else {
              console.log("[Firebase Client Init] Auth emulator already configured.");
          }
      } catch (e: any) {
          console.error('[Firebase Client Init ERROR] Connecting to Auth emulator:', e.message || e);
      }

      try {
          if (!(db as any).emulatorConfig) {
            connectFirestoreEmulator(db, '127.0.0.1', 8081); // Updated port
            console.log("[Firebase Client Init] Firestore emulator connection attempt queued for port 8081.");
          } else {
            console.log("[Firebase Client Init] Firestore emulator already configured.");
          }
      } catch (e: any) {
          console.error('[Firebase Client Init ERROR] Connecting to Firestore emulator:', e.message || e);
      }
      
      try {
          if (!(storage as any).emulatorConfig) {
            connectStorageEmulator(storage, '127.0.0.1', 9200); // Updated port
            console.log("[Firebase Client Init] Storage emulator connection attempt queued for port 9200.");
          } else {
            console.log("[Firebase Client Init] Storage emulator already configured.");
          }
      } catch (e: any) {
          console.error('[Firebase Client Init ERROR] Connecting to Storage emulator:', e.message || e);
      }
  } else {
      console.log(`[Firebase Client Init] Production-like mode. Connecting to live Firebase services for project: ${firebaseConfig.projectId}`);
  }
} else if (missingVars.length > 0) {
  // This case means app initialization itself failed due to missing core config.
  console.error("[Firebase Client Init] Firebase app could not be initialized due to missing configuration. Firebase services (db, auth, storage) will be unavailable.");
}


export { db, app, auth, storage };
