
// src/ai/flows/estimate-flight-details-flow.ts
'use server';
/**
 * @fileOverview An AI agent that estimates flight details like mileage and flight time.
 *
 * - estimateFlightDetails - A function that estimates flight details.
 * - EstimateFlightDetailsInput - The input type for the estimateFlightDetails function.
 * - EstimateFlightDetailsOutput - The return type for the estimateFlightDetails function.
 */

import {ai} from '@/ai/genkit';
import * as genkit from 'genkit';

const AirportDataSchema = genkit.z.object({
  icao: genkit.z.string().describe('The ICAO code of the airport.'),
  iata: genkit.z.string().optional().describe('The IATA code of the airport.'),
  name: genkit.z.string().describe('The common name of the airport.'),
  city: genkit.z.string().describe('The city where the airport is located.'),
  state: genkit.z.string().optional().describe('The state or region of the airport.'),
  country: genkit.z.string().describe('The country where the airport is located.'),
  lat: genkit.z.number().describe('The latitude of the airport.'),
  lon: genkit.z.number().describe('The longitude of the airport.'),
});

type AirportData = genkit.z.infer<typeof AirportDataSchema>;

const getAirportDataTool = genkit.tool(
  {
    name: 'getAirportData',
    description:
      'Get airport data for a given ICAO code. Use this to find airport locations for distance calculations.',
    input: genkit.z.object({airportCode: genkit.z.string().describe('The ICAO code of the airport (e.g., KJFK, EGLL).')}),
    output: AirportDataSchema,
  },
  async ({airportCode}) => {
    // In a real app, you would fetch this from a database or an external API.
    // For this example, we'll use a hardcoded list.
    const airports: Record<string, AirportData> = {
      KJFK: {
        icao: 'KJFK',
        iata: 'JFK',
        name: 'John F. Kennedy International Airport',
        city: 'New York',
        state: 'New York',
        country: 'USA',
        lat: 40.6398,
        lon: -73.7789,
      },
      KLAX: {
        icao: 'KLAX',
        iata: 'LAX',
        name: 'Los Angeles International Airport',
        city: 'Los Angeles',
        state: 'California',
        country: 'USA',
        lat: 33.9425,
        lon: -118.4081,
      },
      KISM: {
        icao: 'KISM',
        iata: 'ISM',
        name: 'Kissimmee Gateway Airport',
        city: 'Kissimmee',
        state: 'Florida',
        country: 'USA',
        lat: 28.2892,
        lon: -81.4358,
      },
      KIAH: {
        icao: 'KIAH',
        iata: 'IAH',
        name: 'George Bush Intercontinental Airport',
        city: 'Houston',
        state: 'Texas',
        country: 'USA',
        lat: 29.9844,
        lon: -95.3414,
      },
      // Add more airports as needed
    };
    const airport = airports[airportCode.toUpperCase()];
    if (!airport) {
      throw new Error(`Airport with ICAO code ${airportCode} not found.`);
    }
    return airport;
  },
);

// Helper function to calculate great-circle distance
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 3440.065; // Radius of Earth in nautical miles
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * genkit.z.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const EstimateFlightDetailsInputSchema = genkit.z.object({
  origin: genkit.z.string().describe('The origin airport code (e.g., JFK or KJFK).'),
  destination: genkit.z.string().describe('The destination airport code (e.g., LAX or KLAX).'),
  aircraftType: genkit.z.string().describe('The full aircraft type and model (e.g., Cessna Citation CJ3 or N123AB - Cessna Citation CJ3).'),
  knownCruiseSpeedKts: genkit.z.number().optional().describe('A known cruise speed in knots for this specific aircraft, if available. If provided, this speed should be prioritized for calculations and reported as the assumed cruise speed.'),
});
export type EstimateFlightDetailsInput = genkit.z.infer<typeof EstimateFlightDetailsInputSchema>;

const EstimateFlightDetailsOutputSchema = genkit.z.object({
  estimatedMileageNM: genkit.z.number().describe('The estimated flight distance in nautical miles (NM).'),
  estimatedFlightTimeHours: genkit.z.number().describe('The estimated flight time in hours, as a decimal (e.g., 2.5 for 2 hours and 30 minutes).'),
  assumedCruiseSpeedKts: genkit.z.number().describe('The assumed cruise speed in knots (kts) used for the estimation. This should be the knownCruiseSpeedKts if it was provided in the input.'),
  resolvedOriginIcao: genkit.z.string().describe('The resolved ICAO code used for the origin airport.'),
  resolvedOriginName: genkit.z.string().describe('The single, common official name of the resolved origin airport (e.g., "John F. Kennedy International Airport" or "Dayton-Wright Brothers Airport"). Must be concise and not repetitive.'),
  resolvedDestinationIcao: genkit.z.string().describe('The resolved ICAO code used for the destination airport.'),
  resolvedDestinationName: genkit.z.string().describe('The single, common official name of the resolved destination airport (e.g., "Los Angeles International Airport" or "Colorado Plains Regional Airport"). Must be concise and not repetitive.'),
  briefExplanation: genkit.z.string().describe('A very brief, one-sentence explanation of the estimation method (e.g., "Estimated based on direct route and average cruise speed for the aircraft type." or "Estimated based on direct route and provided cruise speed of X kts.").'),
});
export type EstimateFlightDetailsOutput = genkit.z.infer<typeof EstimateFlightDetailsOutputSchema>;

export async function estimateFlightDetails(input: EstimateFlightDetailsInput): Promise<EstimateFlightDetailsOutput> {
  return estimateFlightDetailsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'estimateFlightDetailsPrompt',
  input: {schema: EstimateFlightDetailsInputSchema},
  output: {schema: EstimateFlightDetailsOutputSchema},
  config: {
    temperature: 0.1, 
  },
  tools: [getAirportDataTool],
  prompt: `You are an expert flight operations assistant. Your task is to estimate flight details based on the provided information.

Airport Code Interpretation and Strict Adherence:
- You will be given an origin airport code and a destination airport code.
- **CRITICAL RULE: If an input airport code (origin or destination) is 4 letters long (e.g., KJFK, KAKO), you MUST assume it is an ICAO code. All your information retrieval (airport name, location for distance calculation) and subsequent calculations for that airport MUST be based SOLELY and EXACTLY on THIS GIVEN 4-LETTER ICAO CODE. Do not substitute it or get confused by similar names or other airports in similarly named cities.** For example, if the input is 'KAKO', all details and calculations must relate to KAKO (Colorado Plains Regional Airport), NOT KAKR (Akron-Fulton International Airport, Ohio). The \`resolvedOriginIcao\` and \`resolvedDestinationIcao\` fields in your output MUST match these input ICAO codes if they were 4 letters.
- If an input airport code is 3 letters long (e.g., JFK, LHR), assume it is an IATA code.
    - For US airports, prefix 'K' to the 3-letter IATA code to derive the ICAO code (e.g., JFK becomes KJFK, LAX becomes KLAX). Use this derived K-prefixed ICAO for all subsequent steps.
    - For non-US airports, use the most common ICAO equivalent for the given IATA code (e.g., LHR becomes EGLL). Use this derived ICAO.
- Perform your distance and time estimations based on these strictly determined ICAO codes.

**CRITICALLY IMPORTANT FOR AIRPORT NAMES:**
For 'resolvedOriginName' and 'resolvedDestinationName', provide **ONLY the single, most common official airport name associated with the ICAO code you have determined according to the rules above.**
    - Example for "JFK" (resolves to KJFK): "John F. Kennedy International Airport".
    - Example for "MGY" (input is MGY, resolves to KMGY): "Dayton-Wright Brothers Airport".
    - Example for "KAKO" (input is KAKO): "Colorado Plains Regional Airport".
    - **The name output for these fields MUST be ONLY the airport's name. Do NOT repeat the airport name, ICAO code, city, state, country, or any other descriptive text within these specific name fields.**
    - **If the input is "GDK", the output for 'resolvedOriginName' should be "Gardner Municipal Airport", and nothing more.**

Aircraft Type: {{{aircraftType}}}
Origin Input: {{{origin}}}
Destination Input: {{{destination}}}

{{#if knownCruiseSpeedKts}}
A specific cruise speed of {{{knownCruiseSpeedKts}}} knots has been provided for this aircraft. Please use this speed for your calculations.
Your brief explanation should reflect this. For example: "Estimated based on a direct route and a provided cruise speed of {{{knownCruiseSpeedKts}}} kts."
The assumedCruiseSpeedKts in your output MUST be {{{knownCruiseSpeedKts}}}.
{{else}}
Consider typical cruise speeds for the given aircraft type if no specific cruise speed is provided.
Your brief explanation should reflect this. For example: "Estimated based on a direct route and an average cruise speed of XXX kts for the aircraft type."
The assumedCruiseSpeedKts in your output should be your best estimate for the aircraft type.
{{/if}}

Output fields required:
- estimatedMileageNM: Estimated flight distance in nautical miles (NM), calculated based on the strictly determined ICAO codes.
- estimatedFlightTimeHours: Estimated flight time in hours (e.g., 2.5 for 2 hours 30 minutes), based on the strictly determined ICAO codes and aircraft speed.
- assumedCruiseSpeedKts: The assumed cruise speed in knots (kts) used.
- resolvedOriginIcao: The ICAO code used for the origin, strictly adhering to the rules above.
- resolvedOriginName: The single, common official airport name for the resolvedOriginIcao.
- resolvedDestinationIcao: The ICAO code used for the destination, strictly adhering to the rules above.
- resolvedDestinationName: The single, common official airport name for the resolvedDestinationIcao.
- briefExplanation: A very brief, one-sentence explanation of the estimation method.

Return the data strictly in the specified JSON output format.
Example for a request (KJFK to KLAX, Cessna Citation CJ3, knownCruiseSpeedKts: 410):
{
  "estimatedMileageNM": 2150,
  "estimatedFlightTimeHours": 5.24,
  "assumedCruiseSpeedKts": 410,
  "resolvedOriginIcao": "KJFK",
  "resolvedOriginName": "John F. Kennedy International Airport",
  "resolvedDestinationIcao": "KLAX",
  "resolvedDestinationName": "Los Angeles International Airport",
  "briefExplanation": "Estimated based on a direct route and a provided cruise speed of 410 kts."
}
Example for a request (KAKO to KDEN, Piper Archer, no knownCruiseSpeedKts):
{
  "estimatedMileageNM": 75,
  "estimatedFlightTimeHours": 0.7,
  "assumedCruiseSpeedKts": 110,
  "resolvedOriginIcao": "KAKO",
  "resolvedOriginName": "Colorado Plains Regional Airport",
  "resolvedDestinationIcao": "KDEN",
  "resolvedDestinationName": "Denver International Airport",
  "briefExplanation": "Estimated based on a direct route and an average cruise speed of 110 kts for a Piper Archer."
}
Example for GDK (Gardner Municipal Airport): If origin is GDK, resolvedOriginName must be "Gardner Municipal Airport".
Provide realistic estimates based *only* on the correctly identified airports.
`,
});

function cleanupAirportName(name: string): string {
  if (!name) return 'N/A';
  let cleanedName = name;

  // Attempt to get the part before " - " if it exists and looks substantial
  const hyphenIndex = cleanedName.indexOf(" - ");
  if (hyphenIndex !== -1) {
    const partBeforeHyphen = cleanedName.substring(0, hyphenIndex).trim();
    if (partBeforeHyphen.length > 3) { // Heuristic: avoid just codes
      cleanedName = partBeforeHyphen;
    }
  }

  // If the name still contains parentheses, take the part before the first one
  const parenthesisIndex = cleanedName.indexOf(" (");
  if (parenthesisIndex !== -1) {
    cleanedName = cleanedName.substring(0, parenthesisIndex).trim();
  }
  
  // Additional cleanup: if it ends with " Airport Airport", remove the duplicate " Airport"
  if (cleanedName.endsWith(" Airport Airport")) {
    cleanedName = cleanedName.substring(0, cleanedName.length - " Airport".length);
  }

  // Fallback for excessively long names that might have slipped through
  if (cleanedName.length > 70) {
    const firstSentenceEnd = cleanedName.indexOf(". ");
    if (firstSentenceEnd !== -1 && firstSentenceEnd < 70) {
        cleanedName = cleanedName.substring(0, firstSentenceEnd);
    } else {
        // Try to find a comma if no period
        const firstCommaEnd = cleanedName.indexOf(", ");
         if (firstCommaEnd !== -1 && firstCommaEnd < 70) {
            cleanedName = cleanedName.substring(0, firstCommaEnd);
        } else {
            cleanedName = cleanedName.substring(0, 67) + "...";
        }
    }
  }
  return cleanedName.trim() || 'N/A';
}

const estimateFlightDetailsFlow = ai.defineFlow(
  {
    name: 'estimateFlightDetailsFlow',
    inputSchema: EstimateFlightDetailsInputSchema,
    outputSchema: EstimateFlightDetailsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error("The AI model did not return an output for flight detail estimation.");
    }

    const [originData, destinationData] = await Promise.all([
      getAirportDataTool.run({airportCode: output.resolvedOriginIcao}),
      getAirportDataTool.run({airportCode: output.resolvedDestinationIcao}),
    ]);

    const distance = haversineDistance(
      originData.lat,
      originData.lon,
      destinationData.lat,
      destinationData.lon,
    );
    output.estimatedMileageNM = Math.round(distance);
    
    if (output.assumedCruiseSpeedKts > 0) {
      output.estimatedFlightTimeHours =
        Math.round((distance / output.assumedCruiseSpeedKts) * 100) / 100;
    } else {
      output.estimatedFlightTimeHours = 0;
    }
    
    // Ensure the AI respects the knownCruiseSpeedKts if provided
    if (input.knownCruiseSpeedKts && output.assumedCruiseSpeedKts !== input.knownCruiseSpeedKts) {
        console.warn(`AI output assumed speed ${output.assumedCruiseSpeedKts} kts, but known speed was ${input.knownCruiseSpeedKts} kts. Overriding to known speed.`);
        output.assumedCruiseSpeedKts = input.knownCruiseSpeedKts;
    }

    // Post-process airport names for conciseness
    output.resolvedOriginName = cleanupAirportName(output.resolvedOriginName);
    output.resolvedDestinationName = cleanupAirportName(output.resolvedDestinationName);
    
    return output;
  }
);
