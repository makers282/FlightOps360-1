
'use server';
/**
 * @fileOverview Genkit flows for managing aircraft rate configurations using mock in-memory storage.
 * Rates are associated with aircraft from the main fleet.
 *
 * - fetchAircraftRates - Fetches all aircraft rates.
 * - saveAircraftRate - Saves (adds or updates) an aircraft rate.
 * - deleteAircraftRate - Deletes an aircraft rate.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Define the structure for an aircraft rate
// The 'id' here should correspond to an 'id' from the FleetAircraftSchema in manage-fleet-flow.ts
const AircraftRateSchema = z.object({
  id: z.string().describe("The unique identifier for the aircraft from the fleet (e.g., N123AB or a Firestore doc ID)."),
  buy: z.number().min(0).describe("The buy rate per hour for the aircraft."),
  sell: z.number().min(0).describe("The sell rate per hour for the aircraft."),
});
export type AircraftRate = z.infer<typeof AircraftRateSchema>;

// Schemas for flow inputs and outputs
const SaveAircraftRateInputSchema = AircraftRateSchema;
export type SaveAircraftRateInput = z.infer<typeof SaveAircraftRateInputSchema>;

const DeleteAircraftRateInputSchema = z.object({
  aircraftId: z.string().describe("The ID of the aircraft rate to delete (corresponds to fleet aircraft ID)."),
});
export type DeleteAircraftRateInput = z.infer<typeof DeleteAircraftRateInputSchema>;

const FetchAircraftRatesOutputSchema = z.array(AircraftRateSchema);
const SaveAircraftRateOutputSchema = AircraftRateSchema;
const DeleteAircraftRateOutputSchema = z.object({
  success: z.boolean(),
  aircraftId: z.string(),
});

// Mock in-memory storage
let MOCK_AIRCRAFT_RATES_DATA: AircraftRate[] = [
  { id: 'N123AB', buy: 2800, sell: 3200 },
  { id: 'N456CD', buy: 5800, sell: 6500 },
  { id: 'N789EF', buy: 7500, sell: 8500 },
  { id: 'N630MW', buy: 2200, sell: 2600 },
];


// Exported async functions that clients will call
export async function fetchAircraftRates(): Promise<AircraftRate[]> {
  console.log('[ManageAircraftRatesFlow MOCK] Attempting to fetch aircraft rates.');
  return fetchAircraftRatesFlow();
}

export async function saveAircraftRate(input: SaveAircraftRateInput): Promise<AircraftRate> {
  console.log('[ManageAircraftRatesFlow MOCK] Attempting to save aircraft rate for aircraft ID:', input.id);
  return saveAircraftRateFlow(input);
}

export async function deleteAircraftRate(input: DeleteAircraftRateInput): Promise<{ success: boolean; aircraftId: string }> {
  console.log('[ManageAircraftRatesFlow MOCK] Attempting to delete aircraft rate for aircraft ID:', input.aircraftId);
  return deleteAircraftRateFlow(input);
}


// Genkit Flow Definitions
const fetchAircraftRatesFlow = ai.defineFlow(
  {
    name: 'fetchAircraftRatesFlow',
    outputSchema: FetchAircraftRatesOutputSchema,
  },
  async () => {
    console.log('Executing fetchAircraftRatesFlow - MOCK');
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log('Fetched aircraft rates from MOCK_AIRCRAFT_RATES_DATA:', MOCK_AIRCRAFT_RATES_DATA.length, 'rates.');
    return MOCK_AIRCRAFT_RATES_DATA;
  }
);

const saveAircraftRateFlow = ai.defineFlow(
  {
    name: 'saveAircraftRateFlow',
    inputSchema: SaveAircraftRateInputSchema,
    outputSchema: SaveAircraftRateOutputSchema,
  },
  async (input) => {
    console.log('Executing saveAircraftRateFlow with input - MOCK:', input);
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const existingIndex = MOCK_AIRCRAFT_RATES_DATA.findIndex(rate => rate.id === input.id);
    if (existingIndex !== -1) {
      MOCK_AIRCRAFT_RATES_DATA[existingIndex] = input;
      console.log('Updated aircraft rate in MOCK_AIRCRAFT_RATES_DATA:', input);
    } else {
      MOCK_AIRCRAFT_RATES_DATA.push(input);
      console.log('Added new aircraft rate to MOCK_AIRCRAFT_RATES_DATA:', input);
    }
    return input;
  }
);

const deleteAircraftRateFlow = ai.defineFlow(
  {
    name: 'deleteAircraftRateFlow',
    inputSchema: DeleteAircraftRateInputSchema,
    outputSchema: DeleteAircraftRateOutputSchema,
  },
  async (input) => {
    console.log('Executing deleteAircraftRateFlow for aircraft ID - MOCK:', input.aircraftId);
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const initialLength = MOCK_AIRCRAFT_RATES_DATA.length;
    MOCK_AIRCRAFT_RATES_DATA = MOCK_AIRCRAFT_RATES_DATA.filter(rate => rate.id !== input.aircraftId);
    const success = MOCK_AIRCRAFT_RATES_DATA.length < initialLength;

    if (success) {
      console.log('Deleted aircraft rate from MOCK_AIRCRAFT_RATES_DATA:', input.aircraftId);
    } else {
      console.warn(`Aircraft rate for ID ${input.aircraftId} not found for deletion in MOCK_AIRCRAFT_RATES_DATA.`);
    }
    return { success, aircraftId: input.aircraftId };
  }
);
