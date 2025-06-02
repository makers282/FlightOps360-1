
'use server';
/**
 * @fileOverview Genkit flows for managing the company's aircraft fleet using Firestore.
 *
 * - fetchFleetAircraft - Fetches all aircraft in the fleet.
 * - saveFleetAircraft - Saves (adds or updates) an aircraft in the fleet.
 * - deleteFleetAircraft - Deletes an aircraft from the fleet.
 */

import {ai} from '@/ai/genkit';
// import {z}from 'genkit'; // z is now imported via the schema file
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import type { 
  FleetAircraft, 
  EngineDetail, // Ensure EngineDetail type is imported if used explicitly
  SaveFleetAircraftInput, 
  DeleteFleetAircraftInput 
} from '@/ai/schemas/fleet-aircraft-schemas';
import { 
  FleetAircraftSchema,
  // EngineDetailSchema is not directly used for flow input/output here
  SaveFleetAircraftInputSchema,
  DeleteFleetAircraftInputSchema,
  FetchFleetAircraftOutputSchema,
  SaveFleetAircraftOutputSchema,
  DeleteFleetAircraftOutputSchema
} from '@/ai/schemas/fleet-aircraft-schemas';


const FLEET_COLLECTION = 'fleet';
const AIRCRAFT_RATES_COLLECTION = 'aircraftRates'; // For cascading delete

// Exported async functions that clients will call
export async function fetchFleetAircraft(): Promise<FleetAircraft[]> {
  console.log('[ManageFleetFlow Firestore] Attempting to fetch fleet aircraft.');
  return fetchFleetAircraftFlow();
}

export async function saveFleetAircraft(input: SaveFleetAircraftInput): Promise<FleetAircraft> {
  console.log('[ManageFleetFlow Firestore WRAPPER] Received input for save:', input.id, 'Data:', JSON.stringify(input));
  
  // Prepare the data for the flow, ensuring nulls for optional fields become undefined
  const aircraftToSave: FleetAircraft = {
    ...input, 
    serialNumber: input.serialNumber === null ? undefined : input.serialNumber,
    aircraftYear: input.aircraftYear === null ? undefined : (input.aircraftYear === undefined ? undefined : Number(input.aircraftYear)),
    baseLocation: input.baseLocation === null ? undefined : input.baseLocation,
    primaryContactName: input.primaryContactName === null ? undefined : input.primaryContactName,
    primaryContactPhone: input.primaryContactPhone === null ? undefined : input.primaryContactPhone,
    primaryContactEmail: input.primaryContactEmail === null ? undefined : input.primaryContactEmail,
    internalNotes: input.internalNotes === null ? undefined : input.internalNotes,
    
    isMaintenanceTracked: input.isMaintenanceTracked ?? true,
    trackedComponentNames: (input.trackedComponentNames && input.trackedComponentNames.length > 0) ? input.trackedComponentNames : ['Airframe', 'Engine 1'],
    engineDetails: input.engineDetails || [],
  };
  console.log('[ManageFleetFlow Firestore WRAPPER] Data prepared for flow:', aircraftToSave.id, 'Data:', JSON.stringify(aircraftToSave));
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
    outputSchema: FetchFleetAircraftOutputSchema, // This is z.array(FleetAircraftSchema)
  },
  async () => {
    console.log('Executing fetchFleetAircraftFlow - Firestore');
    try {
      const fleetCollectionRef = collection(db, FLEET_COLLECTION);
      const snapshot = await getDocs(fleetCollectionRef);
      const aircraftList = snapshot.docs.map(doc => {
        const data = doc.data();
        // Ensure defaults for fields that might be missing in older documents
        // and map nulls from Firestore to undefined for optional Zod fields
        return {
          id: doc.id,
          tailNumber: data.tailNumber || '', 
          model: data.model || '', 
          serialNumber: data.serialNumber ?? undefined,
          aircraftYear: data.aircraftYear ?? undefined, 
          baseLocation: data.baseLocation ?? undefined,
          engineDetails: data.engineDetails || [], 
          isMaintenanceTracked: data.isMaintenanceTracked ?? true,
          trackedComponentNames: data.trackedComponentNames || ['Airframe', 'Engine 1'],
          primaryContactName: data.primaryContactName ?? undefined,
          primaryContactPhone: data.primaryContactPhone ?? undefined,
          primaryContactEmail: data.primaryContactEmail ?? undefined,
          internalNotes: data.internalNotes ?? undefined,
        } as FleetAircraft; // Zod validation happens on the flow's output
      });
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
    inputSchema: SaveFleetAircraftInputSchema, // This is FleetAircraftSchema
    outputSchema: SaveFleetAircraftOutputSchema, // This is FleetAircraftSchema
  },
  async (input) => { // input here has already been cleaned by the wrapper
    console.log('Executing saveFleetAircraftFlow (FLOW INPUT) with input - Firestore:', JSON.stringify(input));
    try {
      const aircraftDocRef = doc(db, FLEET_COLLECTION, input.id);
      // Prepare data for Firestore, converting undefined back to null for storage where appropriate
      const dataToSet = {
        tailNumber: input.tailNumber,
        model: input.model,
        serialNumber: input.serialNumber === undefined ? null : input.serialNumber,
        aircraftYear: input.aircraftYear === undefined ? null : input.aircraftYear,
        baseLocation: input.baseLocation === undefined ? null : input.baseLocation,
        engineDetails: input.engineDetails ?? [],
        isMaintenanceTracked: input.isMaintenanceTracked ?? true,
        trackedComponentNames: input.trackedComponentNames ?? ['Airframe', 'Engine 1'],
        primaryContactName: input.primaryContactName === undefined ? null : input.primaryContactName,
        primaryContactPhone: input.primaryContactPhone === undefined ? null : input.primaryContactPhone,
        primaryContactEmail: input.primaryContactEmail === undefined ? null : input.primaryContactEmail,
        internalNotes: input.internalNotes === undefined ? null : input.internalNotes,
      };
      await setDoc(aircraftDocRef, dataToSet, { merge: true }); 
      console.log('Saved/Updated aircraft in Firestore:', input.id);
      return input; // Return the input as validated by the schema
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

      const aircraftDocRef = doc(db, FLEET_COLLECTION, input.aircraftId);
      batch.delete(aircraftDocRef);

      const aircraftRateDocRef = doc(db, AIRCRAFT_RATES_COLLECTION, input.aircraftId);
      batch.delete(aircraftRateDocRef);
      
      // Note: Deleting Maintenance Tasks and Component Times associated with this aircraft
      // would require querying those collections for aircraftId and adding deletions to the batch.
      // This is not implemented here for brevity but should be considered for full data integrity.

      await batch.commit();
      console.log('Deleted fleet aircraft and associated rate from Firestore:', input.aircraftId);
      return { success: true, aircraftId: input.aircraftId };
    } catch (error) {
      console.error('Error deleting aircraft from Firestore:', error);
      throw new Error(`Failed to delete aircraft ${input.aircraftId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);
