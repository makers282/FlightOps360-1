// src/ai/flows/suggest-optimal-route.ts
'use server';
/**
 * @fileOverview An AI agent that suggests the optimal flight route based on weather conditions, air traffic, and aircraft performance data.
 *
 * - suggestOptimalRoute - A function that suggests the optimal flight route.
 * - SuggestOptimalRouteInput - The input type for the suggestOptimalRoute function.
 * - SuggestOptimalRouteOutput - The return type for the suggestOptimalRoute function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestOptimalRouteInputSchema = z.object({
  origin: z.string().describe('The origin airport code (e.g., JFK).'),
  destination: z.string().describe('The destination airport code (e.g., LAX).'),
  aircraftType: z.string().describe('The aircraft type (e.g., Boeing 737-800).'),
  currentWeather: z.string().describe('Current weather conditions along the potential routes.'),
  airTraffic: z.string().describe('Current air traffic conditions along the potential routes.'),
});
export type SuggestOptimalRouteInput = z.infer<typeof SuggestOptimalRouteInputSchema>;

const SuggestOptimalRouteOutputSchema = z.object({
  optimalRoute: z.string().describe('The suggested optimal flight route.'),
  estimatedFuelConsumption: z.number().describe('The estimated fuel consumption for the optimal route in gallons.'),
  estimatedArrivalTime: z.string().describe('The estimated arrival time at the destination.'),
  explanation: z.string().describe('A detailed explanation of why this route is optimal, considering weather, air traffic, and aircraft performance.'),
});
export type SuggestOptimalRouteOutput = z.infer<typeof SuggestOptimalRouteOutputSchema>;

export async function suggestOptimalRoute(input: SuggestOptimalRouteInput): Promise<SuggestOptimalRouteOutput> {
  return suggestOptimalRouteFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestOptimalRoutePrompt',
  input: {schema: SuggestOptimalRouteInputSchema},
  output: {schema: SuggestOptimalRouteOutputSchema},
  prompt: `You are an expert flight dispatcher assistant. Your goal is to suggest the most optimal flight route based on various factors.

You will receive information about the origin, destination, aircraft type, current weather conditions, and air traffic.

Based on this information, suggest the optimal flight route, estimate fuel consumption, and provide an estimated arrival time.

Explain why this route is optimal, considering weather, air traffic, and aircraft performance.

Origin: {{{origin}}}
Destination: {{{destination}}}
Aircraft Type: {{{aircraftType}}}
Current Weather: {{{currentWeather}}}
Air Traffic: {{{airTraffic}}}`,
});

const suggestOptimalRouteFlow = ai.defineFlow(
  {
    name: 'suggestOptimalRouteFlow',
    inputSchema: SuggestOptimalRouteInputSchema,
    outputSchema: SuggestOptimalRouteOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
