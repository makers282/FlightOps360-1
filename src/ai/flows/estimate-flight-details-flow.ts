
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
import {z} from 'genkit';

const EstimateFlightDetailsInputSchema = z.object({
  origin: z.string().describe('The origin airport code (e.g., JFK or KJFK).'),
  destination: z.string().describe('The destination airport code (e.g., LAX or KLAX).'),
  aircraftType: z.string().describe('The full aircraft type and model (e.g., Cessna Citation CJ3 or N123AB - Cessna Citation CJ3).'),
  knownCruiseSpeedKts: z.number().optional().describe('A known cruise speed in knots for this specific aircraft, if available. If provided, this speed should be prioritized for calculations and reported as the assumed cruise speed.'),
});
export type EstimateFlightDetailsInput = z.infer<typeof EstimateFlightDetailsInputSchema>;

const EstimateFlightDetailsOutputSchema = z.object({
  estimatedMileageNM: z.number().describe('The estimated flight distance in nautical miles (NM).'),
  estimatedFlightTimeHours: z.number().describe('The estimated flight time in hours, as a decimal (e.g., 2.5 for 2 hours and 30 minutes).'),
  assumedCruiseSpeedKts: z.number().describe('The assumed cruise speed in knots (kts) used for the estimation. This should be the knownCruiseSpeedKts if it was provided in the input.'),
  resolvedOriginIcao: z.string().describe('The resolved ICAO code used for the origin airport.'),
  resolvedOriginName: z.string().describe('The single, common official name of the resolved origin airport (e.g., "John F. Kennedy International Airport" or "Dayton-Wright Brothers Airport"). Must be concise and not repetitive.'),
  resolvedDestinationIcao: z.string().describe('The resolved ICAO code used for the destination airport.'),
  resolvedDestinationName: z.string().describe('The single, common official name of the resolved destination airport (e.g., "Los Angeles International Airport"). Must be concise and not repetitive.'),
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

Given an origin airport, a destination airport, and an aircraft type.

Airport Code Interpretation:
- If a 4-letter code is provided (e.g., KJFK, EGLL), assume it is an ICAO code. Use this code directly.
- If a 3-letter code is provided (e.g., JFK, LHR), assume it is an IATA code.
    - For US airports, prefix 'K' to the 3-letter IATA code to derive the ICAO code (e.g., JFK becomes KJFK, LAX becomes KLAX).
    - For non-US airports, use the most common ICAO equivalent for the given IATA code (e.g., LHR becomes EGLL).
- Perform your distance and time estimations based on these resolved ICAO codes.

**CRITICALLY IMPORTANT FOR AIRPORT NAMES:**
For 'resolvedOriginName' and 'resolvedDestinationName', provide **ONLY the single, most common official airport name**.
    - Example for "JFK" input: "John F. Kennedy International Airport".
    - Example for "MGY" input: "Dayton-Wright Brothers Airport".
    - Example for "GDK" input: "Gardner Municipal Airport".
    - **The name output for these fields MUST be ONLY the airport's name. Do NOT repeat the airport name, ICAO code, city, state, country, or any other descriptive text within these specific name fields.**
    - **If the input is "GDK", the output for 'resolvedOriginName' should be "Gardner Municipal Airport", and nothing more.**

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

Output fields required:
- estimatedMileageNM: Estimated flight distance in nautical miles (NM).
- estimatedFlightTimeHours: Estimated flight time in hours (e.g., 2.5 for 2 hours 30 minutes).
- assumedCruiseSpeedKts: The assumed cruise speed in knots (kts) used.
- resolvedOriginIcao: The ICAO code used for the origin.
- resolvedOriginName: The single, common official airport name for the origin.
- resolvedDestinationIcao: The ICAO code used for the destination.
- resolvedDestinationName: The single, common official airport name for the destination.
- briefExplanation: A very brief, one-sentence explanation of the estimation method.

Return the data strictly in the specified JSON output format.
Example for a request (KJFK to KLAX, Cessna Citation CJ3, knownCruiseSpeedKts: 410):
{
  "estimatedMileageNM": 2150,
  "estimatedFlightTimeHours": 5.24,
  "assumedCruiseSpeedKts": 410,
  "resolvedOriginIcao": "KJFK",
  "resolvedOriginName": "John F. Kennedy International Airport",
  "resolvedDestinationIcao": "KLAX",
  "resolvedDestinationName": "Los Angeles International Airport",
  "briefExplanation": "Estimated based on a direct route and a provided cruise speed of 410 kts."
}
Example for a request (MGY to KISM, Piper Archer, no knownCruiseSpeedKts):
{
  "estimatedMileageNM": 300,
  "estimatedFlightTimeHours": 2.5,
  "assumedCruiseSpeedKts": 120,
  "resolvedOriginIcao": "KMGY",
  "resolvedOriginName": "Dayton-Wright Brothers Airport",
  "resolvedDestinationIcao": "KISM",
  "resolvedDestinationName": "Kissimmee Gateway Airport",
  "briefExplanation": "Estimated based on a direct route and an average cruise speed of 120 kts for a Piper Archer."
}
Example for GDK (Gardner Municipal Airport): If origin is GDK, resolvedOriginName must be "Gardner Municipal Airport".
Provide realistic estimates.
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
    // Ensure the AI respects the knownCruiseSpeedKts if provided
    if (input.knownCruiseSpeedKts && output.assumedCruiseSpeedKts !== input.knownCruiseSpeedKts) {
        // Optionally, force it or log a warning if AI deviates despite instruction.
        // For now, we assume the prompt is strong enough.
        console.warn(`AI output assumed speed ${output.assumedCruiseSpeedKts} kts, but known speed was ${input.knownCruiseSpeedKts} kts.`);
    }
    return output;
  }
);

