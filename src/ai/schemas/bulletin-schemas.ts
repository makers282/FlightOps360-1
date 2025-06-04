
/**
 * @fileOverview Zod schemas and TypeScript types for company bulletins.
 */
import { z } from 'zod';

export const bulletinTypes = ["info", "warning", "critical"] as const;
export type BulletinType = typeof bulletinTypes[number];

export const BulletinSchema = z.object({
  id: z.string().describe("Unique Firestore document ID for the bulletin."),
  title: z.string().min(3, "Title must be at least 3 characters long."),
  message: z.string().min(10, "Message must be at least 10 characters long."),
  type: z.enum(bulletinTypes).default("info"),
  isActive: z.boolean().default(true).describe("Indicates if the bulletin is currently active/visible."),
  publishedAt: z.string().describe("ISO string format, server-generated timestamp of when it was published or last updated."),
  createdAt: z.string().describe("ISO string format, server-generated timestamp."),
  updatedAt: z.string().describe("ISO string format, server-generated timestamp."),
});
export type Bulletin = z.infer<typeof BulletinSchema>;

// Schema for saving a bulletin (input to the flow)
// id, createdAt, updatedAt, publishedAt will be handled by the server.
export const SaveBulletinInputSchema = BulletinSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  publishedAt: true, // Will be set to serverTimestamp on save
}).extend({
  id: z.string().optional(), // ID is optional for creation, can be provided for updates
});
export type SaveBulletinInput = z.infer<typeof SaveBulletinInputSchema>;

// Schema for the output of the save operation
export const SaveBulletinOutputSchema = BulletinSchema;

// For fetching multiple bulletins
export const FetchBulletinsOutputSchema = z.array(BulletinSchema);

// For deleting a bulletin
export const DeleteBulletinInputSchema = z.object({
  bulletinId: z.string(),
});
export const DeleteBulletinOutputSchema = z.object({
  success: z.boolean(),
  bulletinId: z.string(),
});
