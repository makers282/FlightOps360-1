import * as z from 'zod';

// This file does not have 'use server' and can be imported safely by clients.

const IcaoCode = z
  .string()
  .length(4, "Must be exactly 4 letters")
  .regex(/^[A-Z]{4}$/, "ICAO codes must be uppercase A–Z")
  .describe("A 4-letter ICAO airport code (e.g. KJFK)");

export const EstimateFlightDetailsInputSchema = z.object({
  origin:      IcaoCode.describe("Origin ICAO code"),
  destination: IcaoCode.describe("Destination ICAO code"),
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
