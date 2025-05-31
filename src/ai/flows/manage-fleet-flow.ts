
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
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, setDoc, deleteDoc, query, where, writeBatch } from 'firebase/firestore';

// Define the structure for an engine detail
const EngineDetailSchema = z.object({
  model: z.string().optional().describe("Engine model."),
  serialNumber: z.string().optional().describe("Engine serial number."),
});
export type EngineDetail = z.infer<typeof EngineDetailSchema>;

// Define the structure for a fleet aircraft
const FleetAircraftSchema = z.object({
  id: z.string().describe("The unique identifier for the aircraft, typically the tail number if unique, or an auto-generated ID."),
  tailNumber: z.string().min(1, "Tail number is required.").describe("The aircraft's tail number (e.g., N123AB)."),
  model: z.string().min(1, "Aircraft model is required.").describe("The aircraft model (e.g., Cessna Citation CJ3)."),
  isMaintenanceTracked: z.boolean().optional().default(true).describe("Whether maintenance tracking is enabled for this aircraft."),
  trackedComponentNames: z.array(z.string()).optional().default(['Airframe', 'Engine 1']).describe("List of component names to track hours/cycles for (e.g., Airframe, Engine 1, Propeller 1)."),
  serialNumber: z.string().optional().describe("Aircraft serial number."),
  baseLocation: z.string().optional().describe("Primary base location of the aircraft (e.g., KTEB)."),
  engineDetails: z.array(EngineDetailSchema).optional().describe("Details for each engine."),
  primaryContactName: z.string().optional().describe("Primary contact person for the aircraft."),
  primaryContactPhone: z.string().optional().describe("Primary contact phone for the aircraft."),
  primaryContactEmail: z.string().email("Invalid email format.").optional().describe("Primary contact email for the aircraft."),
});
export type FleetAircraft = z.infer<typeof FleetAircraftSchema>;

// Schemas for flow inputs and outputs
const SaveFleetAircraftInputSchema = FleetAircraftSchema;
export type SaveFleetAircraftInput = z.infer<typeof SaveFleetAircraftInputSchema>;

const DeleteFleetAircraftInputSchema = z.object({
  aircraftId: z.string().describe("The ID of the aircraft to delete from the fleet."),
});
export type DeleteFleetAircraftInput = z.infer<typeof DeleteFleetAircraftInputSchema>;

const FetchFleetAircraftOutputSchema = z.array(FleetAircraftSchema);
const SaveFleetAircraftOutputSchema = FleetAircraftSchema;
const DeleteFleetAircraftOutputSchema = z.object({
  success: z.boolean(),
  aircraftId: z.string(),
});

const FLEET_COLLECTION = 'fleet';
const AIRCRAFT_RATES_COLLECTION = 'aircraftRates'; // For cascading delete

// Exported async functions that clients will call
export async function fetchFleetAircraft(): Promise<FleetAircraft[]> {
  console.log('[ManageFleetFlow Firestore] Attempting to fetch fleet aircraft.');
  return fetchFleetAircraftFlow();
}

export async function saveFleetAircraft(input: SaveFleetAircraftInput): Promise<FleetAircraft> {
  console.log('[ManageFleetFlow Firestore] Attempting to save fleet aircraft:', input.id, 'Data:', JSON.stringify(input));
  const aircraftToSave: FleetAircraft = {
    ...input,
    isMaintenanceTracked: input.isMaintenanceTracked ?? true, 
    trackedComponentNames: input.trackedComponentNames && input.trackedComponentNames.length > 0 ? input.trackedComponentNames : ['Airframe', 'Engine 1'],
  };
  return saveFleetAircraftFlow(aircraftToSave);
}

export async function deleteFleetAircraft(input: DeleteFleetAircraftInput): Promise<{ success: boolean; aircraftId: string }> {
  console.log('[ManageFleetFlow Firestore] Attempting to delete fleet aircraft:', input.aircraftId);
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
      const fleetCollectionRef = collection(db, FLEET_COLLECTION);
      const snapshot = await getDocs(fleetCollectionRef);
      const aircraftList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FleetAircraft));
      console.log('Fetched fleet from Firestore:', aircraftList.length, 'aircraft.');
      return aircraftList;
    } catch (error) {
      console.error('Error fetching fleet from Firestore:', error);
      throw new Error(`Failed to fetch fleet: ${error instanceof Error ? error.message : String(error)}`);
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
    console.log('Executing saveFleetAircraftFlow with input - Firestore:', JSON.stringify(input));
    try {
      const aircraftDocRef = doc(db, FLEET_COLLECTION, input.id);
      // Ensure all fields are present, even if undefined, to handle updates correctly
      const dataToSet = {
        tailNumber: input.tailNumber,
        model: input.model,
        isMaintenanceTracked: input.isMaintenanceTracked ?? true,
        trackedComponentNames: input.trackedComponentNames ?? ['Airframe', 'Engine 1'],
        serialNumber: input.serialNumber ?? null, // Use null for Firestore if undefined
        baseLocation: input.baseLocation ?? null,
        engineDetails: input.engineDetails ?? [],
        primaryContactName: input.primaryContactName ?? null,
        primaryContactPhone: input.primaryContactPhone ?? null,
        primaryContactEmail: input.primaryContactEmail ?? null,
      };
      await setDoc(aircraftDocRef, dataToSet, { merge: true }); // Use merge:true to handle updates
      console.log('Saved/Updated aircraft in Firestore:', input.id);
      return { ...input, ...dataToSet }; // Return the full input object as saved
    } catch (error) {
      console.error('Error saving aircraft to Firestore:', error);
      throw new Error(`Failed to save aircraft ${input.id}: ${error instanceof Error ? error.message : String(error)}`);
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
      const batch = writeBatch(db);

      // Delete the aircraft document
      const aircraftDocRef = doc(db, FLEET_COLLECTION, input.aircraftId);
      batch.delete(aircraftDocRef);

      // Delete the associated aircraft rate document
      const aircraftRateDocRef = doc(db, AIRCRAFT_RATES_COLLECTION, input.aircraftId);
      batch.delete(aircraftRateDocRef);
      
      // TODO: In a real app, also delete associated maintenance tasks, component times, performance data, etc.
      // For now, we only handle aircraft and its rate.

      await batch.commit();
      console.log('Deleted fleet aircraft and associated rate from Firestore:', input.aircraftId);
      return { success: true, aircraftId: input.aircraftId };
    } catch (error) {
      console.error('Error deleting aircraft from Firestore:', error);
      throw new Error(`Failed to delete aircraft ${input.aircraftId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);
