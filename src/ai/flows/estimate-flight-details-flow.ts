// src/ai/flows/estimate-flight-details-flow.ts
'use server';
/**
 * @fileOverview An AI agent that estimates flight details like mileage and flight time.
 *
 * - estimateFlightDetails - A function that estimates flight details.
 * - EstimateFlightDetailsInput - The input type for the estimateFlightDetails function.
 * - EstimateFlightDetailsOutput - The return type for the estimateFlightDetails function.
 */

import {ai} from '@/ai/genkit';
import * as z from 'zod';

// Helper function to calculate great-circle distance
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 3440.065; // Radius of Earth in nautical miles
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const EstimateFlightDetailsInputSchema = z.object({
  origin: z.string().describe('The origin airport code (e.g., JFK or KJFK).'),
  destination: z.string().describe('The destination airport code (e.g., LAX or KLAX).'),
  aircraftType: z.string().describe('The full aircraft type and model (e.g., Cessna Citation CJ3 or N123AB - Cessna Citation CJ3).'),
  knownCruiseSpeedKts: z.number().optional().describe('A known cruise speed in knots for this specific aircraft, if available. If provided, this speed should be prioritized for calculations and reported as the assumed cruise speed.'),
});
export type EstimateFlightDetailsInput = z.infer<typeof EstimateFlightDetailsInputSchema>;

const EstimateFlightDetailsOutputSchema = z.object({
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

export async function estimateFlightDetails(input: EstimateFlightDetailsInput): Promise<EstimateFlightDetailsOutput> {
  return estimateFlightDetailsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'estimateFlightDetailsPrompt',
  input: {schema: EstimateFlightDetailsInputSchema},
  output: {schema: EstimateFlightDetailsOutputSchema},
  config: {
    temperature: 0.1, 
  },
  prompt: `You are an expert flight operations assistant. Your primary and most critical task is to accurately identify airports based on provided codes and retrieve their name and geographic coordinates.

**VERY IMPORTANT RULES FOR AIRPORT IDENTIFICATION:**

1.  **4-LETTER CODES ARE ABSOLUTE:** If you are given a 4-letter airport code (e.g., KDAY, KUYF), you MUST treat it as a definitive ICAO code.
    *   All information you find (airport name, latitude, longitude) MUST correspond *exactly* to this given ICAO code.
    *   DO NOT substitute it with a more common airport. DO NOT get confused by similar names or locations.
    *   The \`resolved...Icao\` fields in your output MUST exactly match the 4-letter input code.
    *   **CRITICAL EXAMPLE:** The ICAO code 'KUYF' is Madison County Airport in London, Ohio. It is NOT John Wayne Airport. If the input is 'KUYF', you must provide details for Madison County Airport.

2.  **3-LETTER CODES (IATA):** Only if the input code is 3 letters long (e.g., JFK, LHR), should you treat it as an IATA code and derive the ICAO code.
    *   For US airports, prefix 'K' (e.g., JFK becomes KJFK).
    *   For non-US airports, use the most common ICAO equivalent (e.g., LHR becomes EGLL).

**OUTPUT REQUIREMENTS:**

*   **Airport Names:** For \`resolvedOriginName\` and \`resolvedDestinationName\`, provide ONLY the single, common official name for the resolved ICAO code. Do not add the city, state, or repeat the code in the name field.
*   **Coordinates:** You must find and return the latitude and longitude for the resolved airports.
*   **Calculations:** The \`estimatedMileageNM\` and \`estimatedFlightTimeHours\` fields can be set to 0. They will be recalculated by the system based on the coordinates you provide.

Aircraft Type: {{{aircraftType}}}
Origin Input: {{{origin}}}
Destination Input: {{{destination}}}

{{#if knownCruiseSpeedKts}}
A specific cruise speed of {{{knownCruiseSpeedKts}}} knots has been provided. Use this speed for your calculations. The \`assumedCruiseSpeedKts\` in your output MUST be {{{knownCruiseSpeedKts}}}. Your brief explanation should state that the provided speed was used.
{{else}}
Use a typical cruise speed for the given aircraft type. Your brief explanation should state the assumed speed used.
{{/if}}

Return the data strictly in the specified JSON output format.
`,
});

const estimateFlightDetailsFlow = ai.defineFlow(
  {
    name: 'estimateFlightDetailsFlow',
    inputSchema: EstimateFlightDetailsInputSchema,
    outputSchema: EstimateFlightDetailsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error("The AI model did not return an output for flight detail estimation.");
    }
    
    // Recalculate distance and time based on AI-provided coordinates
    const distance = haversineDistance(
      output.originLat,
      output.originLon,
      output.destinationLat,
      output.destinationLon,
    );
    output.estimatedMileageNM = Math.round(distance);
    
    if (output.assumedCruiseSpeedKts > 0) {
      output.estimatedFlightTimeHours =
        Math.round((distance / output.assumedCruiseSpeedKts) * 100) / 100;
    } else {
      output.estimatedFlightTimeHours = 0;
    }
    
    // Ensure the AI respects the knownCruiseSpeedKts if provided
    if (input.knownCruiseSpeedKts && output.assumedCruiseSpeedKts !== input.knownCruiseSpeedKts) {
        console.warn(`AI output assumed speed ${output.assumedCruiseSpeedKts} kts, but known speed was ${input.knownCruiseSpeedKts} kts. Overriding to known speed.`);
        output.assumedCruiseSpeedKts = input.knownCruiseSpeedKts;
    }
    
    return output;
  }
);
