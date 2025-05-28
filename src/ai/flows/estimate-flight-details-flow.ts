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
});
export type EstimateFlightDetailsInput = z.infer<typeof EstimateFlightDetailsInputSchema>;

const EstimateFlightDetailsOutputSchema = z.object({
  estimatedMileageNM: z.number().describe('The estimated flight distance in nautical miles (NM).'),
  estimatedFlightTimeHours: z.number().describe('The estimated flight time in hours, as a decimal (e.g., 2.5 for 2 hours and 30 minutes).'),
  assumedCruiseSpeedKts: z.number().describe('The assumed cruise speed in knots (kts) used for the estimation.'),
  briefExplanation: z.string().describe('A very brief, one-sentence explanation of the estimation method (e.g., "Estimated based on direct route and average cruise speed for the aircraft type.").'),
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

Consider typical cruise speeds for the given aircraft type.
- Provide the estimated flight distance in nautical miles (NM).
- Provide the estimated flight time in hours (e.g., 2.5 for 2 hours 30 minutes).
- State the assumed cruise speed in knots (kts) that you used for the calculation.
- Provide a very brief, one-sentence explanation of your estimation method (e.g., "Estimated based on direct route and average cruise speed for the aircraft type.").

Return the data strictly in the specified JSON output format.
Example for a similar request (KJFK to KLAX, Cessna Citation CJ3):
{
  "estimatedMileageNM": 2150,
  "estimatedFlightTimeHours": 5.2,
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
    return output;
  }
);
