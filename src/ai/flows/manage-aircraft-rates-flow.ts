
'use server';
/**
 * @fileOverview Genkit flows for managing aircraft rate configurations.
 *
 * - fetchAircraftRates - Fetches all aircraft rates.
 * - saveAircraftRate - Saves (adds or updates) an aircraft rate.
 * - deleteAircraftRate - Deletes an aircraft rate.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Define the structure for an aircraft rate
// This schema is NOT exported as a const from the 'use server' file.
const AircraftRateSchema = z.object({
  id: z.string().describe("The unique identifier for the aircraft rate, typically the aircraft name or category key."),
  buy: z.number().min(0).describe("The buy rate per hour for the aircraft."),
  sell: z.number().min(0).describe("The sell rate per hour for the aircraft."),
});
export type AircraftRate = z.infer<typeof AircraftRateSchema>;

// Schemas for flow inputs and outputs (internal to this file or used by other server components)
const SaveAircraftRateInputSchema = AircraftRateSchema;
export type SaveAircraftRateInput = z.infer<typeof SaveAircraftRateInputSchema>;

const DeleteAircraftRateInputSchema = z.object({
  aircraftId: z.string().describe("The ID of the aircraft rate to delete."),
});
export type DeleteAircraftRateInput = z.infer<typeof DeleteAircraftRateInputSchema>;

const FetchAircraftRatesOutputSchema = z.array(AircraftRateSchema);
const SaveAircraftRateOutputSchema = AircraftRateSchema; // Returns the saved/updated rate
const DeleteAircraftRateOutputSchema = z.object({
  success: z.boolean(),
  aircraftId: z.string(),
});

// Mock initial data if Firestore isn't set up yet, for skeleton functionality
const MOCK_INITIAL_AIRCRAFT_RATES: AircraftRate[] = [
    { id: 'N123AB - Cessna Citation CJ3', buy: 2800, sell: 3200 },
    { id: 'N456CD - Bombardier Global 6000', buy: 5800, sell: 6500 },
    { id: 'N789EF - Gulfstream G650ER', buy: 7500, sell: 8500 },
    { id: 'Category: Light Jet', buy: 2400, sell: 2800 },
    { id: 'Category: Midsize Jet', buy: 4000, sell: 4500 },
    { id: 'Category: Heavy Jet', buy: 7000, sell: 7500 },
    { id: 'DEFAULT_AIRCRAFT_RATES', buy: 3500, sell: 4000 },
];
let internalMockStorageRates: AircraftRate[] = [...MOCK_INITIAL_AIRCRAFT_RATES];


// Exported async functions that clients will call
export async function fetchAircraftRates(): Promise<AircraftRate[]> {
  console.log('[ManageAircraftRatesFlow] Attempting to fetch aircraft rates.');
  return fetchAircraftRatesFlow();
}

export async function saveAircraftRate(input: SaveAircraftRateInput): Promise<AircraftRate> {
  console.log('[ManageAircraftRatesFlow] Attempting to save aircraft rate:', input.id);
  return saveAircraftRateFlow(input);
}

export async function deleteAircraftRate(input: DeleteAircraftRateInput): Promise<{ success: boolean; aircraftId: string }> {
  console.log('[ManageAircraftRatesFlow] Attempting to delete aircraft rate:', input.aircraftId);
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
    // TODO: Replace with actual Firestore read logic
    // Example:
    // const db = getFirestore(); // Assuming you have a way to get Firestore instance
    // const snapshot = await db.collection('aircraftRates').get();
    // const rates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AircraftRate));
    // console.log('Fetched rates from Firestore:', rates);
    // return rates;

    // Returning mock data for now
    console.log('Returning mock aircraft rates from flow skeleton:', internalMockStorageRates);
    return Promise.resolve([...internalMockStorageRates]); // Return a copy
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
    // TODO: Replace with actual Firestore add/update logic
    // Example:
    // const db = getFirestore();
    // const rateRef = db.collection('aircraftRates').doc(input.id); // Use 'id' as document ID
    // await rateRef.set({ buy: input.buy, sell: input.sell }, { merge: true }); // Save/update
    // console.log('Saved/Updated rate to Firestore:', input);
    // return input; // Return the saved object

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
    console.log('Executing deleteAircraftRateFlow for ID:', input.aircraftId);
    // TODO: Replace with actual Firestore delete logic
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

