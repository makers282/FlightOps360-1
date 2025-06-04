
/**
 * @fileOverview Zod schemas and TypeScript types for aircraft MEL (Minimum Equipment List) items.
 */
import { z } from 'zod';

export const melCategories = ["A", "B", "C", "D"] as const;
export type MelCategory = typeof melCategories[number];

export const melStatuses = ["Open", "Closed"] as const; // Simplified
export type MelStatus = typeof melStatuses[number];

export const MelItemSchema = z.object({
  id: z.string().describe("Unique Firestore document ID for the MEL item."),
  aircraftId: z.string().min(1, "Aircraft ID is required."),
  aircraftTailNumber: z.string().optional().describe("Denormalized tail number for easier display/filtering."),
  
  melNumber: z.string().min(1, "MEL item number (e.g., 25-10-01a) is required."),
  description: z.string().min(5, "A clear description of the MEL item is required."),
  category: z.enum(melCategories).optional().describe("MEL category (A, B, C, D)."),
  status: z.enum(melStatuses).default("Open"),
  
  dateEntered: z.string().describe("YYYY-MM-DD format, when the MEL item was entered/became active."),
  dueDate: z.string().optional().describe("YYYY-MM-DD format, when the MEL item is due for rectification (if applicable)."),
  
  provisionsOrLimitations: z.string().optional().describe("Specific provisions, limitations, or operational procedures required."),
  correctiveAction: z.string().optional().describe("Details of the corrective action taken to close the MEL item."),
  closedDate: z.string().optional().describe("YYYY-MM-DD format, when the MEL item was closed."),
  
  createdAt: z.string().describe("ISO string format, server-generated timestamp."),
  updatedAt: z.string().describe("ISO string format, server-generated timestamp."),
});
export type MelItem = z.infer<typeof MelItemSchema>;

// Schema for saving an MEL item (input to the flow)
export const SaveMelItemInputSchema = MelItemSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  aircraftTailNumber: true, 
}).extend({
  id: z.string().optional(), // ID is optional for creation, can be provided for updates
});
export type SaveMelItemInput = z.infer<typeof SaveMelItemInputSchema>;

// Schema for the output of the save operation
export const SaveMelItemOutputSchema = MelItemSchema;

// For fetching MEL items for a specific aircraft
export const FetchMelItemsInputSchema = z.object({
  aircraftId: z.string(),
});
export const FetchMelItemsOutputSchema = z.array(MelItemSchema);

// For deleting an MEL item
export const DeleteMelItemInputSchema = z.object({
  melItemId: z.string(),
});
export const DeleteMelItemOutputSchema = z.object({
  success: z.boolean(),
  melItemId: z.string(),
});

