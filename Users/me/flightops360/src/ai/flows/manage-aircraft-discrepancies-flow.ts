
'use server';
/**
 * @fileOverview Genkit flows for managing aircraft discrepancies using Firestore.
 *
 * - saveAircraftDiscrepancy - Saves (adds or updates) an aircraft discrepancy.
 * - fetchAircraftDiscrepancies - Fetches all discrepancies for a given aircraft.
 * - fetchAllAircraftDiscrepancies - Fetches all discrepancies across all aircraft.
 * - deleteAircraftDiscrepancy - Deletes an aircraft discrepancy.
 */

import { ai } from '@/ai/genkit';
import { adminDb as db } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { AircraftDiscrepancy, SaveAircraftDiscrepancyInput, DiscrepancyStatus } from '@/ai/schemas/aircraft-discrepancy-schemas';
import {
    SaveAircraftDiscrepancyInputSchema,
    SaveAircraftDiscrepancyOutputSchema,
    FetchAircraftDiscrepanciesInputSchema,
    FetchAircraftDiscrepanciesOutputSchema, // This is z.array(AircraftDiscrepancySchema)
    DeleteAircraftDiscrepancyInputSchema,
    DeleteAircraftDiscrepancyOutputSchema,
} from '@/ai/schemas/aircraft-discrepancy-schemas';
import type { FleetAircraft } from '@/ai/schemas/fleet-aircraft-schemas'; // For fetching tail number

const DISCREPANCIES_COLLECTION = 'aircraftDiscrepancies';
const FLEET_COLLECTION = 'fleet'; // To get tail number

// Exported async functions that clients will call
export async function saveAircraftDiscrepancy(input: SaveAircraftDiscrepancyInput): Promise<AircraftDiscrepancy> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveAircraftDiscrepancy (manage-aircraft-discrepancies-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in saveAircraftDiscrepancy.");
  }
  const discrepancyId = input.id || db.collection(DISCREPANCIES_COLLECTION).doc().id;
  const { id, ...discrepancyDataForFlow } = input;

  return saveAircraftDiscrepancyFlow({ 
    firestoreDocId: discrepancyId, 
    discrepancyData: discrepancyDataForFlow as Omit<SaveAircraftDiscrepancyInput, 'id'>
  });
}

export async function fetchAircraftDiscrepancies(input: { aircraftId: string }): Promise<AircraftDiscrepancy[]> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchAircraftDiscrepancies (manage-aircraft-discrepancies-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in fetchAircraftDiscrepancies.");
  }
  return fetchAircraftDiscrepanciesFlow(input);
}

export async function fetchAllAircraftDiscrepancies(): Promise<AircraftDiscrepancy[]> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchAllAircraftDiscrepancies (manage-aircraft-discrepancies-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in fetchAllAircraftDiscrepancies.");
  }
  return fetchAllAircraftDiscrepanciesFlow();
}

export async function deleteAircraftDiscrepancy(input: { discrepancyId: string }): Promise<{ success: boolean; discrepancyId: string }> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in deleteAircraftDiscrepancy (manage-aircraft-discrepancies-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in deleteAircraftDiscrepancy.");
  }
  return deleteAircraftDiscrepancyFlow(input);
}


// Internal Genkit Flow Schemas and Definitions
const InternalSaveAircraftDiscrepancyInputSchema = z.object({
  firestoreDocId: z.string(),
  discrepancyData: SaveAircraftDiscrepancyInputSchema.omit({ id: true }),
});

const saveAircraftDiscrepancyFlow = ai.defineFlow(
  {
    name: 'saveAircraftDiscrepancyFlow',
    inputSchema: InternalSaveAircraftDiscrepancyInputSchema,
    outputSchema: SaveAircraftDiscrepancyOutputSchema,
  },
  async ({ firestoreDocId, discrepancyData }) => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveAircraftDiscrepancyFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in saveAircraftDiscrepancyFlow.");
    }
    const discrepancyDocRef = db.collection(DISCREPANCIES_COLLECTION).doc(firestoreDocId);
    try {
      const docSnap = await discrepancyDocRef.get();
      
      let aircraftTailNumber: string | undefined = undefined;
      if (discrepancyData.aircraftId) {
        const aircraftDocRef = db.collection(FLEET_COLLECTION).doc(discrepancyData.aircraftId);
        const aircraftSnap = await aircraftDocRef.get();
        if (aircraftSnap.exists) {
          const aircraft = aircraftSnap.data() as FleetAircraft;
          aircraftTailNumber = aircraft.tailNumber;
        }
      }

      let statusToSet: DiscrepancyStatus;
      const existingStatus = docSnap.exists ? docSnap.data()?.status as DiscrepancyStatus : undefined;

      if (discrepancyData.status) {
        statusToSet = discrepancyData.status;
      } else if (existingStatus === "Closed") {
        statusToSet = "Closed"; 
      } else if (discrepancyData.isDeferred) {
        statusToSet = "Deferred";
      } else {
        statusToSet = "Open";
      }
      
      const isDeferredToSet = statusToSet === "Closed" ? false : discrepancyData.isDeferred;

      const dataToSet = {
        ...discrepancyData,
        status: statusToSet,
        isDeferred: isDeferredToSet, 
        aircraftTailNumber: aircraftTailNumber || discrepancyData.aircraftTailNumber, 
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: docSnap.exists && docSnap.data()?.createdAt ? docSnap.data()?.createdAt : FieldValue.serverTimestamp(),
      };

      delete (dataToSet as any).timeDiscovered;

      await discrepancyDocRef.set(dataToSet, { merge: true });
      const savedDoc = await discrepancyDocRef.get();
      const savedData = savedDoc.data();

      if (!savedData) {
        throw new Error("Failed to retrieve saved discrepancy data from Firestore.");
      }

      const { timeDiscovered, ...returnData } = savedData;

      return {
        ...returnData,
        id: firestoreDocId,
        createdAt: (savedData.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        updatedAt: (savedData.updatedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
      } as AircraftDiscrepancy;
    } catch (error) {
      console.error('Error saving aircraft discrepancy to Firestore:', error);
      throw new Error(`Failed to save discrepancy ${firestoreDocId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const fetchAircraftDiscrepanciesFlow = ai.defineFlow(
  {
    name: 'fetchAircraftDiscrepanciesFlow',
    inputSchema: FetchAircraftDiscrepanciesInputSchema,
    outputSchema: FetchAircraftDiscrepanciesOutputSchema,
  },
  async (input) => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchAircraftDiscrepanciesFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in fetchAircraftDiscrepanciesFlow.");
    }
    try {
      const discrepanciesCollectionRef = db.collection(DISCREPANCIES_COLLECTION);
      const q = discrepanciesCollectionRef.where("aircraftId", "==", input.aircraftId);
      const snapshot = await q.get();
      const discrepanciesList = snapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        const { timeDiscovered, ...displayData } = data;
        return {
          ...displayData,
          id: docSnapshot.id,
          dateDiscovered: data.dateDiscovered || '1970-01-01', 
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
        } as AircraftDiscrepancy;
      });

      discrepanciesList.sort((a, b) => {
        const dateComparison = b.dateDiscovered.localeCompare(a.dateDiscovered);
        if (dateComparison !== 0) {
          return dateComparison;
        }
        return b.createdAt.localeCompare(a.createdAt);
      });

      return discrepanciesList;
    } catch (error) {
      console.error('Error fetching aircraft discrepancies from Firestore:', error);
      throw new Error(`Failed to fetch discrepancies for aircraft ${input.aircraftId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const fetchAllAircraftDiscrepanciesFlow = ai.defineFlow(
  {
    name: 'fetchAllAircraftDiscrepanciesFlow',
    outputSchema: FetchAircraftDiscrepanciesOutputSchema, 
  },
  async () => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchAllAircraftDiscrepanciesFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in fetchAllAircraftDiscrepanciesFlow.");
    }
    try {
      const discrepanciesCollectionRef = db.collection(DISCREPANCIES_COLLECTION);
      const q = discrepanciesCollectionRef
        .orderBy("dateDiscovered", "desc")
        .orderBy("createdAt", "desc");
      const snapshot = await q.get();
      const discrepanciesList = snapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        const { timeDiscovered, ...displayData } = data; 
        return {
          ...displayData,
          id: docSnapshot.id,
          dateDiscovered: data.dateDiscovered || '1970-01-01', 
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
        } as AircraftDiscrepancy;
      });
      return discrepanciesList;
    } catch (error) {
      console.error('Error fetching all aircraft discrepancies from Firestore:', error);
      throw new Error(`Failed to fetch all aircraft discrepancies: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const deleteAircraftDiscrepancyFlow = ai.defineFlow(
  {
    name: 'deleteAircraftDiscrepancyFlow',
    inputSchema: DeleteAircraftDiscrepancyInputSchema,
    outputSchema: DeleteAircraftDiscrepancyOutputSchema,
  },
  async (input) => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in deleteAircraftDiscrepancyFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in deleteAircraftDiscrepancyFlow.");
    }
    try {
      const discrepancyDocRef = db.collection(DISCREPANCIES_COLLECTION).doc(input.discrepancyId);
      await discrepancyDocRef.delete();
      return { success: true, discrepancyId: input.discrepancyId };
    } catch (error) {
      console.error('Error deleting aircraft discrepancy from Firestore:', error);
      throw new Error(`Failed to delete discrepancy ${input.discrepancyId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

    