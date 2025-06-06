
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

// Initialize Firebase Admin SDK if not already initialized
if (!getAdminApps().length) {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (!storageBucket) {
    console.error("[upload-flow] CRITICAL ERROR: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET environment variable is not set. Firebase Admin SDK cannot be initialized for Storage.");
    // Potentially throw an error here or handle as appropriate for your app's startup
  } else if (serviceAccountJson) {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      initializeAdminApp({
        credential: adminCert(serviceAccount),
        storageBucket: storageBucket,
      });
      console.log('[upload-flow] Firebase Admin SDK initialized using service account JSON.');
    } catch (e) {
      console.error('[upload-flow] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON. Attempting default initialization.', e);
      // Fallback to default init if JSON is bad but we might be in a GCP env
      initializeAdminApp({ storageBucket: storageBucket });
      console.log('[upload-flow] Firebase Admin SDK initialized using default credentials (service account parsing failed).');
    }
  } else {
    // Standard initialization for environments like Cloud Functions, Cloud Run, or local dev with GOOGLE_APPLICATION_CREDENTIALS
    initializeAdminApp({ storageBucket: storageBucket });
    console.log('[upload-flow] Firebase Admin SDK initialized (default or GOOGLE_APPLICATION_CREDENTIALS). Storage bucket:', storageBucket);
  }
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
    // Use getAdminStorage() here
    const bucket = getAdminStorage().bucket(bucketName);
    const file = bucket.file(filePath);

    await file.save(buffer, {
      metadata: { contentType: mimeType },
      // Optionally make public here, or handle URLs differently (e.g. signed URLs)
      // public: true, // This makes the file public directly on upload
    });

    // Make the file publicly readable - this is one way to get a public URL.
    // Consider security implications; signed URLs are often better for private data.
    await file.makePublic(); 
    
    const publicUrl = file.publicUrl();
    
    console.log(`[uploadAircraftDocumentFlow] Upload successful. Public URL: ${publicUrl}`);

    return {
      fileUrl: publicUrl,
      filePath: filePath,
    };
  }
);
