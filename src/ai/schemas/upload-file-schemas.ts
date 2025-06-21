
import { z } from 'zod';

export const UploadFileSchema = z.object({
  path: z.string(),
  file: z.string(), // base64 encoded string
  contentType: z.string(),
});
export type UploadFileInput = z.infer<typeof UploadFileSchema>;

export const UploadFileOutputSchema = z.object({
    downloadUrl: z.string(),
});
export type UploadFileOutput = z.infer<typeof UploadFileOutputSchema>;
