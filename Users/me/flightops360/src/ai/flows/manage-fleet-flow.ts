
'use server';
/**
 * @fileOverview Genkit flows for managing the company's aircraft fleet using Firestore.
 *
 * - fetchFleetAircraft - Fetches all aircraft in the fleet.
 * - saveFleetAircraft - Saves (adds or updates) an aircraft in the fleet.
 * - deleteFleetAircraft - Deletes an aircraft from the fleet.
 */

import { ai } from '@/ai/genkit';
import { adminDb as db } from '@/lib/firebase-admin'; // USE ADMIN SDK
import { FieldValue, Timestamp } from 'firebase-admin/firestore'; // ADMIN SDK specific types

import type { 
  FleetAircraft, 
  SaveFleetAircraftInput, 
  DeleteFleetAircraftInput 
} from '@/ai/schemas/fleet-aircraft-schemas';
import { 
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
  if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchFleetAircraft (manage-fleet-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in fetchFleetAircraft.");
  }
  console.log('[ManageFleetFlow Firestore Admin] Attempting to fetch fleet aircraft.');
  return fetchFleetAircraftFlow();
}

export async function saveFleetAircraft(input: SaveFleetAircraftInput): Promise<FleetAircraft> {
  if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveFleetAircraft (manage-fleet-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in saveFleetAircraft.");
  }
  console.log('[ManageFleetFlow Firestore Admin WRAPPER] Received input for save:', input.id, 'Data:', JSON.stringify(input));
  
  const firestoreDocId = input.id || db.collection(FLEET_COLLECTION).doc().id;
  // Ensure input is prepared for the flow, which might expect slightly different structure or defaults
  const aircraftDataForFlow: FleetAircraft = {
    ...input, 
    id: firestoreDocId, // Ensure ID is set for the flow's internal logic if it relies on it
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
    propellerDetails: input.propellerDetails || [],
  };
  console.log('[ManageFleetFlow Firestore Admin WRAPPER] Data prepared for flow:', firestoreDocId, 'Data:', JSON.stringify(aircraftDataForFlow));
  // The flow itself expects the direct data, not nested under a 'aircraftData' key.
  // And the ID passed to the flow is the Firestore document ID.
  const { id: internalId, ...dataToSetInFlow } = aircraftDataForFlow; // Separate the Firestore ID
  return saveFleetAircraftFlow({ firestoreDocId, aircraftData: dataToSetInFlow as Omit<FleetAircraft, 'id'> });
}

export async function deleteFleetAircraft(input: DeleteFleetAircraftInput): Promise<{ success: boolean; aircraftId: string }> {
  if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in deleteFleetAircraft (manage-fleet-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in deleteFleetAircraft.");
  }
  console.log('[ManageFleetFlow Firestore Admin] Attempting to delete fleet aircraft:', input.aircraftId);
  return deleteFleetAircraftFlow(input);
}


// Internal schema for saveFleetAircraftFlow input for better type safety within flow
const InternalSaveFleetAircraftInputSchema = z.object({
  firestoreDocId: z.string(),
  aircraftData: SaveFleetAircraftInputSchema.omit({ id: true }), // data without the 'id' for the document content
});


// Genkit Flow Definitions
const fetchFleetAircraftFlow = ai.defineFlow(
  {
    name: 'fetchFleetAircraftFlow',
    outputSchema: FetchFleetAircraftOutputSchema, 
  },
  async () => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchFleetAircraftFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in fetchFleetAircraftFlow.");
    }
    console.log('Executing fetchFleetAircraftFlow - Firestore Admin');
    try {
      const fleetCollectionRef = db.collection(FLEET_COLLECTION);
      const snapshot = await fleetCollectionRef.get();
      const aircraftList = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Ensure fields match FleetAircraft type, providing defaults if necessary
          tailNumber: data.tailNumber || '', 
          model: data.model || '', 
          serialNumber: data.serialNumber ?? undefined,
          aircraftYear: data.aircraftYear ?? undefined, 
          baseLocation: data.baseLocation ?? undefined,
          engineDetails: data.engineDetails || [], 
          propellerDetails: data.propellerDetails || [],
          isMaintenanceTracked: data.isMaintenanceTracked ?? true,
          trackedComponentNames: data.trackedComponentNames || ['Airframe', 'Engine 1'],
          primaryContactName: data.primaryContactName ?? undefined,
          primaryContactPhone: data.primaryContactPhone ?? undefined,
          primaryContactEmail: data.primaryContactEmail ?? undefined,
          internalNotes: data.internalNotes ?? undefined,
        } as FleetAircraft; 
      });
      console.log('Fetched fleet from Firestore (Admin):', aircraftList.length, 'aircraft.');
      return aircraftList;
    } catch (error) {
      console.error('Error fetching fleet from Firestore (Admin):', error);
      throw new Error(`Failed to fetch fleet (Admin): ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const saveFleetAircraftFlow = ai.defineFlow(
  {
    name: 'saveFleetAircraftFlow',
    inputSchema: InternalSaveFleetAircraftInputSchema,
    outputSchema: SaveFleetAircraftOutputSchema, // This is FleetAircraftSchema (the complete object with ID)
  },
  async ({ firestoreDocId, aircraftData }) => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveFleetAircraftFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in saveFleetAircraftFlow.");
    }
    console.log('Executing saveFleetAircraftFlow (Admin FLOW INPUT) with Firestore ID:', firestoreDocId, 'Data:', JSON.stringify(aircraftData));
    try {
      const aircraftDocRef = db.collection(FLEET_COLLECTION).doc(firestoreDocId);
      // The aircraftData already excludes 'id'.
      await aircraftDocRef.set(aircraftData, { merge: true }); 
      console.log('Saved/Updated aircraft in Firestore (Admin):', firestoreDocId);
      
      // Return the complete aircraft object including the ID
      return { id: firestoreDocId, ...aircraftData } as FleetAircraft;
    } catch (error) {
      console.error('Error saving aircraft to Firestore (Admin):', error);
      throw new Error(`Failed to save aircraft ${firestoreDocId} (Admin): ${error instanceof Error ? error.message : String(error)}`);
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
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in deleteFleetAircraftFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in deleteFleetAircraftFlow.");
    }
    console.log('Executing deleteFleetAircraftFlow for ID (Admin) - Firestore:', input.aircraftId);
    try {
      const batch = db.batch(); // Use adminDb.batch()

      const aircraftDocRef = db.collection(FLEET_COLLECTION).doc(input.aircraftId);
      batch.delete(aircraftDocRef);

      const aircraftRateDocRef = db.collection(AIRCRAFT_RATES_COLLECTION).doc(input.aircraftId);
      batch.delete(aircraftRateDocRef);
      
      await batch.commit();
      console.log('Deleted fleet aircraft and associated rate from Firestore (Admin):', input.aircraftId);
      return { success: true, aircraftId: input.aircraftId };
    } catch (error) {
      console.error('Error deleting aircraft from Firestore (Admin):', error);
      throw new Error(`Failed to delete aircraft ${input.aircraftId} (Admin): ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

    