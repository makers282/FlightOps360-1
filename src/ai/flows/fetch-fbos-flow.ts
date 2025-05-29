// src/ai/flows/fetch-fbos-flow.ts
'use server';
/**
 * @fileOverview A Genkit flow to fetch FBO information for an airport. (Temporarily simplified for debugging)
 *
 * - fetchFbosForAirport - A function that fetches FBOs for a given airport code.
 * - FetchFbosInput - The input type for the fetchFbosForAirport function.
 * - FetchFbosOutput - The return type for the fetchFbosForAirport function.
 */

import { z } from 'genkit'; // Keep z for types

// Define FBO Fee Schema directly for this test
const FboFeeSchema = z.object({
  type: z.string().describe("Type of fee, e.g., Parking, Handling, Ramp"),
  amount: z.number().describe("Cost of the fee"),
  notes: z.string().optional().describe("Additional notes about the fee"),
});

// Define FBO Schema directly for this test
const FboSchema = z.object({
  id: z.string().describe("Unique identifier for the FBO"),
  name: z.string().describe("Name of the FBO"),
  airportCode: z.string().describe("Airport code where the FBO is located"),
  contactPhone: z.string().optional().describe("Primary contact phone number"),
  fuelTypes: z.array(z.string()).optional().describe("Types of fuel available, e.g., Jet A, 100LL"),
  services: z.array(z.string()).optional().describe("List of services offered"),
  fees: z.array(FboFeeSchema).optional().describe("List of applicable fees"),
});

// Define the input type based on the simplified schema
const FetchFbosInputSchema = z.object({
  airportCode: z.string().min(3).max(5).describe('The ICAO or IATA code of the airport (e.g., KJFK or JFK).'),
});
export type FetchFbosInput = z.infer<typeof FetchFbosInputSchema>;

// Define the output type based on an array of the simplified FboSchema
export type FetchFbosOutput = z.infer<ReturnType<typeof z.array<typeof FboSchema>>>;


// The exported wrapper function that client calls
export async function fetchFbosForAirport(input: FetchFbosInput): Promise<FetchFbosOutput> {
  console.log('[fetchFbosForAirport SERVER DEBUG - DIRECT RETURN] Entered function with input:', JSON.stringify(input));

  // TEMPORARY: Directly return mock data from within the function
  const mockFboResponse: FetchFbosOutput = [
    {
      id: `${input.airportCode}-DIRECT-DEBUG-FBO-1`,
      name: `Direct Debug FBO One for ${input.airportCode}`,
      airportCode: input.airportCode.toUpperCase(),
      contactPhone: '555-DIRECT-1',
      fuelTypes: ['Jet A-DirectDebug'],
      services: ['Direct Debugging Service'],
      fees: [{ type: 'Direct Debug Fee', amount: 100, notes: "For direct testing" }],
    },
    {
      id: `${input.airportCode}-DIRECT-DEBUG-FBO-2`,
      name: `Direct Debug FBO Two for ${input.airportCode}`,
      airportCode: input.airportCode.toUpperCase(),
      contactPhone: '555-DIRECT-2',
      fuelTypes: ['100LL-DirectDebug'],
      services: ['More Direct Debugging'],
      fees: [{ type: 'Direct Debug Fee', amount: 200 }],
    }
  ];
  console.log('[fetchFbosForAirport SERVER DEBUG - DIRECT RETURN] Returning MOCK:', JSON.stringify(mockFboResponse));
  return mockFboResponse;
}

// Original Genkit flow and tool related code is commented out below for this debugging step
/*
import {ai} from '@/ai/genkit';
import { GetFbosForAirportInputSchema as ToolInputSchema, FboSchema as ToolFboSchema } from '@/ai/tools/get-fbos-tool'; // Original imports

// Define the input type based on the imported schema
// export type FetchFbosInput = z.infer<typeof ToolInputSchema>;

// Define the output type based on an array of the imported FboSchema
// export type FetchFbosOutput = z.infer<ReturnType<typeof z.array<typeof ToolFboSchema>>>;


// The exported wrapper function that client calls
// export async function fetchFbosForAirport(input: FetchFbosInput): Promise<FetchFbosOutput> {
//   console.log('[fetchFbosForAirport WRAPPER SERVER DEBUG] Entered wrapper with input:', JSON.stringify(input));
//   try {
//     // Directly call the flow, which now internally returns mock data
//     const result = await fetchFbosFlow(input);
//     console.log('[fetchFbosForAirport WRAPPER SERVER DEBUG] Result from flow:', JSON.stringify(result));
//     return result;
//   } catch (error) {
//     console.error('[fetchFbosForAirport WRAPPER SERVER DEBUG] Error calling flow:', error);
//     return [];
//   }
// }

// Define the Genkit flow
// const fetchFbosFlow = ai.defineFlow(
//   {
//     name: 'fetchFbosFlowInternal', // Renamed to avoid potential conflicts if an old version is cached
//     inputSchema: ToolInputSchema,
//     outputSchema: z.array(ToolFboSchema),
//   },
//   async (input) => {
//     console.log('[fetchFbosFlow GENKIT FLOW SERVER DEBUG] Flow handler entered with input:', JSON.stringify(input));
//     // TEMPORARY: Directly return mock data from within the flow's handler
//     const mockFboResponse: FetchFbosOutput = [
//       {
//         id: `${input.airportCode}-FLOW-DEBUG-FBO-1`,
//         name: `Flow Debug FBO One for ${input.airportCode}`,
//         airportCode: input.airportCode.toUpperCase(),
//         contactPhone: '555-FLOW-1',
//         fuelTypes: ['Jet A-FlowDebug'],
//         services: ['Flow Debugging Service'],
//         fees: [{ type: 'Flow Debug Fee', amount: 100, notes: "For flow testing" }],
//       },
//       {
//         id: `${input.airportCode}-FLOW-DEBUG-FBO-2`,
//         name: `Flow Debug FBO Two for ${input.airportCode}`,
//         airportCode: input.airportCode.toUpperCase(),
//         contactPhone: '555-FLOW-2',
//         fuelTypes: ['100LL-FlowDebug'],
//         services: ['More Flow Debugging'],
//         fees: [{ type: 'Flow Debug Fee', amount: 200 }],
//       }
//     ];
//     console.log('[fetchFbosFlow GENKIT FLOW SERVER DEBUG] Flow handler returning MOCK:', JSON.stringify(mockFboResponse));
//     return mockFboResponse;
//   }
// );
*/
