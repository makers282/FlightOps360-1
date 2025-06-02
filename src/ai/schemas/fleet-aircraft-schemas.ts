
/**
 * @fileOverview Zod schemas and TypeScript types for fleet aircraft and engine details.
 * This file is not marked with 'use server' and can be safely imported by both
 * server-side flows and client-side components.
 */
import { z } from 'zod'; // Or 'genkit' if that's where z is typically imported for schemas

// Define the structure for an engine detail
export const EngineDetailSchema = z.object({
  model: z.string().optional().describe("Engine model."),
  serialNumber: z.string().optional().describe("Engine serial number."),
});
export type EngineDetail = z.infer<typeof EngineDetailSchema>;

// Define the structure for a propeller detail
export const PropellerDetailSchema = z.object({
  model: z.string().optional().describe("Propeller model."),
  serialNumber: z.string().optional().describe("Propeller serial number."),
  // type: z.string().optional().describe("e.g., Fixed Pitch, Constant Speed, Feathering"), // Example for future expansion
});
export type PropellerDetail = z.infer<typeof PropellerDetailSchema>;

// Define the structure for a fleet aircraft
export const FleetAircraftSchema = z.object({
  id: z.string().describe("The unique identifier for the aircraft, typically the tail number if unique, or an auto-generated ID."),
  tailNumber: z.string().min(1, "Tail number is required.").describe("The aircraft's tail number (e.g., N123AB)."),
  model: z.string().min(1, "Aircraft model is required.").describe("The aircraft model (e.g., Cessna Citation CJ3)."),
  serialNumber: z.string().optional().describe("Aircraft serial number."),
  aircraftYear: z.number().int().min(1900).max(new Date().getFullYear() + 10).optional().describe("Year of manufacture."),
  baseLocation: z.string().optional().describe("Primary base location of the aircraft (e.g., KTEB)."),
  engineDetails: z.array(EngineDetailSchema).optional().default([]).describe("Details for each engine."),
  propellerDetails: z.array(PropellerDetailSchema).optional().default([]).describe("Details for each propeller assembly."),
  isMaintenanceTracked: z.boolean().optional().default(true).describe("Whether maintenance tracking is enabled for this aircraft."),
  trackedComponentNames: z.array(z.string()).optional().default(['Airframe', 'Engine 1']).describe("List of component names to track hours/cycles for (e.g., Airframe, Engine 1, Propeller 1)."),
  primaryContactName: z.string().optional().describe("Primary contact person for the aircraft."),
  primaryContactPhone: z.string().optional().describe("Primary contact phone for the aircraft."),
  primaryContactEmail: z.string().email("Invalid email format.").optional().describe("Primary contact email for the aircraft."),
  internalNotes: z.string().optional().describe("Internal operational notes like hangar location, access codes, etc."),
});
export type FleetAircraft = z.infer<typeof FleetAircraftSchema>;

// Schemas for flow inputs and outputs related to FleetAircraft
export const SaveFleetAircraftInputSchema = FleetAircraftSchema; // Input is the full aircraft object
export type SaveFleetAircraftInput = z.infer<typeof SaveFleetAircraftInputSchema>;

export const DeleteFleetAircraftInputSchema = z.object({
  aircraftId: z.string().describe("The ID of the aircraft to delete from the fleet."),
});
export type DeleteFleetAircraftInput = z.infer<typeof DeleteFleetAircraftInputSchema>;

export const FetchFleetAircraftOutputSchema = z.array(FleetAircraftSchema);
export const SaveFleetAircraftOutputSchema = FleetAircraftSchema; // Output is the saved aircraft object
export const DeleteFleetAircraftOutputSchema = z.object({
  success: z.boolean(),
  aircraftId: z.string(),
});

