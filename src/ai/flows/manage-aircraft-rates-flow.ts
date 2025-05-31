
'use server';
/**
 * @fileOverview Genkit flows for managing aircraft rate configurations using Firestore.
 * Rates are associated with aircraft from the main fleet.
 *
 * - fetchAircraftRates - Fetches all aircraft rates.
 * - saveAircraftRate - Saves (adds or updates) an aircraft rate.
 * - deleteAircraftRate - Deletes an aircraft rate.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, setDoc, deleteDoc, getDoc } from 'firebase/firestore';

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

const AIRCRAFT_RATES_COLLECTION = 'aircraftRates';

// Exported async functions that clients will call
export async function fetchAircraftRates(): Promise<AircraftRate[]> {
  console.log('[ManageAircraftRatesFlow Firestore] Attempting to fetch aircraft rates.');
  return fetchAircraftRatesFlow();
}

export async function saveAircraftRate(input: SaveAircraftRateInput): Promise<AircraftRate> {
  console.log('[ManageAircraftRatesFlow Firestore] Attempting to save aircraft rate for aircraft ID:', input.id);
  return saveAircraftRateFlow(input);
}

export async function deleteAircraftRate(input: DeleteAircraftRateInput): Promise<{ success: boolean; aircraftId: string }> {
  console.log('[ManageAircraftRatesFlow Firestore] Attempting to delete aircraft rate for aircraft ID:', input.aircraftId);
  return deleteAircraftRateFlow(input);
}


// Genkit Flow Definitions
const fetchAircraftRatesFlow = ai.defineFlow(
  {
    name: 'fetchAircraftRatesFlow',
    outputSchema: FetchAircraftRatesOutputSchema,
  },
  async () => {
    console.log('Executing fetchAircraftRatesFlow - Firestore');
    try {
      const ratesCollectionRef = collection(db, AIRCRAFT_RATES_COLLECTION);
      const snapshot = await getDocs(ratesCollectionRef);
      const ratesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AircraftRate));
      console.log('Fetched aircraft rates from Firestore:', ratesList.length, 'rates.');
      return ratesList;
    } catch (error) {
      console.error('Error fetching aircraft rates from Firestore:', error);
      throw new Error(`Failed to fetch aircraft rates: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const saveAircraftRateFlow = ai.defineFlow(
  {
    name: 'saveAircraftRateFlow',
    inputSchema: SaveAircraftRateInputSchema,
    outputSchema: SaveAircraftRateOutputSchema,
  },
  async (input) => {
    console.log('Executing saveAircraftRateFlow with input - Firestore:', input);
    try {
      const rateDocRef = doc(db, AIRCRAFT_RATES_COLLECTION, input.id);
      // Only store buy and sell, id is the document key
      const dataToSet = {
        buy: input.buy,
        sell: input.sell,
      };
      await setDoc(rateDocRef, dataToSet);
      console.log('Saved aircraft rate in Firestore:', input.id);
      return input; // Return the full input object as it was passed
    } catch (error) {
      console.error('Error saving aircraft rate to Firestore:', error);
      throw new Error(`Failed to save aircraft rate for ${input.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const deleteAircraftRateFlow = ai.defineFlow(
  {
    name: 'deleteAircraftRateFlow',
    inputSchema: DeleteAircraftRateInputSchema,
    outputSchema: DeleteAircraftRateOutputSchema,
  },
  async (input) => {
    console.log('Executing deleteAircraftRateFlow for aircraft ID - Firestore:', input.aircraftId);
    try {
      const rateDocRef = doc(db, AIRCRAFT_RATES_COLLECTION, input.aircraftId);
      const docSnap = await getDoc(rateDocRef);

      if (!docSnap.exists()) {
          console.warn(`Aircraft rate for ID ${input.aircraftId} not found for deletion in Firestore.`);
          return { success: false, aircraftId: input.aircraftId };
      }

      await deleteDoc(rateDocRef);
      console.log('Deleted aircraft rate from Firestore:', input.aircraftId);
      return { success: true, aircraftId: input.aircraftId };
    } catch (error) {
      console.error('Error deleting aircraft rate from Firestore:', error);
      throw new Error(`Failed to delete aircraft rate for ${input.aircraftId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);
