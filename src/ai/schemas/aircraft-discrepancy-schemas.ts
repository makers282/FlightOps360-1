
/**
 * @fileOverview Zod schemas and TypeScript types for aircraft discrepancies.
 */
import { z } from 'zod';

export const discrepancyStatuses = ["Open", "Closed", "Deferred"] as const;
export type DiscrepancyStatus = typeof discrepancyStatuses[number];

export const AircraftDiscrepancySchema = z.object({
  id: z.string().describe("Unique Firestore document ID for the discrepancy."),
  aircraftId: z.string().min(1, "Aircraft ID is required."),
  aircraftTailNumber: z.string().optional().describe("Denormalized tail number for easier display/filtering."),
  
  status: z.enum(discrepancyStatuses).default("Open"),
  
  dateDiscovered: z.string().describe("YYYY-MM-DD format, when the discrepancy was found."),
  description: z.string().min(5, "A clear description of the discrepancy is required."),
  discoveredBy: z.string().optional(),
  discoveredByCertNumber: z.string().optional().describe("Certification number of the person who discovered it, if applicable."),

  isDeferred: z.boolean().default(false).describe("Is this discrepancy deferred (e.g., per MEL/NEF)?"),
  deferralReference: z.string().optional().describe("Reference for deferral, e.g., MEL item number."),
  deferralDate: z.string().optional().describe("YYYY-MM-DD format, date of deferral."),

  correctiveAction: z.string().optional().describe("Details of the corrective action taken."),
  dateCorrected: z.string().optional().describe("YYYY-MM-DD format, when the corrective action was completed."),
  correctedBy: z.string().optional().describe("Who performed the corrective action."),
  correctedByCertNumber: z.string().optional().describe("Certification number of the person who performed the correction."),
  
  createdAt: z.string().describe("ISO string format, server-generated timestamp."),
  updatedAt: z.string().describe("ISO string format, server-generated timestamp."),
});
export type AircraftDiscrepancy = z.infer<typeof AircraftDiscrepancySchema>;

// Schema for saving a discrepancy (input to the flow)
export const SaveAircraftDiscrepancyInputSchema = AircraftDiscrepancySchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  aircraftTailNumber: true, 
  // status: true, // Status can now be passed optionally
  // Fields related to sign-off are part of the main schema now
}).extend({
  id: z.string().optional(), // ID is optional for creation, can be provided for updates
  status: z.enum(discrepancyStatuses).optional(), // Status is optional on input; flow will determine if not provided
});
export type SaveAircraftDiscrepancyInput = z.infer<typeof SaveAircraftDiscrepancyInputSchema>;

// Schema for the output of the save operation
export const SaveAircraftDiscrepancyOutputSchema = AircraftDiscrepancySchema;

// For fetching discrepancies for a specific aircraft
export const FetchAircraftDiscrepanciesInputSchema = z.object({
  aircraftId: z.string(),
});
export const FetchAircraftDiscrepanciesOutputSchema = z.array(AircraftDiscrepancySchema);

// For deleting a discrepancy
export const DeleteAircraftDiscrepancyInputSchema = z.object({
  discrepancyId: z.string(),
});
export const DeleteAircraftDiscrepancyOutputSchema = z.object({
  success: z.boolean(),
  discrepancyId: z.string(),
});


    

