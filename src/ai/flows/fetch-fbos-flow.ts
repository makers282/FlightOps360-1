// src/ai/flows/fetch-fbos-flow.ts
'use server';
/**
 * @fileOverview A Genkit flow to fetch FBO information for an airport.
 * 
 * - fetchFbosForAirport - A function that fetches FBOs for a given airport code.
 * - FetchFbosInput - The input type for the fetchFbosForAirport function.
 * - FetchFbosOutput - The return type for the fetchFbosForAirport function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
// Import the tool definition and schemas directly
import { GetFbosForAirportInputSchema, FboSchema } from '@/ai/tools/get-fbos-tool';

// Define the input type based on the imported schema
export type FetchFbosInput = z.infer<typeof GetFbosForAirportInputSchema>;

// Define the output type based on an array of the imported FboSchema
export type FetchFbosOutput = z.infer<ReturnType<typeof z.array<typeof FboSchema>>>;


export async function fetchFbosForAirport(input: FetchFbosInput): Promise<FetchFbosOutput> {
  console.log('[fetchFbosForAirport DEBUG FLOW] Input:', JSON.stringify(input));
  // TEMPORARY: Directly return mock data to isolate the issue
  const mockFboResponse: FetchFbosOutput = [
    {
      id: `${input.airportCode}-DEBUG-FBO-1`,
      name: `Debug FBO One for ${input.airportCode}`,
      airportCode: input.airportCode.toUpperCase(),
      contactPhone: '555-DEBUG-1',
      fuelTypes: ['Jet A-Debug'],
      services: ['Debugging Service'],
      fees: [{ type: 'Debug Fee', amount: 10, notes: "For testing" }],
    },
    {
      id: `${input.airportCode}-DEBUG-FBO-2`,
      name: `Debug FBO Two for ${input.airportCode}`,
      airportCode: input.airportCode.toUpperCase(),
      contactPhone: '555-DEBUG-2',
      fuelTypes: ['100LL-Debug'],
      services: ['More Debugging Services'],
      fees: [{ type: 'Debug Fee', amount: 20 }],
    }
  ];
  console.log('[fetchFbosForAirport DEBUG FLOW] Returning MOCK:', JSON.stringify(mockFboResponse));
  return Promise.resolve(mockFboResponse); // Ensure it's a promise; it would be anyway with async
}

// Original flow definition commented out for debugging:
/*
const fetchFbosFlow = ai.defineFlow(
  {
    name: 'fetchFbosFlow',
    inputSchema: GetFbosForAirportInputSchema, // Use the imported schema directly
    outputSchema: z.array(FboSchema),      // Use the imported schema directly
  },
  async (input) => {
    console.log('[fetchFbosFlow ORIGINAL] Received input:', JSON.stringify(input));
    try {
      const fbos = await getFbosForAirportTool(input); // Call the imported tool definition
      console.log('[fetchFbosFlow ORIGINAL] FBOs from tool:', JSON.stringify(fbos));
      if (fbos === undefined) {
        console.error('[fetchFbosFlow ORIGINAL] Tool returned undefined! Returning empty array instead.');
        return [];
      }
      return fbos;
    } catch (flowError) {
        console.error('[fetchFbosFlow ORIGINAL] Error executing flow:', flowError);
        return []; // Return empty array on flow error
    }
  }
);
*/
