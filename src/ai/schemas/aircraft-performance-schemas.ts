
/**
 * @fileOverview Zod schemas and TypeScript types for aircraft performance data.
 */
import { z } from 'zod';

// This schema should align with AircraftPerformanceOutputSchema from suggest-aircraft-performance-flow.ts
// and AircraftPerformanceFormData from the form.
export const AircraftPerformanceDataSchema = z.object({
  takeoffSpeed: z.coerce.number().min(0).optional(),
  landingSpeed: z.coerce.number().min(0).optional(),
  climbSpeed: z.coerce.number().min(0).optional(),
  climbRate: z.coerce.number().min(0).optional(),
  cruiseSpeed: z.coerce.number().min(0).optional(),
  cruiseAltitude: z.coerce.number().min(0).optional(),
  descentSpeed: z.coerce.number().min(0).optional(),
  descentRate: z.coerce.number().min(0).optional(),
  fuelType: z.string().optional(),
  fuelBurn: z.coerce.number().min(0).optional(),
  maxRange: z.coerce.number().min(0).optional(),
  maxAllowableTakeoffWeight: z.coerce.number().min(0).optional(),
});
export type AircraftPerformanceData = z.infer<typeof AircraftPerformanceDataSchema>;

// Schemas for flow inputs and outputs
export const FetchAircraftPerformanceInputSchema = z.object({
  aircraftId: z.string().describe("The ID of the aircraft (typically from the fleet collection)."),
});
export type FetchAircraftPerformanceInput = z.infer<typeof FetchAircraftPerformanceInputSchema>;

export const FetchAircraftPerformanceOutputSchema = AircraftPerformanceDataSchema.nullable();

export const SaveAircraftPerformanceInputSchema = z.object({
  aircraftId: z.string().describe("The ID of the aircraft."),
  performanceData: AircraftPerformanceDataSchema.describe("The performance data for the aircraft."),
});
export type SaveAircraftPerformanceInput = z.infer<typeof SaveAircraftPerformanceInputSchema>;

export const SaveAircraftPerformanceOutputSchema = z.object({
  success: z.boolean(),
  aircraftId: z.string(),
});
