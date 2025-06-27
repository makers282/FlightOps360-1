/**
 * @fileOverview Zod schemas and TypeScript types for flight detail estimation.
 * This file does not use the 'use server' directive and can be safely imported by clients.
 */
import { z } from 'zod';

// 1) Only allow exactly 4 uppercase letters
const IcaoCode = z
  .string()
  .length(4, "Must be exactly 4 letters")
  .regex(/^[A-Z]{4}$/, "ICAO codes must be uppercase A–Z")
  .describe("A 4-letter ICAO airport code (e.g. KJFK)");

export const EstimateFlightDetailsInputSchema = z.object({
  origin:      z.string().min(3, "Origin must be 3-4 characters.").max(4),
  destination: z.string().min(3, "Destination must be 3-4 characters.").max(4),
  aircraftType: z.string().describe("Full aircraft type/model"),
  knownCruiseSpeedKts: z
    .number()
    .optional()
    .describe("Optional known cruise speed in knots"),
});
export type EstimateFlightDetailsInput = z.infer<typeof EstimateFlightDetailsInputSchema>;

export const EstimateFlightDetailsOutputSchema = z.object({
  resolvedOriginIcao:       z.string(),
  resolvedOriginName:       z.string(),
  originLat:                z.number(),
  originLon:                z.number(),
  resolvedDestinationIcao:  z.string(),
  resolvedDestinationName:  z.string(),
  destinationLat:           z.number(),
  destinationLon:           z.number(),
  estimatedMileageNM:       z.number(),
  estimatedFlightTimeHours: z.number(),
  assumedCruiseSpeedKts:    z.number(),
  briefExplanation:         z.string(),
});
export type EstimateFlightDetailsOutput = z.infer<typeof EstimateFlightDetailsOutputSchema>;
