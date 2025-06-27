'use server';
/**
 * @fileOverview An AI agent that estimates flight details like mileage and flight time.
 *
 * - estimateFlightDetails - A function that estimates flight details.
 * - EstimateFlightDetailsInput - The input type for the estimateFlightDetails function.
 * - EstimateFlightDetailsOutput - The return type for the estimateFlightDetails function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import {
  EstimateFlightDetailsInputSchema,
  EstimateFlightDetailsOutputSchema,
  type EstimateFlightDetailsInput,
  type EstimateFlightDetailsOutput,
} from '@/ai/schemas/estimate-flight-details-schemas';


/**
 * Helper to calculate great-circle distance in NM
 */
function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 3440.065;
  const toRad = (d:number) => d * Math.PI/180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2)**2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

const prompt = ai.definePrompt({
  name: 'estimateFlightDetailsPrompt',
  input:  { schema: EstimateFlightDetailsInputSchema },
  output: { schema: EstimateFlightDetailsOutputSchema },
  config: { temperature: 0.1 },
  prompt: `You are an expert flight operations assistant. Your primary and most critical task is to accurately identify airports based on provided codes and retrieve their name and geographic coordinates.

**VERY IMPORTANT RULES FOR AIRPORT IDENTIFICATION:**

1.  **4-LETTER CODES ARE ABSOLUTE:** If you are given a 4-letter airport code (e.g., KDAY, KUYF), you MUST treat it as a definitive ICAO code.
    *   All information you find (airport name, latitude, longitude) MUST correspond *exactly* to this given ICAO code.
    *   DO NOT substitute it with a more common airport. DO NOT get confused by similar names or locations.
    *   The \`resolved...Icao\` fields in your output MUST exactly match the 4-letter input code.
    *   **CRITICAL EXAMPLE:** The ICAO code 'KUYF' is Madison County Airport in London, Ohio. It is NOT John Wayne Airport. If the input is 'KUYF', you must provide details for Madison County Airport.

2.  **3-LETTER CODES (IATA):** Only if the input code is 3 letters long (e.g., JFK, LHR), should you treat it as an IATA code and derive the ICAO code.
    *   For US airports, prefix 'K' (e.g., JFK becomes KJFK).
    *   For non-US airports, use the most common ICAO equivalent (e.g., LHR becomes EGLL).

**OUTPUT REQUIREMENTS:**

*   **Airport Names:** For \`resolvedOriginName\` and \`resolvedDestinationName\`, provide ONLY the single, common official name for the resolved ICAO code. Do not add the city, state, or repeat the code in the name field.
*   **Coordinates:** You must find and return the latitude and longitude for the resolved airports.
*   **Calculations:** The \`estimatedMileageNM\` and \`estimatedFlightTimeHours\` fields can be set to 0. They will be recalculated by the system based on the coordinates you provide.

Aircraft Type: {{{aircraftType}}}
Origin Input: {{{origin}}}
Destination Input: {{{destination}}}

{{#if knownCruiseSpeedKts}}
Use the provided cruise speed of {{{knownCruiseSpeedKts}}} kts.
{{else}}
Use a typical cruise speed for the aircraft type.
{{/if}}

Output EXACTLY in this JSON schema.
`,
});

const estimateFlightDetailsFlow = ai.defineFlow(
  {
    name: 'estimateFlightDetailsFlow',
    inputSchema: EstimateFlightDetailsInputSchema,
    outputSchema: EstimateFlightDetailsOutputSchema,
  },
  async (input: EstimateFlightDetailsInput) => {
    // 2) Run the AI
    const { output, error } = await prompt(input);
    if (error) {
      throw new Error(`Airport resolution failed: ${error}`);
    }
    if (!output) {
      throw new Error("AI returned no output");
    }
  
    // 3) Recompute distance & time locally
    const dist = haversineDistance(
      output.originLat, output.originLon,
      output.destinationLat, output.destinationLon
    );
    output.estimatedMileageNM       = Math.round(dist);
    const speed = output.assumedCruiseSpeedKts;
    output.estimatedFlightTimeHours = speed > 0
      ? Math.round((dist/speed)*100)/100
      : 0;
      
    if (input.knownCruiseSpeedKts && output.assumedCruiseSpeedKts !== input.knownCruiseSpeedKts) {
        console.warn(`AI output assumed speed ${output.assumedCruiseSpeedKts} kts, but known speed was ${input.knownCruiseSpeedKts} kts. Overriding to known speed.`);
        output.assumedCruiseSpeedKts = input.knownCruiseSpeedKts;
    }
  
    return output;
  }
);


export async function estimateFlightDetails(
  input: EstimateFlightDetailsInput
): Promise<EstimateFlightDetailsOutput> {
  // 1. Pre-process/validate inputs before calling the flow
  const processedInput = {
    ...input,
    origin: input.origin.toUpperCase(),
    destination: input.destination.toUpperCase(),
  };

  return estimateFlightDetailsFlow(processedInput);
}
