
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
import { adminDb as db } from '@/lib/firebase-admin';
import type { AircraftRate, SaveAircraftRateInput, DeleteAircraftRateInput } from '@/ai/schemas/aircraft-rate-schemas';
import { 
    AircraftRateSchema as FlowAircraftRateSchema, // Renamed to avoid conflict with AircraftRate type
    SaveAircraftRateInputSchema, 
    DeleteAircraftRateInputSchema,
    FetchAircraftRatesOutputSchema,
    SaveAircraftRateOutputSchema,
    DeleteAircraftRateOutputSchema
} from '@/ai/schemas/aircraft-rate-schemas';


const AIRCRAFT_RATES_COLLECTION = 'aircraftRates';

// Exported async functions that clients will call
export async function fetchAircraftRates(): Promise<AircraftRate[]> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchAircraftRates (manage-aircraft-rates-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in fetchAircraftRates.");
  }
  console.log('[ManageAircraftRatesFlow Firestore Admin] Attempting to fetch aircraft rates.');
  return fetchAircraftRatesFlow();
}

export async function saveAircraftRate(input: SaveAircraftRateInput): Promise<AircraftRate> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveAircraftRate (manage-aircraft-rates-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in saveAircraftRate.");
  }
  console.log('[ManageAircraftRatesFlow Firestore Admin] Attempting to save aircraft rate for aircraft ID:', input.id);
  return saveAircraftRateFlow(input);
}

export async function deleteAircraftRate(input: DeleteAircraftRateInput): Promise<{ success: boolean; aircraftId: string }> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in deleteAircraftRate (manage-aircraft-rates-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in deleteAircraftRate.");
  }
  console.log('[ManageAircraftRatesFlow Firestore Admin] Attempting to delete aircraft rate for aircraft ID:', input.aircraftId);
  return deleteAircraftRateFlow(input);
}


// Genkit Flow Definitions
const fetchAircraftRatesFlow = ai.defineFlow(
  {
    name: 'fetchAircraftRatesFlow',
    outputSchema: FetchAircraftRatesOutputSchema,
  },
  async () => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchAircraftRatesFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in fetchAircraftRatesFlow.");
    }
    console.log('Executing fetchAircraftRatesFlow - Firestore');
    try {
      const ratesCollectionRef = db.collection(AIRCRAFT_RATES_COLLECTION);
      const snapshot = await ratesCollectionRef.get();
      const ratesList = snapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        // Handle potential old format (with nested rates.standardCharter) or new simple format
        let buy = 0;
        let sell = 0;

        if (data.rates && data.rates.standardCharter && typeof data.rates.standardCharter.buy === 'number' && typeof data.rates.standardCharter.sell === 'number') { 
          buy = data.rates.standardCharter.buy;
          sell = data.rates.standardCharter.sell;
        } else if (data.buy !== undefined && data.sell !== undefined) { 
          buy = data.buy;
          sell = data.sell;
        }
        
        return { 
          id: docSnapshot.id, 
          buy, 
          sell 
        } as AircraftRate;
      });
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
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveAircraftRateFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in saveAircraftRateFlow.");
    }
    console.log('Executing saveAircraftRateFlow with input - Firestore:', input);
    try {
      const rateDocRef = db.collection(AIRCRAFT_RATES_COLLECTION).doc(input.id);
      // Data to set should be flat buy/sell as per the simplified schema
      const dataToSet = {
        buy: input.buy,
        sell: input.sell,
      };
      await rateDocRef.set(dataToSet); // Overwrite with new simple structure
      console.log('Saved aircraft rate in Firestore:', input.id);
      // Return the input which matches the AircraftRate schema (id, buy, sell)
      return {id: input.id, buy: input.buy, sell: input.sell}; 
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
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in deleteAircraftRateFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in deleteAircraftRateFlow.");
    }
    console.log('Executing deleteAircraftRateFlow for aircraft ID - Firestore:', input.aircraftId);
    try {
      const rateDocRef = db.collection(AIRCRAFT_RATES_COLLECTION).doc(input.aircraftId);
      const docSnap = await rateDocRef.get();

      if (!docSnap.exists) {
          console.warn(`Aircraft rate for ID ${input.aircraftId} not found for deletion in Firestore.`);
          return { success: false, aircraftId: input.aircraftId };
      }

      await rateDocRef.delete();
      console.log('Deleted aircraft rate from Firestore:', input.aircraftId);
      return { success: true, aircraftId: input.aircraftId };
    } catch (error) {
      console.error('Error deleting aircraft rate from Firestore:', error);
      throw new Error(`Failed to delete aircraft rate for ${input.aircraftId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);
