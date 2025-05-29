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


// The exported wrapper function that client calls
export async function fetchFbosForAirport(input: FetchFbosInput): Promise<FetchFbosOutput> {
  console.log('[fetchFbosForAirport WRAPPER SERVER DEBUG] Entered wrapper with input:', JSON.stringify(input));
  try {
    // Directly call the flow, which now internally returns mock data
    const result = await fetchFbosFlow(input); 
    console.log('[fetchFbosForAirport WRAPPER SERVER DEBUG] Result from flow:', JSON.stringify(result));
    return result;
  } catch (error) {
    console.error('[fetchFbosForAirport WRAPPER SERVER DEBUG] Error calling flow:', error);
    // It's crucial to return something that matches FetchFbosOutput type on error
    // or throw the error if the client is expected to handle it.
    // For now, returning empty array to match expected output type.
    return []; 
  }
}

// Define the Genkit flow
const fetchFbosFlow = ai.defineFlow(
  {
    name: 'fetchFbosFlowInternal', // Renamed to avoid potential conflicts if an old version is cached
    inputSchema: GetFbosForAirportInputSchema, 
    outputSchema: z.array(FboSchema),      
  },
  async (input) => {
    console.log('[fetchFbosFlow GENKIT FLOW SERVER DEBUG] Flow handler entered with input:', JSON.stringify(input));
    // TEMPORARY: Directly return mock data from within the flow's handler
    const mockFboResponse: FetchFbosOutput = [
      {
        id: `${input.airportCode}-FLOW-DEBUG-FBO-1`,
        name: `Flow Debug FBO One for ${input.airportCode}`,
        airportCode: input.airportCode.toUpperCase(),
        contactPhone: '555-FLOW-1',
        fuelTypes: ['Jet A-FlowDebug'],
        services: ['Flow Debugging Service'],
        fees: [{ type: 'Flow Debug Fee', amount: 100, notes: "For flow testing" }],
      },
      {
        id: `${input.airportCode}-FLOW-DEBUG-FBO-2`,
        name: `Flow Debug FBO Two for ${input.airportCode}`,
        airportCode: input.airportCode.toUpperCase(),
        contactPhone: '555-FLOW-2',
        fuelTypes: ['100LL-FlowDebug'],
        services: ['More Flow Debugging'],
        fees: [{ type: 'Flow Debug Fee', amount: 200 }],
      }
    ];
    console.log('[fetchFbosFlow GENKIT FLOW SERVER DEBUG] Flow handler returning MOCK:', JSON.stringify(mockFboResponse));
    return mockFboResponse;
  }
);
