
'use server';
/**
 * @fileOverview A Genkit flow to handle file uploads to Firebase Storage for aircraft documents.
 *
 * - uploadAircraftDocument - Uploads a file and returns its storage URL.
 * - UploadAircraftDocumentInput - Input type for the upload flow.
 * - UploadAircraftDocumentOutput - Output type for the upload flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
// Use direct imports for firebase-admin/app
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

// --- Firebase Admin SDK Initialization Block ---
// This block runs once when the module is first loaded.
let adminAppInitialized = getApps().length > 0;

if (!adminAppInitialized) {
  console.log('[upload-flow:INIT_START] Attempting Firebase Admin SDK initialization (currently not initialized)...');
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (!storageBucket) {
    console.error("[upload-flow:INIT_ERROR] CRITICAL: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET environment variable is not set. Firebase Admin SDK cannot be initialized for Storage.");
  } else {
    console.log(`[upload-flow:INIT_INFO] Storage bucket configured: ${storageBucket}`);
    if (serviceAccountJson) {
      console.log('[upload-flow:INIT_INFO] FIREBASE_SERVICE_ACCOUNT_JSON environment variable is set.');
      try {
        const serviceAccount = JSON.parse(serviceAccountJson);
        initializeApp({ // Use direct import
          credential: cert(serviceAccount), // Use direct import
          storageBucket: storageBucket,
        });
        adminAppInitialized = true; // Update status
        console.log('[upload-flow:INIT_SUCCESS] Firebase Admin SDK initialized successfully using FIREBASE_SERVICE_ACCOUNT_JSON.');
      } catch (e:any) {
        console.error('[upload-flow:INIT_ERROR] Failed to parse or use FIREBASE_SERVICE_ACCOUNT_JSON. Error:', e.message);
        console.error('[upload-flow:INIT_HINT] Ensure FIREBASE_SERVICE_ACCOUNT_JSON contains the valid JSON content, not a path.');
      }
    } else {
      console.log('[upload-flow:INIT_INFO] FIREBASE_SERVICE_ACCOUNT_JSON not set. Attempting default credential lookup (e.g., GOOGLE_APPLICATION_CREDENTIALS or GCP environment)...');
      try {
        initializeApp({ // Use direct import
          storageBucket: storageBucket, // Default credentials will be used
        });
        adminAppInitialized = true; // Update status
        console.log('[upload-flow:INIT_SUCCESS] Firebase Admin SDK initialized successfully using default credentials.');
      } catch (defaultInitError: any) {
        console.warn(
          '[upload-flow:INIT_WARN] Firebase Admin SDK default initialization failed. This is often due to GOOGLE_APPLICATION_CREDENTIALS not being set, pointing to an invalid/missing file, or not running in a GCP environment with default credentials. Error:', defaultInitError.message
        );
      }
    }
  }
} else {
  console.log(`[upload-flow:INIT_SKIP] Firebase Admin SDK already initialized. Apps count: ${getApps().length}.`);
}

// Final check after all initialization attempts or if skipped
if (adminAppInitialized) {
  console.log(`[upload-flow:POST_INIT_CHECK_SUCCESS] Firebase Admin SDK IS INITIALIZED. Total admin apps: ${getApps().length}.`);
} else {
  console.warn(`[upload-flow:POST_INIT_CHECK_FAIL] Firebase Admin SDK IS NOT INITIALIZED after all attempts. File uploads will fail if attempted. Total admin apps: ${getApps().length}.`);
}
// --- End of Firebase Admin SDK Initialization Block ---


const UploadAircraftDocumentInputSchema = z.object({
  aircraftId: z.string().describe("ID of the aircraft the document belongs to."),
  documentId: z.string().describe("Unique ID for the document (can be generated client-side)."),
  fileName: z.string().describe("Original name of the file."),
  fileDataUri: z.string().describe("The file content as a Base64 encoded data URI."),
});
export type UploadAircraftDocumentInput = z.infer<typeof UploadAircraftDocumentInputSchema>;

const UploadAircraftDocumentOutputSchema = z.object({
  fileUrl: z.string().url().describe("The public URL of the uploaded file."),
  filePath: z.string().describe("The full path in Firebase Storage where the file was saved."),
});
export type UploadAircraftDocumentOutput = z.infer<typeof UploadAircraftDocumentOutputSchema>;

export async function uploadAircraftDocument(input: UploadAircraftDocumentInput): Promise<UploadAircraftDocumentOutput> {
  return uploadAircraftDocumentFlow(input);
}

const uploadAircraftDocumentFlow = ai.defineFlow(
  {
    name: 'uploadAircraftDocumentFlow',
    inputSchema: UploadAircraftDocumentInputSchema,
    outputSchema: UploadAircraftDocumentOutputSchema,
  },
  async (input) => {
    const { aircraftId, documentId, fileName, fileDataUri } = input;

    // Runtime check if admin app was successfully initialized (using the flag or getApps().length)
    if (!adminAppInitialized || getApps().length === 0) { // Check both the flag and current app count
      const errorMsg = "File upload service is unavailable. Firebase Admin SDK is not initialized. " +
                       "Please ensure server environment is configured correctly with FIREBASE_SERVICE_ACCOUNT_JSON or valid GOOGLE_APPLICATION_CREDENTIALS.";
      console.error("[uploadAircraftDocumentFlow:RUNTIME_CHECK_FAIL] " + errorMsg);
      throw new Error(errorMsg); // This is the error being thrown as per your log
    }

    const filePath = `aircraft_documents/${aircraftId}/${documentId}/${fileName}`;
    console.log(`[uploadAircraftDocumentFlow] Attempting to upload to: ${filePath}`);

    const matches = fileDataUri.match(/^data:(.+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error('Invalid data URI format.');
    }
    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
        const errorMsg = "Firebase Storage bucket name is not configured in environment variables (NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET).";
        console.error("[uploadAircraftDocumentFlow:CONFIG_CHECK_FAIL] " + errorMsg);
        throw new Error(errorMsg);
    }

    let bucket;
    try {
      bucket = getStorage().bucket(bucketName); // Use direct import
    } catch (storageError: any) {
      const errorMsg = "File upload service encountered an issue accessing Firebase Storage. Admin SDK may not be properly initialized or storage service is unavailable.";
      console.error("[uploadAircraftDocumentFlow:STORAGE_ACCESS_ERROR] " + errorMsg + " Details:", storageError.message);
      throw new Error(errorMsg + " Check server logs for specific Firebase Admin SDK errors during initialization.");
    }

    const file = bucket.file(filePath);

    try {
      await file.save(buffer, {
        metadata: { contentType: mimeType },
      });
    } catch (saveError: any) {
        console.error(`[uploadAircraftDocumentFlow:SAVE_ERROR] Failed to save file to ${filePath}. Error:`, saveError.message);
        throw new Error(`Failed to save file to storage. Details: ${saveError.message}`);
    }

    try {
      await file.makePublic();
    } catch (makePublicError: any) {
        console.warn(`[uploadAircraftDocumentFlow:MAKE_PUBLIC_WARN] Failed to make file public: ${filePath}. This might be okay if files are accessed via signed URLs or different permissions. Error:`, makePublicError.message);
    }

    const publicUrl = file.publicUrl();

    console.log(`[uploadAircraftDocumentFlow] Upload successful. Public URL: ${publicUrl}`);

    return {
      fileUrl: publicUrl,
      filePath: filePath,
    };
  }
);
    
