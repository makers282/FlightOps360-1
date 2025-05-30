
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
  aircraftName: z.string().describe('The full name or model of the aircraft (e.g., Cessna Citation CJ3, Bombardier Global 6000).'),
});
export type SuggestAircraftPerformanceInput = z.infer<typeof SuggestAircraftPerformanceInputSchema>;

// Output schema - this should match the AircraftPerformanceFormData in the form
// For consistency and to avoid import issues if form schema changes, we define it here.
// Ensure this is kept in sync with AircraftPerformanceFormData in the frontend.
const AircraftPerformanceOutputSchema = z.object({
  takeoffSpeed: z.coerce.number().min(0).optional().describe("Typical takeoff speed in knots (kts)."),
  landingSpeed: z.coerce.number().min(0).optional().describe("Typical landing speed in knots (kts)."),
  climbSpeed: z.coerce.number().min(0).optional().describe("Typical climb speed in knots (kts)."),
  climbRate: z.coerce.number().min(0).optional().describe("Typical climb rate in feet per minute (ft/min)."),
  cruiseSpeed: z.coerce.number().min(0).optional().describe("Typical cruise speed in knots (kts) at cruise altitude."),
  cruiseAltitude: z.coerce.number().min(0).optional().describe("Typical cruise altitude in feet (ft)."),
  descentSpeed: z.coerce.number().min(0).optional().describe("Typical descent speed in knots (kts)."),
  descentRate: z.coerce.number().min(0).optional().describe("Typical descent rate in feet per minute (ft/min)."),
  fuelType: z.string().optional().describe("Common fuel type used (e.g., Jet A, 100LL)."),
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
  prompt: `You are an expert aviation performance specialist.
Your task is to provide typical aircraft performance parameters for the given aircraft model.

Aircraft Model: {{{aircraftName}}}

Provide estimates for the following parameters:
- takeoffSpeed (kts)
- landingSpeed (kts)
- climbSpeed (kts)
- climbRate (ft/min)
- cruiseSpeed (kts)
- cruiseAltitude (ft)
- descentSpeed (kts)
- descentRate (ft/min)
- fuelType (e.g., "Jet Fuel", "Avgas")
- fuelBurn (gallons per hour or pounds per hour, common unit for the type)
- maxRange (nautical miles)
- maxAllowableTakeoffWeight (pounds)

If a specific value is not commonly known or varies too widely, you may omit it or provide a reasonable average.
Return the data strictly in the specified JSON output format.

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

Provide realistic estimates based on common knowledge for the aircraft type.
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
    // The AI might return some fields as null/undefined if it can't find them.
    // The Zod schema handles optional fields, so this should be fine.
    return output;
  }
);
