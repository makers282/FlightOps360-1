'use server';
/**
 * @fileOverview A Genkit flow to fetch FBO information for an airport.
 *
 * - fetchFbosForAirport - A function that fetches FBOs for a given airport code.
 * - FetchFbosInput - The input type for the fetchFbosForAirport function.
 * - FetchFbosOutput - The return type for the fetchFbosForAirport function.
 */
import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getFbosForAirportTool, GetFbosForAirportInputSchema, FboSchema } from '@/ai/tools/get-fbos-tool';

export type FetchFbosInput = z.infer<typeof GetFbosForAirportInputSchema>;
export type FetchFbosOutput = z.infer<ReturnType<typeof z.array<typeof FboSchema>>>;

// The main exported function that client components will call.
export async function fetchFbosForAirport(input: FetchFbosInput): Promise<FetchFbosOutput> {
  return fetchFbosFlow(input);
}

// Define the Genkit flow that uses the FBO tool.
const fetchFbosFlow = ai.defineFlow(
  {
    name: 'fetchFbosFlow',
    inputSchema: GetFbosForAirportInputSchema,
    outputSchema: z.array(FboSchema),
  },
  async (input) => {
    console.log('[fetchFbosFlow] Received request for airport:', input.airportCode);
    
    // The tool can be called directly.
    // In a more complex scenario, you might have an LLM decide whether to call this tool.
    try {
      const fbos = await getFbosForAirportTool.run({ airportCode: input.airportCode });
      console.log(`[fetchFbosFlow] Found ${fbos.length} FBOs for ${input.airportCode}.`);
      return fbos;
    } catch (error) {
      console.error(`[fetchFbosFlow] Error executing getFbosForAirportTool for ${input.airportCode}:`, error);
      // Depending on requirements, you might want to re-throw the error or return an empty array.
      // For a better user experience, returning an empty array might be preferable.
      return [];
    }
  }
);
