
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
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
// You'll need to initialize Firebase in your project, typically in a separate config file
// For example: import { db } from '@/lib/firebase'; (where db is getFirestore())

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

const RATES_COLLECTION_NAME = 'aircraftRates';

// Exported async functions that clients will call
export async function fetchAircraftRates(): Promise<AircraftRate[]> {
  console.log('[ManageAircraftRatesFlow] Attempting to fetch aircraft rates from Firestore.');
  return fetchAircraftRatesFlow();
}

export async function saveAircraftRate(input: SaveAircraftRateInput): Promise<AircraftRate> {
  console.log('[ManageAircraftRatesFlow] Attempting to save aircraft rate for aircraft ID to Firestore:', input.id);
  return saveAircraftRateFlow(input);
}

export async function deleteAircraftRate(input: DeleteAircraftRateInput): Promise<{ success: boolean; aircraftId: string }> {
  console.log('[ManageAircraftRatesFlow] Attempting to delete aircraft rate for aircraft ID from Firestore:', input.aircraftId);
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
      const db = getFirestore(); // Ensure Firebase is initialized
      const ratesCollection = collection(db, RATES_COLLECTION_NAME);
      const snapshot = await getDocs(ratesCollection);
      const ratesList = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AircraftRate));
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
      const db = getFirestore(); // Ensure Firebase is initialized
      const { id, ...rateData } = input; // Separate id from the rest of the data
      const rateRef = doc(db, RATES_COLLECTION_NAME, id); 
      await setDoc(rateRef, rateData, { merge: true }); // Use rateData, not input
      console.log('Saved/Updated aircraft rate to Firestore:', input);
      return input; // Return the full input object as confirmation
    } catch (error) {
      console.error('Error saving aircraft rate to Firestore:', error);
      throw new Error(`Failed to save aircraft rate: ${error instanceof Error ? error.message : String(error)}`);
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
      const db = getFirestore(); // Ensure Firebase is initialized
      await deleteDoc(doc(db, RATES_COLLECTION_NAME, input.aircraftId));
      console.log('Deleted aircraft rate from Firestore:', input.aircraftId);
      return { success: true, aircraftId: input.aircraftId };
    } catch (error) {
      console.error('Error deleting aircraft rate from Firestore:', error);
      throw new Error(`Failed to delete aircraft rate: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);
