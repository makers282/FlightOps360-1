
'use server';
/**
 * @fileOverview Genkit flows for managing aircraft discrepancies using Firestore.
 *
 * - saveAircraftDiscrepancy - Saves (adds or updates) an aircraft discrepancy.
 * - fetchAircraftDiscrepancies - Fetches all discrepancies for a given aircraft.
 * - deleteAircraftDiscrepancy - Deletes an aircraft discrepancy.
 */

import { ai } from '@/ai/genkit';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, getDoc, getDocs, serverTimestamp, Timestamp, deleteDoc, query, where, orderBy } from 'firebase/firestore';
import { z } from 'zod';
import type { AircraftDiscrepancy, SaveAircraftDiscrepancyInput, DiscrepancyStatus } from '@/ai/schemas/aircraft-discrepancy-schemas';
import {
    SaveAircraftDiscrepancyInputSchema,
    SaveAircraftDiscrepancyOutputSchema,
    FetchAircraftDiscrepanciesInputSchema,
    FetchAircraftDiscrepanciesOutputSchema,
    DeleteAircraftDiscrepancyInputSchema,
    DeleteAircraftDiscrepancyOutputSchema,
} from '@/ai/schemas/aircraft-discrepancy-schemas';
import type { FleetAircraft } from '@/ai/schemas/fleet-aircraft-schemas'; // For fetching tail number

const DISCREPANCIES_COLLECTION = 'aircraftDiscrepancies';
const FLEET_COLLECTION = 'fleet'; // To get tail number

// Exported async functions that clients will call
export async function saveAircraftDiscrepancy(input: SaveAircraftDiscrepancyInput): Promise<AircraftDiscrepancy> {
  const discrepancyId = input.id || doc(collection(db, DISCREPANCIES_COLLECTION)).id;
  const { id, ...discrepancyDataForFlow } = input;

  return saveAircraftDiscrepancyFlow({ 
    firestoreDocId: discrepancyId, 
    discrepancyData: discrepancyDataForFlow as Omit<SaveAircraftDiscrepancyInput, 'id'>
  });
}

export async function fetchAircraftDiscrepancies(input: { aircraftId: string }): Promise<AircraftDiscrepancy[]> {
  return fetchAircraftDiscrepanciesFlow(input);
}

export async function deleteAircraftDiscrepancy(input: { discrepancyId: string }): Promise<{ success: boolean; discrepancyId: string }> {
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
    const discrepancyDocRef = doc(db, DISCREPANCIES_COLLECTION, firestoreDocId);
    try {
      const docSnap = await getDoc(discrepancyDocRef);
      
      let aircraftTailNumber: string | undefined = undefined;
      if (discrepancyData.aircraftId) {
        const aircraftDocRef = doc(db, FLEET_COLLECTION, discrepancyData.aircraftId);
        const aircraftSnap = await getDoc(aircraftDocRef);
        if (aircraftSnap.exists()) {
          const aircraft = aircraftSnap.data() as FleetAircraft;
          aircraftTailNumber = aircraft.tailNumber;
        }
      }

      let statusToSet: DiscrepancyStatus;
      const existingStatus = docSnap.exists() ? docSnap.data().status as DiscrepancyStatus : undefined;

      if (existingStatus === "Closed") {
        statusToSet = "Closed"; // Do not change a closed status from this simplified modal
      } else if (discrepancyData.isDeferred) {
        statusToSet = "Deferred";
      } else {
        statusToSet = "Open";
      }

      const dataToSet = {
        ...discrepancyData, // Contains fields like isDeferred, deferralReference, deferralDate
        status: statusToSet,
        // timeDiscovered is no longer passed or saved
        aircraftTailNumber: aircraftTailNumber || discrepancyData.aircraftTailNumber, 
        updatedAt: serverTimestamp(),
        createdAt: docSnap.exists() && docSnap.data().createdAt ? docSnap.data().createdAt : serverTimestamp(),
      };

      // Remove timeDiscovered explicitly if it somehow exists in discrepancyData (it shouldn't due to schema omit)
      delete (dataToSet as any).timeDiscovered;


      await setDoc(discrepancyDocRef, dataToSet, { merge: true });
      const savedDoc = await getDoc(discrepancyDocRef);
      const savedData = savedDoc.data();

      if (!savedData) {
        throw new Error("Failed to retrieve saved discrepancy data from Firestore.");
      }

      // Ensure savedData doesn't include timeDiscovered before returning
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
    try {
      const discrepanciesCollectionRef = collection(db, DISCREPANCIES_COLLECTION);
      const q = query(
        discrepanciesCollectionRef, 
        where("aircraftId", "==", input.aircraftId)
      );
      const snapshot = await getDocs(q);
      const discrepanciesList = snapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        // Ensure timeDiscovered is not included in the returned object
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

const deleteAircraftDiscrepancyFlow = ai.defineFlow(
  {
    name: 'deleteAircraftDiscrepancyFlow',
    inputSchema: DeleteAircraftDiscrepancyInputSchema,
    outputSchema: DeleteAircraftDiscrepancyOutputSchema,
  },
  async (input) => {
    try {
      const discrepancyDocRef = doc(db, DISCREPANCIES_COLLECTION, input.discrepancyId);
      await deleteDoc(discrepancyDocRef);
      return { success: true, discrepancyId: input.discrepancyId };
    } catch (error) {
      console.error('Error deleting aircraft discrepancy from Firestore:', error);
      throw new Error(`Failed to delete discrepancy ${input.discrepancyId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

    
