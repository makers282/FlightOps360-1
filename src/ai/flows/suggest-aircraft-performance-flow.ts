
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
  prompt: `You are an expert aviation performance specialist.
Your task is to provide a comprehensive set of typical aircraft performance parameters for the given aircraft model.
Strive to fill as many fields as possible based on your general aviation knowledge and typical values for the aircraft class if specific data is not readily available. Ensure all numeric values are integers.

Aircraft Model: {{{aircraftName}}}

Provide estimates for the following parameters. Numeric values should be integers.
- takeoffSpeed (kts)
- landingSpeed (kts)
- climbSpeed (kts)
- climbRate (ft/min)
- cruiseSpeed (kts)
- cruiseAltitude (ft)
- descentSpeed (kts)
- descentRate (ft/min)
- fuelType (e.g., "Jet Fuel", "Avgas"). For most jet aircraft (like Learjet, Citation, Gulfstream, Bombardier), this MUST be "Jet Fuel". For piston aircraft, it is typically "Avgas". Provide this value. If truly unknown for a very obscure type, provide "Unknown".
- fuelBurn (gallons per hour or pounds per hour - common unit for the type)
- maxRange (nautical miles)
- maxAllowableTakeoffWeight (pounds)

If a specific numeric value is not commonly known or varies too widely, you may omit it, but for fuelType, please provide the most common type.
Return the data strictly in the specified JSON output format.

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

Provide realistic estimates based on common knowledge for the aircraft type.
Ensure all numeric values are integers.
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
    // The Zod schema handles optional fields. Client-side will handle rounding.
    return output;
  }
);

