
'use server';
/**
 * @fileOverview Genkit flows for managing the company's aircraft fleet.
 *
 * - fetchFleetAircraft - Fetches all aircraft in the fleet.
 * - saveFleetAircraft - Saves (adds or updates) an aircraft in the fleet.
 * - deleteFleetAircraft - Deletes an aircraft from the fleet.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

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

// Mock initial data for the fleet
const MOCK_INITIAL_FLEET_AIRCRAFT: FleetAircraft[] = [
  { id: 'N123AB', tailNumber: 'N123AB', model: 'Cessna Citation CJ3' },
  { id: 'N456CD', tailNumber: 'N456CD', model: 'Bombardier Global 6000' },
  { id: 'N789EF', tailNumber: 'N789EF', model: 'Gulfstream G650ER' },
  { id: 'N630MW', tailNumber: 'N630MW', model: 'Piper Cheyenne PA-31T2' },
];
let internalMockFleetStorage: FleetAircraft[] = [...MOCK_INITIAL_FLEET_AIRCRAFT];

// Exported async functions that clients will call
export async function fetchFleetAircraft(): Promise<FleetAircraft[]> {
  console.log('[ManageFleetFlow] Attempting to fetch fleet aircraft.');
  return fetchFleetAircraftFlow();
}

export async function saveFleetAircraft(input: SaveFleetAircraftInput): Promise<FleetAircraft> {
  console.log('[ManageFleetFlow] Attempting to save fleet aircraft:', input.id);
  return saveFleetAircraftFlow(input);
}

export async function deleteFleetAircraft(input: DeleteFleetAircraftInput): Promise<{ success: boolean; aircraftId: string }> {
  console.log('[ManageFleetFlow] Attempting to delete fleet aircraft:', input.aircraftId);
  return deleteFleetAircraftFlow(input);
}

// Genkit Flow Definitions
const fetchFleetAircraftFlow = ai.defineFlow(
  {
    name: 'fetchFleetAircraftFlow',
    outputSchema: FetchFleetAircraftOutputSchema,
  },
  async () => {
    console.log('Executing fetchFleetAircraftFlow');
    // TODO: Replace with actual Firestore read logic for 'fleetAircraft' collection
    // Example:
    // const db = getFirestore();
    // const snapshot = await db.collection('fleetAircraft').get();
    // const aircraftList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FleetAircraft));
    // console.log('Fetched fleet from Firestore:', aircraftList);
    // return aircraftList;

    console.log('Returning mock fleet aircraft from flow skeleton:', internalMockFleetStorage);
    return Promise.resolve([...internalMockFleetStorage]); // Return a copy
  }
);

const saveFleetAircraftFlow = ai.defineFlow(
  {
    name: 'saveFleetAircraftFlow',
    inputSchema: SaveFleetAircraftInputSchema,
    outputSchema: SaveFleetAircraftOutputSchema,
  },
  async (input) => {
    console.log('Executing saveFleetAircraftFlow with input:', input);
    // TODO: Replace with actual Firestore add/update logic for 'fleetAircraft' collection
    // Example:
    // const db = getFirestore();
    // const aircraftRef = db.collection('fleetAircraft').doc(input.id); // Use input.id as document ID
    // await aircraftRef.set({ tailNumber: input.tailNumber, model: input.model }, { merge: true });
    // console.log('Saved/Updated fleet aircraft to Firestore:', input);
    // return input;

    // Mocking persistence
    const index = internalMockFleetStorage.findIndex(ac => ac.id === input.id);
    if (index !== -1) {
      internalMockFleetStorage[index] = input; // Update existing
    } else {
      internalMockFleetStorage.push(input); // Add new
    }
    console.log('Returning mock saved fleet aircraft from flow skeleton:', input);
    return Promise.resolve(input);
  }
);

const deleteFleetAircraftFlow = ai.defineFlow(
  {
    name: 'deleteFleetAircraftFlow',
    inputSchema: DeleteFleetAircraftInputSchema,
    outputSchema: DeleteFleetAircraftOutputSchema,
  },
  async (input) => {
    console.log('Executing deleteFleetAircraftFlow for ID:', input.aircraftId);
    // TODO: Replace with actual Firestore delete logic for 'fleetAircraft' collection
    // Example:
    // const db = getFirestore();
    // await db.collection('fleetAircraft').doc(input.aircraftId).delete();
    // console.log('Deleted fleet aircraft from Firestore:', input.aircraftId);
    // return { success: true, aircraftId: input.aircraftId };

    // Mocking persistence
    const initialLength = internalMockFleetStorage.length;
    internalMockFleetStorage = internalMockFleetStorage.filter(ac => ac.id !== input.aircraftId);
    const success = internalMockFleetStorage.length < initialLength;
    console.log(`Mock fleet aircraft deletion ${success ? 'successful' : 'failed/not found'} for:`, input.aircraftId);
    return Promise.resolve({ success, aircraftId: input.aircraftId });
  }
);
