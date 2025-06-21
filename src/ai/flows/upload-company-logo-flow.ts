
'use server';
/**
 * @fileOverview A Genkit flow to handle file uploads to Firebase Storage for the company logo.
 */
import { ai } from '@/ai/genkit';
import { adminStorage } from '@/lib/firebase-admin';
import { z } from 'zod';

const UploadCompanyLogoInputSchema = z.object({
  fileName: z.string().describe("Original name of the file."),
  fileDataUri: z.string().describe("The file content as a Base64 encoded data URI."),
});
export type UploadCompanyLogoInput = z.infer<typeof UploadCompanyLogoInputSchema>;

const UploadCompanyLogoOutputSchema = z.object({
  fileUrl: z.string().url().describe("The public URL of the uploaded file."),
  filePath: z.string().describe("The full path in Firebase Storage where the file was saved."),
});
export type UploadCompanyLogoOutput = z.infer<typeof UploadCompanyLogoOutputSchema>;

export async function uploadCompanyLogo(input: UploadCompanyLogoInput): Promise<UploadCompanyLogoOutput> {
  return uploadCompanyLogoFlow(input);
}

const uploadCompanyLogoFlow = ai.defineFlow(
  {
    name: 'uploadCompanyLogoFlow',
    inputSchema: UploadCompanyLogoInputSchema,
    outputSchema: UploadCompanyLogoOutputSchema,
  },
  async (input) => {
    const { fileName, fileDataUri } = input;

    if (!adminStorage) {
      throw new Error("File upload service is unavailable. Firebase Admin Storage is not initialized.");
    }

    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
      throw new Error("Firebase Storage bucket name is not configured in environment variables.");
    }
    
    const filePath = `company_logos/${fileName}`;

    const matches = fileDataUri.match(/^data:(.+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error('Invalid data URI format.');
    }
    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    const bucket = adminStorage.bucket(bucketName);
    const file = bucket.file(filePath);

    await file.save(buffer, {
        metadata: { contentType: mimeType },
    });
    
    await file.makePublic();

    const publicUrl = file.publicUrl();

    return {
      fileUrl: publicUrl,
      filePath: filePath,
    };
  }
);
