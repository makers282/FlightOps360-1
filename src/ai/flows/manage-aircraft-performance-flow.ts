
'use server';
/**
 * @fileOverview Genkit flows for managing aircraft performance data using Firestore.
 * Performance data is associated with aircraft from the main fleet.
 *
 * - fetchAircraftPerformance - Fetches performance data for a given aircraft.
 * - saveAircraftPerformance - Saves (adds or updates) performance data for an aircraft.
 */

import { ai } from '@/ai/genkit';
import { adminDb as db } from '@/lib/firebase-admin';
import type { AircraftPerformanceData, FetchAircraftPerformanceInput, SaveAircraftPerformanceInput } from '@/ai/schemas/aircraft-performance-schemas';
import { 
    // AircraftPerformanceDataSchema is used for type, not directly in flow schema definition here
    FetchAircraftPerformanceInputSchema, 
    FetchAircraftPerformanceOutputSchema, // This is AircraftPerformanceDataSchema.nullable()
    SaveAircraftPerformanceInputSchema,
    SaveAircraftPerformanceOutputSchema
} from '@/ai/schemas/aircraft-performance-schemas';

const AIRCRAFT_PERFORMANCE_COLLECTION = 'aircraftPerformanceData';

// Exported async functions that clients will call
export async function fetchAircraftPerformance(input: FetchAircraftPerformanceInput): Promise<AircraftPerformanceData | null> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchAircraftPerformance (manage-aircraft-performance-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in fetchAircraftPerformance.");
  }
  console.log('[ManageAircraftPerformanceFlow Firestore Admin] Attempting to fetch performance data for aircraft ID:', input.aircraftId);
  return fetchAircraftPerformanceFlow(input);
}

export async function saveAircraftPerformance(input: SaveAircraftPerformanceInput): Promise<{ success: boolean; aircraftId: string }> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveAircraftPerformance (manage-aircraft-performance-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in saveAircraftPerformance.");
  }
  console.log('[ManageAircraftPerformanceFlow Firestore Admin] Attempting to save performance data for aircraft ID:', input.aircraftId);
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
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchAircraftPerformanceFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in fetchAircraftPerformanceFlow.");
    }
    console.log('Executing fetchAircraftPerformanceFlow - Firestore for aircraftId:', input.aircraftId);
    try {
      const docRef = db.collection(AIRCRAFT_PERFORMANCE_COLLECTION).doc(input.aircraftId);
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        // The document itself contains the performance data fields directly
        const data = docSnap.data() as AircraftPerformanceData; // Assume the data matches the schema
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
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveAircraftPerformanceFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in saveAircraftPerformanceFlow.");
    }
    console.log('Executing saveAircraftPerformanceFlow with input - Firestore:', JSON.stringify(input));
    try {
      const docRef = db.collection(AIRCRAFT_PERFORMANCE_COLLECTION).doc(input.aircraftId);
      // The performanceData object is stored directly as the document's data.
      // The document ID is aircraftId.
      await docRef.set(input.performanceData); 
      console.log('Saved performance data in Firestore for aircraft:', input.aircraftId);
      return { success: true, aircraftId: input.aircraftId };
    } catch (error) {
      console.error('Error saving performance data to Firestore for aircraft:', input.aircraftId, error);
      throw new Error(`Failed to save performance data for ${input.aircraftId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);
