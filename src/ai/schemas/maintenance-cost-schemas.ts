
/**
 * @fileOverview Zod schemas and TypeScript types for maintenance cost entries.
 */
import { z } from 'zod';

export const MaintenanceCostBreakdownSchema = z.object({
  category: z.enum(['Labor', 'Parts', 'Shop Fees', 'Other']),
  projectedCost: z.number().nonnegative().default(0),
  actualCost: z.number().nonnegative().default(0),
  description: z.string().optional(),
});
export type MaintenanceCostBreakdown = z.infer<typeof MaintenanceCostBreakdownSchema>;

export const MaintenanceCostAttachmentSchema = z.object({
  name: z.string(),
  url: z.string().url(),
});
export type MaintenanceCostAttachment = z.infer<typeof MaintenanceCostAttachmentSchema>;

export const MaintenanceCostSchema = z.object({
  id: z.string().describe("Firestore document ID"),
  aircraftId: z.string(),
  tailNumber: z.string(),
  invoiceDate: z.string().describe("ISO date string"),
  invoiceNumber: z.string(),
  costType: z.enum(["Scheduled", "Unscheduled"]),
  costBreakdowns: z.array(MaintenanceCostBreakdownSchema).min(1),
  notes: z.string().optional(),
  attachments: z.array(MaintenanceCostAttachmentSchema).optional().default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type MaintenanceCost = z.infer<typeof MaintenanceCostSchema>;

// Schema for saving a cost entry (input to the flow)
export const SaveMaintenanceCostInputSchema = MaintenanceCostSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
}).extend({
  id: z.string().optional(), // ID is optional for creation, provided for updates
});
export type SaveMaintenanceCostInput = z.infer<typeof SaveMaintenanceCostInputSchema>;

// Schema for the output of the save operation
export const SaveMaintenanceCostOutputSchema = MaintenanceCostSchema;

// For fetching multiple entries
export const FetchMaintenanceCostsOutputSchema = z.array(MaintenanceCostSchema);

// For deleting an entry
export const DeleteMaintenanceCostInputSchema = z.object({
  costId: z.string(),
});
export const DeleteMaintenanceCostOutputSchema = z.object({
  success: z.boolean(),
  costId: z.string(),
});
