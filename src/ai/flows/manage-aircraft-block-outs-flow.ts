
'use server';
/**
 * @fileOverview Genkit flows for managing aircraft block-out events using Firestore.
 *
 * - saveAircraftBlockOut - Saves (adds or updates) an aircraft block-out event.
 * - fetchAircraftBlockOuts - Fetches all aircraft block-out events.
 * - deleteAircraftBlockOut - Deletes an aircraft block-out event.
 */

import { ai } from '@/ai/genkit';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, getDoc, getDocs, serverTimestamp, Timestamp, deleteDoc, query, orderBy } from 'firebase/firestore';
import { z } from 'zod';
import type { AircraftBlockOut, SaveAircraftBlockOutInput, DeleteAircraftBlockOutInput } from '@/ai/schemas/aircraft-block-out-schemas';
import {
    // AircraftBlockOutSchema is used for type, not directly in flow schema definition here
    SaveAircraftBlockOutInputSchema,
    SaveAircraftBlockOutOutputSchema,
    FetchAircraftBlockOutsOutputSchema,
    DeleteAircraftBlockOutInputSchema,
    DeleteAircraftBlockOutOutputSchema,
} from '@/ai/schemas/aircraft-block-out-schemas';

const AIRCRAFT_BLOCK_OUTS_COLLECTION = 'aircraftBlockOuts';

// Exported async functions that clients will call
export async function saveAircraftBlockOut(input: SaveAircraftBlockOutInput): Promise<AircraftBlockOut> {
  const firestoreDocId = input.id || doc(collection(db, AIRCRAFT_BLOCK_OUTS_COLLECTION)).id;
  // Remove id from data if it was passed in, as it's the doc key for the flow's perspective
  const { id, ...blockOutDataForFlow } = input;
  return saveAircraftBlockOutFlow({ firestoreDocId, blockOutData: blockOutDataForFlow as Omit<SaveAircraftBlockOutInput, 'id'> });
}

export async function fetchAircraftBlockOuts(): Promise<AircraftBlockOut[]> {
  return fetchAircraftBlockOutsFlow();
}

export async function deleteAircraftBlockOut(input: DeleteAircraftBlockOutInput): Promise<{ success: boolean; blockOutId: string }> {
  return deleteAircraftBlockOutFlow(input);
}


// Internal Genkit Flow Schemas and Definitions
const InternalSaveAircraftBlockOutInputSchema = z.object({
  firestoreDocId: z.string(),
  blockOutData: SaveAircraftBlockOutInputSchema.omit({ id: true }), // Data without the ID field
});

const saveAircraftBlockOutFlow = ai.defineFlow(
  {
    name: 'saveAircraftBlockOutFlow',
    inputSchema: InternalSaveAircraftBlockOutInputSchema,
    outputSchema: SaveAircraftBlockOutOutputSchema,
  },
  async ({ firestoreDocId, blockOutData }) => {
    const blockOutDocRef = doc(db, AIRCRAFT_BLOCK_OUTS_COLLECTION, firestoreDocId);
    try {
      const docSnap = await getDoc(blockOutDocRef);
      // The blockOutData already contains aircraftId, title, startDate, endDate, aircraftLabel
      // We just need to manage createdAt and updatedAt timestamps.
      const dataToSet = {
        ...blockOutData, // Contains aircraftId, aircraftLabel, title, startDate, endDate
        updatedAt: serverTimestamp(),
        createdAt: docSnap.exists() && docSnap.data().createdAt ? docSnap.data().createdAt : serverTimestamp(),
      };

      await setDoc(blockOutDocRef, dataToSet, { merge: true });
      const savedDoc = await getDoc(blockOutDocRef);
      const savedData = savedDoc.data();

      if (!savedData) {
        throw new Error("Failed to retrieve saved block-out data from Firestore.");
      }

      return {
        ...savedData,
        id: firestoreDocId, // Ensure the document ID is part of the returned object
        // Dates are already ISO strings from input, Firestore stores them as is or Timestamps if converted
        startDate: savedData.startDate,
        endDate: savedData.endDate,
        createdAt: (savedData.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        updatedAt: (savedData.updatedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
      } as AircraftBlockOut;
    } catch (error) {
      console.error('Error saving aircraft block-out to Firestore:', error);
      throw new Error(`Failed to save block-out ${firestoreDocId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const fetchAircraftBlockOutsFlow = ai.defineFlow(
  {
    name: 'fetchAircraftBlockOutsFlow',
    outputSchema: FetchAircraftBlockOutsOutputSchema,
  },
  async () => {
    try {
      const blockOutsCollectionRef = collection(db, AIRCRAFT_BLOCK_OUTS_COLLECTION);
      const q = query(blockOutsCollectionRef, orderBy("startDate", "desc"));
      const snapshot = await getDocs(q);
      const blockOutsList = snapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        return {
          ...data,
          id: docSnapshot.id,
          startDate: data.startDate, // Dates are stored as ISO strings
          endDate: data.endDate,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
        } as AircraftBlockOut;
      });
      return blockOutsList;
    } catch (error) {
      console.error('Error fetching aircraft block-outs from Firestore:', error);
      throw new Error(`Failed to fetch aircraft block-outs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const deleteAircraftBlockOutFlow = ai.defineFlow(
  {
    name: 'deleteAircraftBlockOutFlow',
    inputSchema: DeleteAircraftBlockOutInputSchema,
    outputSchema: DeleteAircraftBlockOutOutputSchema,
  },
  async (input) => {
    try {
      const blockOutDocRef = doc(db, AIRCRAFT_BLOCK_OUTS_COLLECTION, input.blockOutId);
      await deleteDoc(blockOutDocRef);
      return { success: true, blockOutId: input.blockOutId };
    } catch (error) {
      console.error('Error deleting aircraft block-out from Firestore:', error);
      throw new Error(`Failed to delete block-out ${input.blockOutId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);
