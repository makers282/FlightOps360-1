
/**
 * @fileOverview Zod schemas and TypeScript types for aircraft rate configurations.
 * This file is not marked with 'use server' and can be safely imported by both
 * server-side flows and client-side components.
 */
import {z} from 'genkit';

// Define the structure for an aircraft rate
export const AircraftRateSchema = z.object({
  id: z.string().describe("The unique identifier for the aircraft from the fleet (e.g., N123AB or a Firestore doc ID)."),
  buy: z.number().min(0).describe("The buy rate per hour for the aircraft."),
  sell: z.number().min(0).describe("The sell rate per hour for the aircraft."),
});
export type AircraftRate = z.infer<typeof AircraftRateSchema>;

// Schemas for flow inputs
export const SaveAircraftRateInputSchema = AircraftRateSchema;
export type SaveAircraftRateInput = z.infer<typeof SaveAircraftRateInputSchema>;

export const DeleteAircraftRateInputSchema = z.object({
  aircraftId: z.string().describe("The ID of the aircraft rate to delete (corresponds to fleet aircraft ID)."),
});
export type DeleteAircraftRateInput = z.infer<typeof DeleteAircraftRateInputSchema>;

// Schema for flow outputs
export const FetchAircraftRatesOutputSchema = z.array(AircraftRateSchema);
export const SaveAircraftRateOutputSchema = AircraftRateSchema;
export const DeleteAircraftRateOutputSchema = z.object({
  success: z.boolean(),
  aircraftId: z.string(),
});
