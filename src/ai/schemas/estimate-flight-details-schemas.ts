/**
 * @fileOverview Zod schemas and TypeScript types for flight detail estimation.
 * This file does not use the 'use server' directive and can be safely imported by clients.
 */
import { z } from 'zod';

export const EstimateFlightDetailsInputSchema = z.object({
  origin: z.string().describe('The origin airport code (e.g., JFK or KJFK).'),
  destination: z.string().describe('The destination airport code (e.g., LAX or KLAX).'),
  aircraftType: z.string().describe('The full aircraft type and model (e.g., Cessna Citation CJ3 or N123AB - Cessna Citation CJ3).'),
  knownCruiseSpeedKts: z.number().optional().describe('A known cruise speed in knots for this specific aircraft, if available. If provided, this speed should be prioritized for calculations and reported as the assumed cruise speed.'),
});
export type EstimateFlightDetailsInput = z.infer<typeof EstimateFlightDetailsInputSchema>;

export const EstimateFlightDetailsOutputSchema = z.object({
  estimatedMileageNM: z.number().describe('The estimated flight distance in nautical miles (NM). This value will be calculated by the flow after the AI returns coordinates.'),
  estimatedFlightTimeHours: z.number().describe('The estimated flight time in hours, as a decimal (e.g., 2.5 for 2 hours and 30 minutes). This value will be calculated by the flow after the AI returns coordinates and speed.'),
  assumedCruiseSpeedKts: z.number().describe('The assumed cruise speed in knots (kts) used for the estimation. This should be the knownCruiseSpeedKts if it was provided in the input, otherwise it is the AI\'s best estimate for the aircraft type.'),
  resolvedOriginIcao: z.string().describe('The resolved ICAO code used for the origin airport.'),
  resolvedOriginName: z.string().describe('The single, a common official name of the resolved origin airport (e.g., "John F. Kennedy International Airport" or "Dayton-Wright Brothers Airport"). Must be concise and not repetitive.'),
  originLat: z.number().describe("The latitude of the resolved origin airport."),
  originLon: z.number().describe("The longitude of the resolved origin airport."),
  resolvedDestinationIcao: z.string().describe('The resolved ICAO code used for the destination airport.'),
  resolvedDestinationName: z.string().describe('The single, a common official name of the resolved destination airport (e.g., "Los Angeles International Airport" or "Colorado Plains Regional Airport"). Must be concise and not repetitive.'),
  destinationLat: z.number().describe("The latitude of the resolved destination airport."),
  destinationLon: z.number().describe("The longitude of the resolved destination airport."),
  briefExplanation: z.string().describe('A very brief, one-sentence explanation of the estimation method (e.g., "Estimated based on direct route and average cruise speed for the aircraft type." or "Estimated based on direct route and provided cruise speed of X kts.").'),
});
export type EstimateFlightDetailsOutput = z.infer<typeof EstimateFlightDetailsOutputSchema>;
