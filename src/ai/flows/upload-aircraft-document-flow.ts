
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
import { initializeApp as initializeAdminApp, getApps as getAdminApps, cert as adminCert } from 'firebase-admin/app';
import { getStorage as getAdminStorage } from 'firebase-admin/storage';

// Attempt to initialize Firebase Admin SDK if not already initialized
if (!getAdminApps().length) {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (!storageBucket) {
    console.error("[upload-flow] CRITICAL ERROR: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET environment variable is not set. Firebase Admin SDK cannot be initialized for Storage.");
    // Not setting adminAppInitialized = true, so flow will fail if used.
  } else {
    if (serviceAccountJson) {
      try {
        const serviceAccount = JSON.parse(serviceAccountJson);
        initializeAdminApp({
          credential: adminCert(serviceAccount),
          storageBucket: storageBucket,
        });
        console.log('[upload-flow] Firebase Admin SDK initialized using service account JSON.');
      } catch (e:any) {
        console.error('[upload-flow] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON. Error:', e.message);
        console.warn('[upload-flow] File uploads will likely not work if FIREBASE_SERVICE_ACCOUNT_JSON is invalid and no other admin credentials are found (e.g., GOOGLE_APPLICATION_CREDENTIALS in a GCP environment).');
        // adminAppInitialized remains false implicitly by not being set true.
      }
    } else {
      // FIREBASE_SERVICE_ACCOUNT_JSON is not set.
      // Try default initialization which relies on GOOGLE_APPLICATION_CREDENTIALS or a GCP environment.
      try {
        console.log('[upload-flow] FIREBASE_SERVICE_ACCOUNT_JSON not provided. Attempting default Firebase Admin SDK initialization...');
        initializeAdminApp({ storageBucket: storageBucket });
        console.log('[upload-flow] Firebase Admin SDK initialized using default credentials (e.g., GOOGLE_APPLICATION_CREDENTIALS or GCP environment). Storage bucket:', storageBucket);
      } catch (defaultInitError: any) {
        console.warn(
          '[upload-flow] Firebase Admin SDK default initialization failed. ' +
          'This is expected locally if GOOGLE_APPLICATION_CREDENTIALS is not set, is invalid, or points to a missing file, ' +
          'and not running in a GCP environment. File uploads via this flow will not work. ' +
          'Error details:', defaultInitError.message
        );
        // adminAppInitialized remains false implicitly.
      }
    }
  }
} else {
    console.log('[upload-flow] Firebase Admin SDK already initialized.');
}


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

    // Check if admin app was successfully initialized
    if (getAdminApps().length === 0) {
      console.error("[uploadAircraftDocumentFlow] Firebase Admin App is not initialized. Cannot proceed with file upload.");
      throw new Error(
        "File upload service is unavailable. Firebase Admin SDK is not initialized. " +
        "Please ensure server environment is configured correctly with FIREBASE_SERVICE_ACCOUNT_JSON or valid GOOGLE_APPLICATION_CREDENTIALS."
      );
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
        throw new Error("Firebase Storage bucket name is not configured in environment variables (NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET).");
    }
    
    let bucket;
    try {
      bucket = getAdminStorage().bucket(bucketName);
    } catch (storageError: any) {
      console.error("[uploadAircraftDocumentFlow] Failed to get Firebase Admin Storage instance. Admin SDK might not be properly initialized. Error:", storageError.message);
      throw new Error(
        "File upload service encountered an issue accessing storage. Firebase Admin SDK may not be properly initialized. " +
        "Check server logs for details."
      );
    }
    
    const file = bucket.file(filePath);

    await file.save(buffer, {
      metadata: { contentType: mimeType },
    });

    await file.makePublic(); 
    
    const publicUrl = file.publicUrl();
    
    console.log(`[uploadAircraftDocumentFlow] Upload successful. Public URL: ${publicUrl}`);

    return {
      fileUrl: publicUrl,
      filePath: filePath,
    };
  }
);
