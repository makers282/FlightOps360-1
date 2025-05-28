
// src/ai/tools/get-fbos-tool.ts
'use server';
/**
 * @fileOverview A Genkit tool to retrieve FBO information for a given airport.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { getFbosByAirportCode } from '@/services/mockFboService';

export const FboFeeSchema = z.object({
  type: z.string().describe("Type of fee, e.g., Parking, Handling, Ramp"),
  amount: z.number().describe("Cost of the fee"),
  notes: z.string().optional().describe("Additional notes about the fee"),
});
export type FboFee = z.infer<typeof FboFeeSchema>;

export const FboSchema = z.object({
  id: z.string().describe("Unique identifier for the FBO"),
  name: z.string().describe("Name of the FBO"),
  airportCode: z.string().describe("Airport code where the FBO is located"),
  contactPhone: z.string().optional().describe("Primary contact phone number"),
  fuelTypes: z.array(z.string()).optional().describe("Types of fuel available, e.g., Jet A, 100LL"),
  services: z.array(z.string()).optional().describe("List of services offered"),
  fees: z.array(FboFeeSchema).optional().describe("List of applicable fees"),
});
export type Fbo = z.infer<typeof FboSchema>;

export const GetFbosForAirportInputSchema = z.object({
  airportCode: z.string().min(3).max(5).describe('The ICAO or IATA code of the airport (e.g., KJFK or JFK).'),
});
export type GetFbosForAirportInput = z.infer<typeof GetFbosForAirportInputSchema>;

export const getFbosForAirportTool = ai.defineTool(
  {
    name: 'getFbosForAirportTool',
    description: 'Retrieves a list of FBOs (Fixed-Base Operators) and their details for a given airport code.',
    inputSchema: GetFbosForAirportInputSchema,
    outputSchema: z.array(FboSchema),
  },
  async (input) => {
    try {
      const fbos = await getFbosByAirportCode(input.airportCode);
      return fbos;
    } catch (error) {
      console.error(`Error fetching FBOs for ${input.airportCode}:`, error);
      // In a real scenario, you might throw a more specific error or return an empty array
      // depending on how you want the LLM/flow to handle failures.
      return []; 
    }
  }
);
