
'use server';
/**
 * @fileOverview Genkit flows for managing aircraft performance data using Firestore.
 * Performance data is associated with aircraft from the main fleet.
 *
 * - fetchAircraftPerformance - Fetches performance data for a given aircraft.
 * - saveAircraftPerformance - Saves (adds or updates) performance data for an aircraft.
 */

import { ai } from '@/ai/genkit';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { AircraftPerformanceData, FetchAircraftPerformanceInput, SaveAircraftPerformanceInput } from '@/ai/schemas/aircraft-performance-schemas';
import { 
    AircraftPerformanceDataSchema,
    FetchAircraftPerformanceInputSchema, 
    FetchAircraftPerformanceOutputSchema,
    SaveAircraftPerformanceInputSchema,
    SaveAircraftPerformanceOutputSchema
} from '@/ai/schemas/aircraft-performance-schemas';

const AIRCRAFT_PERFORMANCE_COLLECTION = 'aircraftPerformanceData';

// Exported async functions that clients will call
export async function fetchAircraftPerformance(input: FetchAircraftPerformanceInput): Promise<AircraftPerformanceData | null> {
  console.log('[ManageAircraftPerformanceFlow Firestore] Attempting to fetch performance data for aircraft ID:', input.aircraftId);
  return fetchAircraftPerformanceFlow(input);
}

export async function saveAircraftPerformance(input: SaveAircraftPerformanceInput): Promise<{ success: boolean; aircraftId: string }> {
  console.log('[ManageAircraftPerformanceFlow Firestore] Attempting to save performance data for aircraft ID:', input.aircraftId);
  return saveAircraftPerformanceFlow(input);
}

// Genkit Flow Definitions
const fetchAircraftPerformanceFlow = ai.defineFlow(
  {
    name: 'fetchAircraftPerformanceFlow',
    inputSchema: FetchAircraftPerformanceInputSchema,
    outputSchema: FetchAircraftPerformanceOutputSchema, 
  },
  async (input) => {
    console.log('Executing fetchAircraftPerformanceFlow - Firestore for aircraftId:', input.aircraftId);
    try {
      const docRef = doc(db, AIRCRAFT_PERFORMANCE_COLLECTION, input.aircraftId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        // The document itself contains the performance data fields directly
        const data = docSnap.data() as AircraftPerformanceData;
        console.log('Fetched performance data from Firestore for aircraft:', input.aircraftId, data);
        return data;
      } else {
        console.log('No performance data document found for aircraft:', input.aircraftId);
        return null;
      }
    } catch (error) {
      console.error('Error fetching performance data from Firestore for aircraft', input.aircraftId, ':', error);
      throw new Error(`Failed to fetch performance data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const saveAircraftPerformanceFlow = ai.defineFlow(
  {
    name: 'saveAircraftPerformanceFlow',
    inputSchema: SaveAircraftPerformanceInputSchema,
    outputSchema: SaveAircraftPerformanceOutputSchema,
  },
  async (input) => {
    console.log('Executing saveAircraftPerformanceFlow with input - Firestore:', JSON.stringify(input));
    try {
      const docRef = doc(db, AIRCRAFT_PERFORMANCE_COLLECTION, input.aircraftId);
      // The performanceData object is stored directly as the document's data.
      // The document ID is aircraftId.
      await setDoc(docRef, input.performanceData); 
      console.log('Saved performance data in Firestore for aircraft:', input.aircraftId);
      return { success: true, aircraftId: input.aircraftId };
    } catch (error) {
      console.error('Error saving performance data to Firestore for aircraft:', input.aircraftId, error);
      throw new Error(`Failed to save performance data for ${input.aircraftId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);
