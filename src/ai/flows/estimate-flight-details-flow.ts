// src/ai/flows/estimate-flight-details-flow.ts
'use server';

import { ai } from '@/ai/genkit';
import * as z from 'zod';

// 1) Only allow exactly 4 uppercase letters
const IcaoCode = z
  .string()
  .length(4, "Must be exactly 4 letters")
  .regex(/^[A-Z]{4}$/, "ICAO codes must be uppercase A–Z")
  .describe("A 4-letter ICAO airport code (e.g. KJFK)");

export const EstimateFlightDetailsInputSchema = z.object({
  origin:      IcaoCode.describe("Origin ICAO code"),
  destination: IcaoCode.describe("Destination ICAO code"),
  aircraftType: z.string().describe("Full aircraft type/model"),
  knownCruiseSpeedKts: z
    .number()
    .optional()
    .describe("Optional known cruise speed in knots"),
});
export type EstimateFlightDetailsInput = z.infer<typeof EstimateFlightDetailsInputSchema>;

export const EstimateFlightDetailsOutputSchema = z.object({
  resolvedOriginIcao:       z.string(),
  resolvedOriginName:       z.string(),
  originLat:                z.number(),
  originLon:                z.number(),
  resolvedDestinationIcao:  z.string(),
  resolvedDestinationName:  z.string(),
  destinationLat:           z.number(),
  destinationLon:           z.number(),
  estimatedMileageNM:       z.number(),
  estimatedFlightTimeHours: z.number(),
  assumedCruiseSpeedKts:    z.number(),
  briefExplanation:         z.string(),
});
export type EstimateFlightDetailsOutput = z.infer<typeof EstimateFlightDetailsOutputSchema>;

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
