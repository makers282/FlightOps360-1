
'use server';
/**
 * @fileOverview Genkit flows for managing aircraft block-out events using Firestore.
 *
 * - saveAircraftBlockOut - Saves (adds or updates) an aircraft block-out event.
 * - fetchAircraftBlockOuts - Fetches all aircraft block-out events.
 * - deleteAircraftBlockOut - Deletes an aircraft block-out event.
 */

import { ai } from '@/ai/genkit';
import { adminDb as db } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
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
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveAircraftBlockOut (manage-aircraft-block-outs-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in saveAircraftBlockOut.");
  }
  const firestoreDocId = input.id || db.collection(AIRCRAFT_BLOCK_OUTS_COLLECTION).doc().id;
  // Remove id from data if it was passed in, as it's the doc key for the flow's perspective
  const { id, ...blockOutDataForFlow } = input;
  return saveAircraftBlockOutFlow({ firestoreDocId, blockOutData: blockOutDataForFlow as Omit<SaveAircraftBlockOutInput, 'id'> });
}

export async function fetchAircraftBlockOuts(): Promise<AircraftBlockOut[]> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchAircraftBlockOuts (manage-aircraft-block-outs-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in fetchAircraftBlockOuts.");
  }
  return fetchAircraftBlockOutsFlow();
}

export async function deleteAircraftBlockOut(input: DeleteAircraftBlockOutInput): Promise<{ success: boolean; blockOutId: string }> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in deleteAircraftBlockOut (manage-aircraft-block-outs-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in deleteAircraftBlockOut.");
  }
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
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveAircraftBlockOutFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in saveAircraftBlockOutFlow.");
    }
    const blockOutDocRef = db.collection(AIRCRAFT_BLOCK_OUTS_COLLECTION).doc(firestoreDocId);
    try {
      const docSnap = await blockOutDocRef.get();
      // The blockOutData already contains aircraftId, title, startDate, endDate, aircraftLabel
      // We just need to manage createdAt and updatedAt timestamps.
      const dataToSet = {
        ...blockOutData, // Contains aircraftId, aircraftLabel, title, startDate, endDate
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: docSnap.exists && docSnap.data()?.createdAt ? docSnap.data()?.createdAt : FieldValue.serverTimestamp(),
      };

      await blockOutDocRef.set(dataToSet, { merge: true });
      const savedDoc = await blockOutDocRef.get();
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
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchAircraftBlockOutsFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in fetchAircraftBlockOutsFlow.");
    }
    try {
      const blockOutsCollectionRef = db.collection(AIRCRAFT_BLOCK_OUTS_COLLECTION);
      const q = blockOutsCollectionRef.orderBy("startDate", "desc");
      const snapshot = await q.get();
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
    } catch (error)
 {
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
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in deleteAircraftBlockOutFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in deleteAircraftBlockOutFlow.");
    }
    try {
      const blockOutDocRef = db.collection(AIRCRAFT_BLOCK_OUTS_COLLECTION).doc(input.blockOutId);
      await blockOutDocRef.delete();
      return { success: true, blockOutId: input.blockOutId };
    } catch (error) {
      console.error('Error deleting aircraft block-out from Firestore:', error);
      throw new Error(`Failed to delete block-out ${input.blockOutId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);
