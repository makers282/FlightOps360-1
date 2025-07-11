
'use server';
import { ai } from '@/ai/genkit';
import { adminStorage } from '@/lib/firebase-admin';
import {
  UploadFileSchema,
  UploadFileOutputSchema,
} from '@/ai/schemas/upload-file-schemas';
import { z } from 'zod';

export const uploadFile = ai.defineFlow(
  {
    name: 'uploadFile',
    inputSchema: UploadFileSchema,
    outputSchema: UploadFileOutputSchema,
  },
  async ({ path, file, contentType }) => {
    // The adminStorage object is now correctly initialized with the bucket name in firebase-admin.ts
    // We can directly get the default bucket from it.
    const bucket = adminStorage.bucket(); 
    
    console.log(`[UploadFile Flow] Attempting to upload to path "${path}" in bucket "${bucket.name}".`);

    const buffer = Buffer.from(file, 'base64');
    const fileRef = bucket.file(path);

    try {
      await fileRef.save(buffer, {
        metadata: {
          contentType,
        },
      });

      // Make the file public to get a permanent URL
      await fileRef.makePublic();

      // Get the permanent public URL
      const publicUrl = fileRef.publicUrl();
      
      console.log(`[UploadFile Flow] Successfully uploaded. Public URL: ${publicUrl}`);
      return {
        downloadUrl: publicUrl,
      };

    } catch (error) {
        console.error('[UploadFile Flow] CRITICAL ERROR during file upload:', error);
        // Re-throwing the error so the client gets a meaningful response
        throw new Error(`Failed to upload file to storage: ${error}`);
    }
  }
);
