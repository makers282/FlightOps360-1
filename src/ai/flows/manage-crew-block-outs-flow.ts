'use server';
/**
 * @fileOverview Genkit flows for managing crew member block-out events using Firestore.
 */

import { ai } from '@/ai/genkit';
import { adminDb as db } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { CrewBlockOut, SaveCrewBlockOutInput, DeleteCrewBlockOutInput } from '@/ai/schemas/crew-block-out-schemas';
import {
    SaveCrewBlockOutInputSchema,
    SaveCrewBlockOutOutputSchema,
    FetchCrewBlockOutsOutputSchema,
    DeleteCrewBlockOutInputSchema,
    DeleteCrewBlockOutOutputSchema,
} from '@/ai/schemas/crew-block-out-schemas';

const CREW_BLOCK_OUTS_COLLECTION = 'crewBlockOuts';

export async function saveCrewBlockOut(input: SaveCrewBlockOutInput): Promise<CrewBlockOut> {
    if (!db) { throw new Error("Firestore admin instance (db) is not initialized."); }
    const firestoreDocId = input.id || db.collection(CREW_BLOCK_OUTS_COLLECTION).doc().id;
    const { id, ...blockOutDataForFlow } = input;
    return saveCrewBlockOutFlow({ firestoreDocId, blockOutData: blockOutDataForFlow as Omit<SaveCrewBlockOutInput, 'id'> });
}

export async function fetchCrewBlockOuts(): Promise<CrewBlockOut[]> {
    if (!db) { throw new Error("Firestore admin instance (db) is not initialized."); }
    return fetchCrewBlockOutsFlow();
}

export async function deleteCrewBlockOut(input: { blockOutId: string }): Promise<{ success: boolean; blockOutId: string }> {
    if (!db) { throw new Error("Firestore admin instance (db) is not initialized."); }
    return deleteCrewBlockOutFlow({ blockOutId: input.blockOutId });
}

const InternalSaveCrewBlockOutInputSchema = z.object({
    firestoreDocId: z.string(),
    blockOutData: SaveCrewBlockOutInputSchema.omit({ id: true }),
});

const saveCrewBlockOutFlow = ai.defineFlow(
  {
    name: 'saveCrewBlockOutFlow',
    inputSchema: InternalSaveCrewBlockOutInputSchema,
    outputSchema: SaveCrewBlockOutOutputSchema,
  },
  async ({ firestoreDocId, blockOutData }) => {
    if (!db) { throw new Error("Firestore admin instance (db) is not initialized in flow."); }
    const blockOutDocRef = db.collection(CREW_BLOCK_OUTS_COLLECTION).doc(firestoreDocId);
    try {
      const docSnap = await blockOutDocRef.get();
      const dataToSet = {
        ...blockOutData,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: docSnap.exists && docSnap.data()?.createdAt ? docSnap.data()?.createdAt : FieldValue.serverTimestamp(),
      };

      await blockOutDocRef.set(dataToSet, { merge: true });
      const savedDoc = await blockOutDocRef.get();
      const savedData = savedDoc.data()!;

      return {
        ...savedData,
        id: firestoreDocId,
        startDate: savedData.startDate,
        endDate: savedData.endDate,
        createdAt: (savedData.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        updatedAt: (savedData.updatedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
      } as CrewBlockOut;
    } catch (error) {
      console.error('Error saving crew block-out:', error);
      throw new Error(`Failed to save crew block-out: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const fetchCrewBlockOutsFlow = ai.defineFlow(
  {
    name: 'fetchCrewBlockOutsFlow',
    outputSchema: FetchCrewBlockOutsOutputSchema,
  },
  async () => {
    if (!db) { throw new Error("Firestore admin instance (db) is not initialized in flow."); }
    try {
      const snapshot = await db.collection(CREW_BLOCK_OUTS_COLLECTION).orderBy("startDate", "desc").get();
      const blockOutsList = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          startDate: data.startDate,
          endDate: data.endDate,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
        } as CrewBlockOut;
      });
      return blockOutsList;
    } catch (error) {
      console.error('Error fetching crew block-outs:', error);
      throw new Error(`Failed to fetch crew block-outs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const deleteCrewBlockOutFlow = ai.defineFlow(
  {
    name: 'deleteCrewBlockOutFlow',
    inputSchema: DeleteCrewBlockOutInputSchema,
    outputSchema: DeleteCrewBlockOutOutputSchema,
  },
  async (input) => {
    if (!db) { throw new Error("Firestore admin instance (db) is not initialized in flow."); }
    try {
      await db.collection(CREW_BLOCK_OUTS_COLLECTION).doc(input.blockOutId).delete();
      return { success: true, blockOutId: input.blockOutId };
    } catch (error) {
      console.error('Error deleting crew block-out:', error);
      throw new Error(`Failed to delete block-out: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);
