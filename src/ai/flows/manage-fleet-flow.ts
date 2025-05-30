
'use server';
/**
 * @fileOverview Genkit flows for managing the company's aircraft fleet using Firestore.
 *
 * - fetchFleetAircraft - Fetches all aircraft in the fleet.
 * - saveFleetAircraft - Saves (adds or updates) an aircraft in the fleet.
 * - deleteFleetAircraft - Deletes an aircraft from the fleet.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
// You'll need to initialize Firebase in your project, typically in a separate config file
// For example: import { db } from '@/lib/firebase'; (where db is getFirestore())

// Define the structure for a fleet aircraft
const FleetAircraftSchema = z.object({
  id: z.string().describe("The unique identifier for the aircraft, typically the tail number if unique, or an auto-generated ID."),
  tailNumber: z.string().min(1, "Tail number is required.").describe("The aircraft's tail number (e.g., N123AB)."),
  model: z.string().min(1, "Aircraft model is required.").describe("The aircraft model (e.g., Cessna Citation CJ3)."),
});
export type FleetAircraft = z.infer<typeof FleetAircraftSchema>;

// Schemas for flow inputs and outputs
const SaveFleetAircraftInputSchema = FleetAircraftSchema; // When saving, we pass the whole aircraft object
export type SaveFleetAircraftInput = z.infer<typeof SaveFleetAircraftInputSchema>;

const DeleteFleetAircraftInputSchema = z.object({
  aircraftId: z.string().describe("The ID of the aircraft to delete from the fleet."),
});
export type DeleteFleetAircraftInput = z.infer<typeof DeleteFleetAircraftInputSchema>;

const FetchFleetAircraftOutputSchema = z.array(FleetAircraftSchema);
const SaveFleetAircraftOutputSchema = FleetAircraftSchema; // Returns the saved/updated aircraft
const DeleteFleetAircraftOutputSchema = z.object({
  success: z.boolean(),
  aircraftId: z.string(),
});

const FLEET_COLLECTION_NAME = 'fleetAircraft';

// Exported async functions that clients will call
export async function fetchFleetAircraft(): Promise<FleetAircraft[]> {
  console.log('[ManageFleetFlow] Attempting to fetch fleet aircraft from Firestore.');
  return fetchFleetAircraftFlow();
}

export async function saveFleetAircraft(input: SaveFleetAircraftInput): Promise<FleetAircraft> {
  console.log('[ManageFleetFlow] Attempting to save fleet aircraft to Firestore:', input.id);
  return saveFleetAircraftFlow(input);
}

export async function deleteFleetAircraft(input: DeleteFleetAircraftInput): Promise<{ success: boolean; aircraftId: string }> {
  console.log('[ManageFleetFlow] Attempting to delete fleet aircraft from Firestore:', input.aircraftId);
  return deleteFleetAircraftFlow(input);
}

// Genkit Flow Definitions
const fetchFleetAircraftFlow = ai.defineFlow(
  {
    name: 'fetchFleetAircraftFlow',
    outputSchema: FetchFleetAircraftOutputSchema,
  },
  async () => {
    console.log('Executing fetchFleetAircraftFlow - Firestore');
    try {
      const db = getFirestore(); // Ensure Firebase is initialized
      const fleetCollection = collection(db, FLEET_COLLECTION_NAME);
      const snapshot = await getDocs(fleetCollection);
      const aircraftList = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FleetAircraft));
      console.log('Fetched fleet from Firestore:', aircraftList.length, 'aircraft.');
      return aircraftList;
    } catch (error) {
      console.error('Error fetching fleet from Firestore:', error);
      // Depending on your error handling strategy, you might throw the error or return an empty array
      throw new Error(`Failed to fetch fleet aircraft: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const saveFleetAircraftFlow = ai.defineFlow(
  {
    name: 'saveFleetAircraftFlow',
    inputSchema: SaveFleetAircraftInputSchema,
    outputSchema: SaveFleetAircraftOutputSchema,
  },
  async (input) => {
    console.log('Executing saveFleetAircraftFlow with input - Firestore:', input);
    try {
      const db = getFirestore(); // Ensure Firebase is initialized
      const { id, ...aircraftData } = input; // Separate id from the rest of the data
      const aircraftRef = doc(db, FLEET_COLLECTION_NAME, id);
      await setDoc(aircraftRef, aircraftData, { merge: true }); // Use aircraftData, not input
      console.log('Saved/Updated fleet aircraft to Firestore:', input);
      return input; // Return the full input object as confirmation
    } catch (error) {
      console.error('Error saving fleet aircraft to Firestore:', error);
      throw new Error(`Failed to save fleet aircraft: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const deleteFleetAircraftFlow = ai.defineFlow(
  {
    name: 'deleteFleetAircraftFlow',
    inputSchema: DeleteFleetAircraftInputSchema,
    outputSchema: DeleteFleetAircraftOutputSchema,
  },
  async (input) => {
    console.log('Executing deleteFleetAircraftFlow for ID - Firestore:', input.aircraftId);
    try {
      const db = getFirestore(); // Ensure Firebase is initialized
      await deleteDoc(doc(db, FLEET_COLLECTION_NAME, input.aircraftId));
      console.log('Deleted fleet aircraft from Firestore:', input.aircraftId);
      return { success: true, aircraftId: input.aircraftId };
    } catch (error) {
      console.error('Error deleting fleet aircraft from Firestore:', error);
      // You might want to check if the document existed before deletion for a more accurate success status
      throw new Error(`Failed to delete fleet aircraft: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);
