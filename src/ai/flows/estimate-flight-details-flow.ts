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
  prompt: `You are an expert flight operations assistant. Your task is to estimate flight details based on the provided information.

Given an origin airport (ICAO/IATA code), a destination airport (ICAO/IATA code), and an aircraft type.

Aircraft Type: {{{aircraftType}}}
Origin: {{{origin}}}
Destination: {{{destination}}}

{{#if knownCruiseSpeedKts}}
A specific cruise speed of {{{knownCruiseSpeedKts}}} knots has been provided for this aircraft. Please use this speed for your calculations.
Your brief explanation should reflect this. For example: "Estimated based on direct route and a provided cruise speed of {{{knownCruiseSpeedKts}}} kts."
The assumedCruiseSpeedKts in your output MUST be {{{knownCruiseSpeedKts}}}.
{{else}}
Consider typical cruise speeds for the given aircraft type if no specific cruise speed is provided.
Your brief explanation should reflect this. For example: "Estimated based on direct route and an average cruise speed of XXX kts for the aircraft type."
The assumedCruiseSpeedKts in your output should be your best estimate for the aircraft type.
{{/if}}

- Provide the estimated flight distance in nautical miles (NM).
- Provide the estimated flight time in hours (e.g., 2.5 for 2 hours 30 minutes).
- State the assumed cruise speed in knots (kts) that you used for the calculation.
- Provide a very brief, one-sentence explanation of your estimation method.

Return the data strictly in the specified JSON output format.
Example for a similar request (KJFK to KLAX, Cessna Citation CJ3, knownCruiseSpeedKts: 410):
{
  "estimatedMileageNM": 2150,
  "estimatedFlightTimeHours": 5.24, 
  "assumedCruiseSpeedKts": 410,
  "briefExplanation": "Estimated based on a direct route and a provided cruise speed of 410 kts."
}
Example for a similar request (KJFK to KLAX, Cessna Citation CJ3, no knownCruiseSpeedKts):
{
  "estimatedMileageNM": 2150,
  "estimatedFlightTimeHours": 5.18,
  "assumedCruiseSpeedKts": 415,
  "briefExplanation": "Estimated based on a direct route and an average cruise speed of 415 kts for a Cessna Citation CJ3."
}
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
