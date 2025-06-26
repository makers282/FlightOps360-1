
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
import {
  FleetAircraft,
  SaveFleetAircraftInput,
  DeleteFleetAircraftInput,
  SaveFleetAircraftInputSchema,
  DeleteFleetAircraftInputSchema,
  FetchFleetAircraftOutputSchema,
  SaveFleetAircraftOutputSchema,
  DeleteFleetAircraftOutputSchema,
} from '@/ai/schemas/fleet-aircraft-schemas';
import { z } from 'zod';

const FLEET_COLLECTION = 'fleet';
const AIRCRAFT_RATES_COLLECTION = 'aircraftRates'; // For cascading delete

// Mock data to return if the fleet is empty
const mockFleetAircraftList: FleetAircraft[] = [
  {
    id: 'N1327J',
    tailNumber: 'N1327J',
    model: 'Cessna Citation 525',
    serialNumber: '525-0123',
    aircraftYear: 2003,
    baseLocation: 'KTEB',
    isMaintenanceTracked: true,
    trackedComponentNames: ['Airframe', 'Engine 1', 'Engine 2'],
    engineDetails: [{ model: 'Williams FJ44', serialNumber: 'E1-123' }, { model: 'Williams FJ44', serialNumber: 'E2-456' }],
    propellerDetails: [],
  },
  {
    id: 'N630MW',
    tailNumber: 'N630MW',
    model: 'Piper PA-31T2',
    serialNumber: 'PA31T2-0456',
    aircraftYear: 1998,
    baseLocation: 'KHPN',
    isMaintenanceTracked: true,
    trackedComponentNames: ['Airframe', 'Engine 1', 'Engine 2', 'Propeller 1', 'Propeller 2'],
    engineDetails: [{ model: 'PT6A-135', serialNumber: 'PE-111' }, { model: 'PT6A-135', serialNumber: 'PE-222' }],
    propellerDetails: [{ model: 'Hartzell HC-E4N-3', serialNumber: 'P1-ABC' }, { model: 'Hartzell HC-E4N-3', serialNumber: 'P2-DEF' }],
  },
  {
    id: 'N907DK',
    tailNumber: 'N907DK',
    model: 'Cessna Citation 525',
    serialNumber: '525-0456',
    aircraftYear: 2008,
    baseLocation: 'KDAL',
    isMaintenanceTracked: false, // Example of not tracked
    trackedComponentNames: [],
    engineDetails: [{ model: 'Williams FJ44', serialNumber: 'E1-789' }, { model: 'Williams FJ44', serialNumber: 'E2-101' }],
    propellerDetails: [],
  }
];


/**
 * Removes properties with `undefined` values from an object.
 * Firestore does not allow `undefined` as a field value.
 * @param obj The object to clean.
 * @returns A new object with `undefined` properties removed.
 */
function removeUndefined(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined);
  }
  const newObj: { [key: string]: any } = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key) && obj[key] !== undefined) {
      newObj[key] = removeUndefined(obj[key]);
    }
  }
  return newObj;
}

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
  
  // The flow itself expects the direct data, not nested under a 'aircraftData' key.
  const { id: internalId, ...dataToSetInFlow } = { ...input, id: firestoreDocId };
  
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
      
      if (snapshot.empty) {
        console.log('No fleet aircraft found in Firestore. Returning mock data for testing.');
        return mockFleetAircraftList;
      }

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
          imageUrl: data.imageUrl ?? undefined,
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
    
    // Clean the object to remove any `undefined` values before saving
    const cleanedAircraftData = removeUndefined(aircraftData);

    console.log('Executing saveFleetAircraftFlow (Admin FLOW INPUT) with Firestore ID:', firestoreDocId, 'Cleaned Data:', JSON.stringify(cleanedAircraftData));
    try {
      const aircraftDocRef = db.collection(FLEET_COLLECTION).doc(firestoreDocId);
      // Save the cleaned data
      await aircraftDocRef.set(cleanedAircraftData, { merge: true }); 
      console.log('Saved/Updated aircraft in Firestore (Admin):', firestoreDocId);
      
      // Return the complete aircraft object including the ID
      return { id: firestoreDocId, ...cleanedAircraftData } as FleetAircraft;
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
