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
  prompt: `You are an expert flight operations assistant. Your task is to estimate flight details based on the provided information.

You will determine the airport ICAO codes and find their geographic coordinates (latitude and longitude).

Airport Code Interpretation and Strict Adherence:
- You will be given an origin airport code and a destination airport code.
- **CRITICAL RULE: If an input airport code (origin or destination) is 4 letters long (e.g., KJFK, KDAY), you MUST assume it is an ICAO code. All your information retrieval (airport name, location) and subsequent data for that airport MUST be based SOLELY and EXACTLY on THIS GIVEN 4-LETTER ICAO CODE. Do not substitute it or get confused by similar names or other airports in similarly named cities.** For example, if the input is 'KDAY', all details and calculations must relate to KDAY (James M. Cox Dayton International Airport). The \`resolvedOriginIcao\` and \`resolvedDestinationIcao\` fields in your output MUST match these input ICAO codes if they were 4 letters.
- If an input airport code is 3 letters long (e.g., JFK, LHR), assume it is an IATA code.
    - For US airports, prefix 'K' to the 3-letter IATA code to derive the ICAO code (e.g., JFK becomes KJFK, LAX becomes KLAX). Use this derived K-prefixed ICAO for all subsequent steps.
    - For non-US airports, use the most common ICAO equivalent for the given IATA code (e.g., LHR becomes EGLL). Use this derived ICAO.

**CRITICALLY IMPORTANT FOR AIRPORT NAMES & COORDINATES:**
- For 'resolvedOriginName' and 'resolvedDestinationName', provide **ONLY the single, most common official airport name associated with the ICAO code you have determined according to the rules above.**
    - Example for "JFK" (resolves to KJFK): "John F. Kennedy International Airport".
    - Example for "KDAY" (input is KDAY): "James M. Cox Dayton International Airport".
- **The name output for these fields MUST be ONLY the airport's name. Do NOT repeat the airport name, ICAO code, city, state, or any other descriptive text within these specific name fields.**
- You must find and return the latitude and longitude for the resolved airports in the 'originLat', 'originLon', 'destinationLat', and 'destinationLon' fields.

Aircraft Type: {{{aircraftType}}}
Origin Input: {{{origin}}}
Destination Input: {{{destination}}}

{{#if knownCruiseSpeedKts}}
A specific cruise speed of {{{knownCruiseSpeedKts}}} knots has been provided for this aircraft. Please use this speed for your calculations.
Your brief explanation should reflect this. For example: "Estimated based on a direct route and a provided cruise speed of {{{knownCruiseSpeedKts}}} kts."
The assumedCruiseSpeedKts in your output MUST be {{{knownCruiseSpeedKts}}}.
{{else}}
Consider typical cruise speeds for the given aircraft type if no specific cruise speed is provided.
Your brief explanation should reflect this. For example: "Estimated based on a direct route and an average cruise speed of XXX kts for the aircraft type."
The assumedCruiseSpeedKts in your output should be your best estimate for the aircraft type.
{{/if}}

The 'estimatedMileageNM' and 'estimatedFlightTimeHours' fields in your output can be set to 0. They will be recalculated by the calling function based on the coordinates you provide.

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
