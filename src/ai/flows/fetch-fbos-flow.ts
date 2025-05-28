
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
import { GetFbosForAirportInputSchema, FboSchema, getFbosForAirportTool } from '@/ai/tools/get-fbos-tool';

// Define the input type based on the imported schema
export type FetchFbosInput = z.infer<typeof GetFbosForAirportInputSchema>;

// Define the output type based on an array of the imported FboSchema
export type FetchFbosOutput = z.infer<ReturnType<typeof z.array<typeof FboSchema>>>;


export async function fetchFbosForAirport(input: FetchFbosInput): Promise<FetchFbosOutput> {
  return fetchFbosFlow(input);
}

const fetchFbosFlow = ai.defineFlow(
  {
    name: 'fetchFbosFlow',
    inputSchema: GetFbosForAirportInputSchema, // Use the imported schema directly
    outputSchema: z.array(FboSchema),      // Use the imported schema directly
  },
  async (input) => {
    // This flow directly uses the tool. 
    // In more complex scenarios, it might involve LLM calls that decide to use the tool.
    const fbos = await getFbosForAirportTool(input); // Call the imported tool definition
    return fbos;
  }
);

