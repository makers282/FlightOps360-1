
'use server';
/**
 * @fileOverview Genkit flows for managing company bulletins using Firestore.
 *
 * - saveBulletin - Saves (adds or updates) a bulletin.
 * - fetchBulletins - Fetches all bulletins, ordered by published date.
 * - deleteBulletin - Deletes a bulletin.
 */

import { ai } from '@/ai/genkit';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, getDoc, getDocs, serverTimestamp, Timestamp, deleteDoc, query, orderBy } from 'firebase/firestore';
import { z } from 'zod';
import type { Bulletin, SaveBulletinInput } from '@/ai/schemas/bulletin-schemas';
import {
    SaveBulletinInputSchema,
    SaveBulletinOutputSchema,
    FetchBulletinsOutputSchema,
    DeleteBulletinInputSchema,
    DeleteBulletinOutputSchema,
} from '@/ai/schemas/bulletin-schemas';

const BULLETINS_COLLECTION = 'bulletins';

// Exported async functions that clients will call
export async function saveBulletin(input: SaveBulletinInput): Promise<Bulletin> {
  const bulletinId = input.id || doc(collection(db, BULLETINS_COLLECTION)).id;
  // Remove id from data if it was passed in, as it's the doc key for the flow's perspective
  const { id, ...bulletinDataForFlow } = input;
  return saveBulletinFlow({ firestoreDocId: bulletinId, bulletinData: bulletinDataForFlow as Omit<SaveBulletinInput, 'id'> });
}

export async function fetchBulletins(): Promise<Bulletin[]> {
  return fetchBulletinsFlow();
}

export async function deleteBulletin(input: { bulletinId: string }): Promise<{ success: boolean; bulletinId: string }> {
  return deleteBulletinFlow(input);
}


// Internal Genkit Flow Schemas and Definitions
const InternalSaveBulletinInputSchema = z.object({
  firestoreDocId: z.string(),
  bulletinData: SaveBulletinInputSchema.omit({ id: true }), // Data without the ID field
});

const saveBulletinFlow = ai.defineFlow(
  {
    name: 'saveBulletinFlow',
    inputSchema: InternalSaveBulletinInputSchema,
    outputSchema: SaveBulletinOutputSchema,
  },
  async ({ firestoreDocId, bulletinData }) => {
    const bulletinDocRef = doc(db, BULLETINS_COLLECTION, firestoreDocId);
    try {
      const docSnap = await getDoc(bulletinDocRef);
      const dataToSet = {
        ...bulletinData,
        publishedAt: serverTimestamp(), // Treat publishedAt as "last saved/effective" time
        updatedAt: serverTimestamp(),
        createdAt: docSnap.exists() && docSnap.data().createdAt ? docSnap.data().createdAt : serverTimestamp(),
      };

      await setDoc(bulletinDocRef, dataToSet, { merge: true });
      const savedDoc = await getDoc(bulletinDocRef);
      const savedData = savedDoc.data();

      if (!savedData) {
        throw new Error("Failed to retrieve saved bulletin data from Firestore.");
      }

      return {
        ...savedData,
        id: firestoreDocId,
        publishedAt: (savedData.publishedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        createdAt: (savedData.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        updatedAt: (savedData.updatedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
      } as Bulletin;
    } catch (error) {
      console.error('Error saving bulletin to Firestore:', error);
      throw new Error(`Failed to save bulletin ${firestoreDocId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const fetchBulletinsFlow = ai.defineFlow(
  {
    name: 'fetchBulletinsFlow',
    outputSchema: FetchBulletinsOutputSchema,
  },
  async () => {
    try {
      const bulletinsCollectionRef = collection(db, BULLETINS_COLLECTION);
      // Order by publishedAt descending to get latest bulletins first
      const q = query(bulletinsCollectionRef, orderBy("publishedAt", "desc"));
      const snapshot = await getDocs(q);
      const bulletinsList = snapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        return {
          ...data,
          id: docSnapshot.id,
          publishedAt: (data.publishedAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
        } as Bulletin;
      });
      return bulletinsList;
    } catch (error) {
      console.error('Error fetching bulletins from Firestore:', error);
      throw new Error(`Failed to fetch bulletins: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const deleteBulletinFlow = ai.defineFlow(
  {
    name: 'deleteBulletinFlow',
    inputSchema: DeleteBulletinInputSchema,
    outputSchema: DeleteBulletinOutputSchema,
  },
  async (input) => {
    try {
      const bulletinDocRef = doc(db, BULLETINS_COLLECTION, input.bulletinId);
      await deleteDoc(bulletinDocRef);
      return { success: true, bulletinId: input.bulletinId };
    } catch (error) {
      console.error('Error deleting bulletin from Firestore:', error);
      throw new Error(`Failed to delete bulletin ${input.bulletinId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);
