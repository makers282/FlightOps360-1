
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
import { getStorage } from 'firebase-admin/storage';
import { initializeApp, cert, getApps, App } from 'firebase-admin/app';

// Initialize Firebase Admin SDK if not already initialized.
// This ensures it's available for server-side operations within Genkit flows.
// In a deployed Firebase environment (e.g., Cloud Functions), this might be automatic.
// For local development, GOOGLE_APPLICATION_CREDENTIALS environment variable should be set.
if (getApps().length === 0) {
  let serviceAccount;
  // Attempt to parse service account from environment variable if it's a JSON string
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch (e) {
      console.warn("Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON. Ensure it's a valid JSON string.");
    }
  }

  // Fallback to FIREBASE_SERVICE_ACCOUNT_KEY_PATH if JSON string is not available/valid
  // This part is more for local file path based credentials, which might not work in all serverless envs.
  // Prefer FIREBASE_SERVICE_ACCOUNT_JSON if possible for broader compatibility.
  if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH) {
      // This line would typically require `fs` and `path` modules if loading from a file path string,
      // but `cert()` can take an object directly.
      // serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH); // Avoid require for broader compatibility
      console.warn("FIREBASE_SERVICE_ACCOUNT_KEY_PATH is set, but direct JSON string is preferred for broader compatibility.");
  }


  if (serviceAccount || (process.env.GCLOUD_PROJECT && !process.env.FIREBASE_CONFIG)) {
    // If serviceAccount is loaded or if it's a Google Cloud environment without Firebase client config (implies Admin SDK should init by default)
    initializeApp({
      credential: serviceAccount ? cert(serviceAccount) : undefined, // Use cert() only if serviceAccount is an object
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
     console.log("Firebase Admin SDK initialized by upload-aircraft-document-flow.ts");
  } else if (process.env.FIREBASE_CONFIG) {
    // This case implies it might be a Firebase client-side config, which is not what Admin SDK uses for default init.
    // However, if running in a Firebase environment (like Cloud Functions), default init often works without explicit credentials.
    // We add a simple initializeApp() here for such cases, relying on implicit credentials.
    initializeApp({
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
    console.log("Firebase Admin SDK initialized using default credentials in a Firebase environment by upload-aircraft-document-flow.ts");
  } else {
    console.warn("Firebase Admin SDK not explicitly initialized in upload-aircraft-document-flow.ts. Relaying on implicit initialization or pre-existing setup.");
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
    const bucket = getStorage().bucket(bucketName);
    const file = bucket.file(filePath);

    await file.save(buffer, {
      metadata: { contentType: mimeType },
    });

    // Make the file publicly readable
    // Note: For production, you should have stricter security rules and potentially use signed URLs.
    // This makes the file accessible via its public URL immediately.
    await file.makePublic();
    
    const publicUrl = file.publicUrl();
    
    console.log(`[uploadAircraftDocumentFlow] Upload successful. Public URL: ${publicUrl}`);

    return {
      fileUrl: publicUrl,
      filePath: filePath,
    };
  }
);
