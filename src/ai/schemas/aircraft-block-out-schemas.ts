
/**
 * @fileOverview Zod schemas and TypeScript types for aircraft block-out events.
 */
import { z } from 'zod';

export const AircraftBlockOutSchema = z.object({
  id: z.string().describe("Unique Firestore document ID for the block-out event."),
  aircraftId: z.string().min(1, "Aircraft ID is required."),
  aircraftLabel: z.string().optional().describe("Display label for the aircraft (e.g., N123AB - Cessna CJ3)."),
  title: z.string().min(1, "A title or reason for the block-out is required."),
  startDate: z.string().describe("ISO string format for the start date of the block-out period (inclusive)."),
  endDate: z.string().describe("ISO string format for the end date of the block-out period (inclusive)."),
  createdAt: z.string().optional().describe("ISO string format, server-generated timestamp."),
  updatedAt: z.string().optional().describe("ISO string format, server-generated timestamp."),
});
export type AircraftBlockOut = z.infer<typeof AircraftBlockOutSchema>;

// Schema for saving a block-out (input to the flow)
// id, createdAt, and updatedAt will be handled by the server.
export const SaveAircraftBlockOutInputSchema = AircraftBlockOutSchema.omit({ id: true, createdAt: true, updatedAt: true }).extend({
  id: z.string().optional(), // ID is optional for creation, can be provided for updates
});
export type SaveAircraftBlockOutInput = z.infer<typeof SaveAircraftBlockOutInputSchema>;

// Schema for the output of the save operation
export const SaveAircraftBlockOutOutputSchema = AircraftBlockOutSchema;

// For fetching multiple block-outs (output schema)
export const FetchAircraftBlockOutsOutputSchema = z.array(AircraftBlockOutSchema);

// For deleting a block-out
export const DeleteAircraftBlockOutInputSchema = z.object({
  blockOutId: z.string(),
});
export const DeleteAircraftBlockOutOutputSchema = z.object({
  success: z.boolean(),
  blockOutId: z.string(),
});
