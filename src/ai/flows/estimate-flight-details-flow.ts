'use server';

import { ai } from '@/ai/genkit';
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
  prompt: `
You are an expert flight-ops assistant. You will ONLY ever accept valid 4-letter ICAO codes.
  
1. ORIGIN & DESTINATION must be output verbatim in \`resolved...Icao\`.
2. You MUST look up the single official airport name and exact lat/lon for each code.
3. If you CANNOT find EXACT matches for those ICAO codes, or if you attempt to substitute anything, you MUST instead return a JSON object with an "error" field and NO other data.

Origin Input: {{{origin}}}
Destination Input: {{{destination}}}

{{#if knownCruiseSpeedKts}}
Use the provided cruise speed of {{{knownCruiseSpeedKts}}} kts.
{{else}}
Use a typical cruise speed for the aircraft type.
{{/if}}

Output EXACTLY in this JSON schema or else return:
{ "error": "Could not resolve ICAO code XYZ1" }
`,
});

export async function estimateFlightDetails(
  input: EstimateFlightDetailsInput
): Promise<EstimateFlightDetailsOutput> {
  // 2) Run the AI
  const { output } = await prompt(input);

  // Check for custom error object from the prompt
  if (output && 'error' in (output as any)) {
      throw new Error(`Airport resolution failed: ${(output as any).error}`);
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

  return output;
}

// Re-export types so client components can import them from the flow file
export type { EstimateFlightDetailsInput, EstimateFlightDetailsOutput };
