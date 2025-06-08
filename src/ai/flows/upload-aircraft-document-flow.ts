
'use server';
/**
 * @fileOverview A Genkit flow to handle file uploads to Firebase Storage for aircraft documents.
 */
import { ai } from '@/ai/genkit';
import { adminStorage } from '@/lib/firebase-admin'; // Import directly
import { z } from 'zod';

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

    console.log('[uploadAircraftDocumentFlow:START] Received request to upload:', { aircraftId, documentId, fileNameLength: fileName.length, dataUriLength: fileDataUri.length });

    if (!adminStorage) {
      const errorMsg = "File upload service is unavailable. Firebase Admin Storage is not initialized. Check server logs for details on Firebase Admin SDK initialization.";
      console.error("[uploadAircraftDocumentFlow:ADMIN_STORAGE_FAIL] " + errorMsg);
      throw new Error(errorMsg);
    }
    console.log('[uploadAircraftDocumentFlow:INFO] adminStorage object appears to be available.');

    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
      const errorMsg = "Firebase Storage bucket name is not configured in environment variables (NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET).";
      console.error("[uploadAircraftDocumentFlow:CONFIG_CHECK_FAIL] " + errorMsg);
      throw new Error(errorMsg);
    }
    console.log(`[uploadAircraftDocumentFlow:INFO] Target bucket name from env: ${bucketName}`);
    
    const filePath = `aircraft_documents/${aircraftId}/${documentId}/${fileName}`;
    console.log(`[uploadAircraftDocumentFlow:INFO] Target file path in bucket: ${filePath}`);

    const matches = fileDataUri.match(/^data:(.+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      console.error('[uploadAircraftDocumentFlow:ERROR] Invalid data URI format received.');
      throw new Error('Invalid data URI format.');
    }
    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');
    console.log(`[uploadAircraftDocumentFlow:INFO] File parsed: MIME type '${mimeType}', buffer length ${buffer.length}`);

    let bucket;
    try {
      bucket = adminStorage.bucket(bucketName);
      console.log(`[uploadAircraftDocumentFlow:INFO] Successfully got a reference to bucket: ${bucket.name}`);
    } catch (bucketError: any) {
      console.error(`[uploadAircraftDocumentFlow:BUCKET_ACCESS_ERROR] Failed to get bucket reference for '${bucketName}'. Error:`, bucketError.message, bucketError.stack);
      throw new Error(`Failed to access storage bucket '${bucketName}'. Details: ${bucketError.message}`);
    }

    const file = bucket.file(filePath);
    console.log(`[uploadAircraftDocumentFlow:INFO] Got file reference: ${file.name}`);

    try {
      console.log(`[uploadAircraftDocumentFlow:ATTEMPT_SAVE] Attempting to save file to Storage at path: ${filePath}`);
      await file.save(buffer, {
        metadata: { contentType: mimeType },
        // You might consider making files resumable for larger uploads if needed,
        // though for typical documents this might be overkill.
        // resumable: true, 
      });
      console.log(`[uploadAircraftDocumentFlow:SAVE_SUCCESS] File successfully saved to ${filePath}`);
    } catch (saveError: any) {
        console.error(`[uploadAircraftDocumentFlow:SAVE_ERROR] Failed to save file to ${filePath}. Error Code: ${saveError.code}, Message:`, saveError.message, saveError.stack);
        // Provide more specific error messages based on common GCS error codes if possible
        let userFriendlyMessage = `Failed to save file to storage. Details: ${saveError.message}`;
        if (saveError.code === 403) {
            userFriendlyMessage = "Permission denied when trying to save the file. Check service account permissions for Firebase Storage.";
        } else if (saveError.code === 404) {
            userFriendlyMessage = `Storage bucket '${bucketName}' not found. Please verify NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET.`;
        }
        throw new Error(userFriendlyMessage);
    }

    try {
      console.log(`[uploadAircraftDocumentFlow:ATTEMPT_MAKE_PUBLIC] Attempting to make file public: ${filePath}`);
      await file.makePublic();
      console.log(`[uploadAircraftDocumentFlow:MAKE_PUBLIC_SUCCESS] File ${filePath} made public.`);
    } catch (makePublicError: any) {
        console.warn(`[uploadAircraftDocumentFlow:MAKE_PUBLIC_WARN] Failed to make file public: ${filePath}. This might be okay if files are accessed via signed URLs or different permissions. Error:`, makePublicError.message);
        // Depending on requirements, this might not be a critical error. 
        // If files must be public, you might re-throw or handle differently.
    }

    const publicUrl = file.publicUrl();
    console.log(`[uploadAircraftDocumentFlow:SUCCESS] Upload successful. Public URL: ${publicUrl}`);

    return {
      fileUrl: publicUrl,
      filePath: filePath,
    };
  }
);

