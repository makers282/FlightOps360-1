
'use server';
/**
 * @fileOverview An AI agent that suggests typical aircraft performance parameters.
 *
 * - suggestAircraftPerformance - A function that suggests performance data.
 * - SuggestAircraftPerformanceInput - The input type for the suggestAircraftPerformance function.
 * - AircraftPerformanceOutput - The return type (matches form data structure).
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Input schema for the flow
const SuggestAircraftPerformanceInputSchema = z.object({
  aircraftName: z.string().describe('The full name or model of the aircraft (e.g., Cessna Citation CJ3, Bombardier Global 6000, Learjet 35).'),
});
export type SuggestAircraftPerformanceInput = z.infer<typeof SuggestAircraftPerformanceInputSchema>;

// Output schema - this should match the AircraftPerformanceFormData in the form
const AircraftPerformanceOutputSchema = z.object({
  takeoffSpeed: z.coerce.number().min(0).optional().describe("Typical takeoff speed in knots (kts)."),
  landingSpeed: z.coerce.number().min(0).optional().describe("Typical landing speed in knots (kts)."),
  climbSpeed: z.coerce.number().min(0).optional().describe("Typical climb speed in knots (kts)."),
  climbRate: z.coerce.number().min(0).optional().describe("Typical climb rate in feet per minute (ft/min)."),
  cruiseSpeed: z.coerce.number().min(0).optional().describe("Typical cruise speed in knots (kts) at cruise altitude."),
  cruiseAltitude: z.coerce.number().min(0).optional().describe("Typical cruise altitude in feet (ft)."),
  descentSpeed: z.coerce.number().min(0).optional().describe("Typical descent speed in knots (kts)."),
  descentRate: z.coerce.number().min(0).optional().describe("Typical descent rate in feet per minute (ft/min)."),
  fuelType: z.string().optional().describe("Common fuel type used (e.g., Jet Fuel, 100LL). MUST be provided if known, e.g., 'Jet Fuel' for most jets."),
  fuelBurn: z.coerce.number().min(0).optional().describe("Typical fuel burn rate at cruise in gallons per hour (GPH) or pounds per hour (PPH) - specify unit implicitly if common."),
  maxRange: z.coerce.number().min(0).optional().describe("Maximum flight range in nautical miles (NM)."),
  maxAllowableTakeoffWeight: z.coerce.number().min(0).optional().describe("Maximum Allowable Takeoff Weight (MTOW) in pounds (lbs)."),
});
export type AircraftPerformanceOutput = z.infer<typeof AircraftPerformanceOutputSchema>;

export async function suggestAircraftPerformance(input: SuggestAircraftPerformanceInput): Promise<AircraftPerformanceOutput> {
  return suggestAircraftPerformanceFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestAircraftPerformancePrompt',
  input: {schema: SuggestAircraftPerformanceInputSchema},
  output: {schema: AircraftPerformanceOutputSchema},
  config: { // Added config to set temperature
    temperature: 0.2, 
  },
  prompt: `You are an expert aviation performance specialist. For the aircraft model "{{aircraftName}}", provide typical performance parameters.
All numeric values should be integers. The fuelType for jet aircraft (e.g., Learjet, Citation, Gulfstream, Bombardier) MUST be "Jet Fuel".

Provide estimates for:
- takeoffSpeed (integer, kts)
- landingSpeed (integer, kts)
- climbSpeed (integer, kts)
- climbRate (integer, ft/min)
- cruiseSpeed (integer, kts at typical cruise altitude)
- cruiseAltitude (integer, ft)
- descentSpeed (integer, kts)
- descentRate (integer, ft/min)
- fuelType (string, e.g., "Jet Fuel", "Avgas").
- fuelBurn (integer, common unit like GPH or PPH)
- maxRange (integer, nautical miles)
- maxAllowableTakeoffWeight (integer, pounds)

If a specific numeric value is not commonly known or varies too widely, you may omit it.
Return ONLY the JSON object in the specified output format.

Example for "Learjet 35":
{
  "takeoffSpeed": 120,
  "landingSpeed": 105,
  "climbSpeed": 250,
  "climbRate": 4500,
  "cruiseSpeed": 430,
  "cruiseAltitude": 45000,
  "descentSpeed": 280,
  "descentRate": 2500,
  "fuelType": "Jet Fuel",
  "fuelBurn": 220,
  "maxRange": 2000,
  "maxAllowableTakeoffWeight": 18300
}

Example for "Cessna Citation CJ3":
{
  "takeoffSpeed": 100,
  "landingSpeed": 95,
  "climbSpeed": 200,
  "climbRate": 3500,
  "cruiseSpeed": 415,
  "cruiseAltitude": 45000,
  "descentSpeed": 250,
  "descentRate": 2000,
  "fuelType": "Jet Fuel",
  "fuelBurn": 150,
  "maxRange": 1800,
  "maxAllowableTakeoffWeight": 13870
}

Aircraft: {{{aircraftName}}}
Output JSON:
`,
});

const suggestAircraftPerformanceFlow = ai.defineFlow(
  {
    name: 'suggestAircraftPerformanceFlow',
    inputSchema: SuggestAircraftPerformanceInputSchema,
    outputSchema: AircraftPerformanceOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error("The AI model did not return an output for aircraft performance suggestion.");
    }
    // Client-side form will handle rounding for display if needed,
    // but prompt now requests integers.
    return output;
  }
);

