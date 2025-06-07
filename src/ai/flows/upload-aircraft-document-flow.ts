
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

    if (!adminStorage) {
      const errorMsg = "File upload service is unavailable. Firebase Admin Storage is not initialized. Check server logs for details on Firebase Admin SDK initialization.";
      console.error("[uploadAircraftDocumentFlow:RUNTIME_CHECK_FAIL] " + errorMsg);
      throw new Error(errorMsg);
    }

    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
      const errorMsg = "Firebase Storage bucket name is not configured in environment variables (NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET).";
      console.error("[uploadAircraftDocumentFlow:CONFIG_CHECK_FAIL] " + errorMsg);
      throw new Error(errorMsg);
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

    const bucket = adminStorage.bucket(bucketName);
    const file = bucket.file(filePath);

    try {
      await file.save(buffer, {
        metadata: { contentType: mimeType },
      });
    } catch (saveError: any) {
        console.error(`[uploadAircraftDocumentFlow:SAVE_ERROR] Failed to save file to ${filePath}. Error:`, saveError.message, saveError.stack);
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
