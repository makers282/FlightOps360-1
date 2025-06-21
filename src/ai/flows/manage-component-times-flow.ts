
'use server';
/**
 * @fileOverview Genkit flows for managing aircraft component times (hours/cycles) using Firestore.
 *
 * - fetchComponentTimesForAircraft - Fetches component times for a given aircraft.
 * - saveComponentTimesForAircraft - Saves (adds or updates) component times for an aircraft.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { adminDb as db } from '@/lib/firebase-admin';

const ComponentTimeDataSchema = z.object({
  time: z.number().nonnegative().default(0),
  cycles: z.number().nonnegative().int().default(0),
});
export type ComponentTimeData = z.infer<typeof ComponentTimeDataSchema>;

const AircraftComponentTimesSchema = z.record(z.string(), ComponentTimeDataSchema)
  .describe("A map of component names to their time and cycles data.");
export type AircraftComponentTimes = z.infer<typeof AircraftComponentTimesSchema>;

// Input/Output Schemas for flows
const FetchComponentTimesInputSchema = z.object({
  aircraftId: z.string().describe("The ID of the aircraft (typically tail number or Firestore doc ID from fleet collection)."),
});
export type FetchComponentTimesInput = z.infer<typeof FetchComponentTimesInputSchema>;

// Output can be the map or null if not found
const FetchComponentTimesOutputSchema = AircraftComponentTimesSchema.nullable();


const SaveComponentTimesInputSchema = z.object({
  aircraftId: z.string().describe("The ID of the aircraft."),
  componentTimes: AircraftComponentTimesSchema.describe("The map of component names to their time/cycle data."),
});
export type SaveComponentTimesInput = z.infer<typeof SaveComponentTimesInputSchema>;

const SaveComponentTimesOutputSchema = z.object({
  success: z.boolean(),
  aircraftId: z.string(),
});

const COMPONENT_TIMES_COLLECTION = 'aircraftComponentTimes';

// Exported async functions that clients will call
export async function fetchComponentTimesForAircraft(input: FetchComponentTimesInput): Promise<AircraftComponentTimes | null> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchComponentTimesForAircraft (manage-component-times-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in fetchComponentTimesForAircraft.");
  }
  console.log('[ManageComponentTimesFlow Firestore Admin] Attempting to fetch component times for aircraft ID:', input.aircraftId);
  return fetchComponentTimesFlow(input);
}

export async function saveComponentTimesForAircraft(input: SaveComponentTimesInput): Promise<{ success: boolean; aircraftId: string }> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveComponentTimesForAircraft (manage-component-times-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in saveComponentTimesForAircraft.");
  }
  console.log('[ManageComponentTimesFlow Firestore Admin] Attempting to save component times for aircraft ID:', input.aircraftId);
  return saveComponentTimesFlow(input);
}

// Genkit Flow Definitions
const fetchComponentTimesFlow = ai.defineFlow(
  {
    name: 'fetchComponentTimesFlow',
    inputSchema: FetchComponentTimesInputSchema,
    outputSchema: FetchComponentTimesOutputSchema, 
  },
  async (input) => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchComponentTimesFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in fetchComponentTimesFlow.");
    }
    console.log('Executing fetchComponentTimesFlow - Firestore for aircraftId:', input.aircraftId);
    try {
      const docRef = db.collection(COMPONENT_TIMES_COLLECTION).doc(input.aircraftId);
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        const data = docSnap.data()?.componentTimes as AircraftComponentTimes; // Assuming data is stored under a 'componentTimes' field
        console.log('Fetched component times from Firestore for aircraft:', input.aircraftId, data);
        return data || null; // Return data or null if undefined
      } else {
        console.log('No component times document found for aircraft:', input.aircraftId);
        return null;
      }
    } catch (error) {
      console.error('Error fetching component times from Firestore for aircraft', input.aircraftId, ':', error);
      throw new Error(`Failed to fetch component times: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const saveComponentTimesFlow = ai.defineFlow(
  {
    name: 'saveComponentTimesFlow',
    inputSchema: SaveComponentTimesInputSchema,
    outputSchema: SaveComponentTimesOutputSchema,
  },
  async (input) => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveComponentTimesFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in saveComponentTimesFlow.");
    }
    console.log('Executing saveComponentTimesFlow with input - Firestore:', JSON.stringify(input));
    try {
      const docRef = db.collection(COMPONENT_TIMES_COLLECTION).doc(input.aircraftId);
      // Store the componentTimes map directly under a field named 'componentTimes' in the document.
      // The document ID is aircraftId.
      await docRef.set({ componentTimes: input.componentTimes }, { merge: true }); 
      console.log('Saved component times in Firestore for aircraft:', input.aircraftId);
      return { success: true, aircraftId: input.aircraftId };
    } catch (error) {
      console.error('Error saving component times to Firestore for aircraft:', input.aircraftId, error);
      throw new Error(`Failed to save component times for ${input.aircraftId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);
