
'use server';
/**
 * @fileOverview Genkit flows for managing aircraft rate configurations.
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

// Mock initial data. The 'id' should match an 'id' from MOCK_INITIAL_FLEET_AIRCRAFT in manage-fleet-flow.ts
const MOCK_INITIAL_AIRCRAFT_RATES: AircraftRate[] = [
    { id: 'N123AB', buy: 2800, sell: 3200 },
    { id: 'N456CD', buy: 5800, sell: 6500 },
    { id: 'N789EF', buy: 7500, sell: 8500 },
    { id: 'N630MW', buy: 2200, sell: 2600 },
    // { id: 'Category: Light Jet', buy: 2400, sell: 2800 }, // Category rates might need different handling or a different settings section
    // { id: 'Category: Midsize Jet', buy: 4000, sell: 4500 },
    // { id: 'Category: Heavy Jet', buy: 7000, sell: 7500 },
    { id: 'DEFAULT_AIRCRAFT_RATES', buy: 3500, sell: 4000 }, // A general fallback
];
let internalMockStorageRates: AircraftRate[] = [...MOCK_INITIAL_AIRCRAFT_RATES];


// Exported async functions that clients will call
export async function fetchAircraftRates(): Promise<AircraftRate[]> {
  console.log('[ManageAircraftRatesFlow] Attempting to fetch aircraft rates.');
  return fetchAircraftRatesFlow();
}

export async function saveAircraftRate(input: SaveAircraftRateInput): Promise<AircraftRate> {
  console.log('[ManageAircraftRatesFlow] Attempting to save aircraft rate for aircraft ID:', input.id);
  return saveAircraftRateFlow(input);
}

export async function deleteAircraftRate(input: DeleteAircraftRateInput): Promise<{ success: boolean; aircraftId: string }> {
  console.log('[ManageAircraftRatesFlow] Attempting to delete aircraft rate for aircraft ID:', input.aircraftId);
  return deleteAircraftRateFlow(input);
}


// Genkit Flow Definitions
const fetchAircraftRatesFlow = ai.defineFlow(
  {
    name: 'fetchAircraftRatesFlow',
    outputSchema: FetchAircraftRatesOutputSchema,
  },
  async () => {
    console.log('Executing fetchAircraftRatesFlow');
    // TODO: Replace with actual Firestore read logic from 'aircraftRates' collection
    // This collection would store documents where doc.id is the aircraftId from the fleet.
    // Example:
    // const db = getFirestore();
    // const snapshot = await db.collection('aircraftRates').get();
    // const rates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AircraftRate));
    // console.log('Fetched rates from Firestore:', rates);
    // return rates;

    console.log('Returning mock aircraft rates from flow skeleton:', internalMockStorageRates);
    return Promise.resolve([...internalMockStorageRates]); 
  }
);

const saveAircraftRateFlow = ai.defineFlow(
  {
    name: 'saveAircraftRateFlow',
    inputSchema: SaveAircraftRateInputSchema,
    outputSchema: SaveAircraftRateOutputSchema,
  },
  async (input) => {
    console.log('Executing saveAircraftRateFlow with input:', input);
    // TODO: Replace with actual Firestore add/update logic for 'aircraftRates' collection
    // The document ID should be input.id (which is the aircraftId from the fleet)
    // Example:
    // const db = getFirestore();
    // const rateRef = db.collection('aircraftRates').doc(input.id); 
    // await rateRef.set({ buy: input.buy, sell: input.sell }, { merge: true }); 
    // console.log('Saved/Updated rate to Firestore:', input);
    // return input; 

    // Mocking persistence
    const index = internalMockStorageRates.findIndex(rate => rate.id === input.id);
    if (index !== -1) {
      internalMockStorageRates[index] = input;
    } else {
      internalMockStorageRates.push(input);
    }
    console.log('Returning mock saved aircraft rate from flow skeleton:', input);
    return Promise.resolve(input);
  }
);

const deleteAircraftRateFlow = ai.defineFlow(
  {
    name: 'deleteAircraftRateFlow',
    inputSchema: DeleteAircraftRateInputSchema,
    outputSchema: DeleteAircraftRateOutputSchema,
  },
  async (input) => {
    console.log('Executing deleteAircraftRateFlow for aircraft ID:', input.aircraftId);
    // TODO: Replace with actual Firestore delete logic from 'aircraftRates' collection
    // Document ID is input.aircraftId
    // Example:
    // const db = getFirestore();
    // await db.collection('aircraftRates').doc(input.aircraftId).delete();
    // console.log('Deleted rate from Firestore:', input.aircraftId);
    // return { success: true, aircraftId: input.aircraftId };

    // Mocking persistence
    const initialLength = internalMockStorageRates.length;
    internalMockStorageRates = internalMockStorageRates.filter(rate => rate.id !== input.aircraftId);
    const success = internalMockStorageRates.length < initialLength;
    console.log(`Mock deletion ${success ? 'successful' : 'failed/not found'} for:`, input.aircraftId);
    return Promise.resolve({ success, aircraftId: input.aircraftId });
  }
);
