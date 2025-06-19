
'use server';
/**
 * @fileOverview Genkit flows for managing company bulletins using Firestore.
 *
 * - saveBulletin - Saves (adds or updates) a bulletin.
 * - fetchBulletins - Fetches all bulletins, ordered by published date.
 * - deleteBulletin - Deletes a bulletin.
 */

import { ai } from '@/ai/genkit';
import { adminDb as db } from '@/lib/firebase-admin';
// Import Admin SDK specific Firestore types/functions
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { Bulletin, SaveBulletinInput } from '@/ai/schemas/bulletin-schemas';
import {
    SaveBulletinInputSchema,
    SaveBulletinOutputSchema,
    FetchBulletinsOutputSchema,
    DeleteBulletinInputSchema,
    DeleteBulletinOutputSchema,
} from '@/ai/schemas/bulletin-schemas';
import { createNotification } from '@/ai/flows/manage-notifications-flow';

const BULLETINS_COLLECTION = 'bulletins';

// Exported async functions that clients will call
export async function saveBulletin(input: SaveBulletinInput): Promise<Bulletin> {
  if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveBulletin. Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in saveBulletin.");
  }
  const bulletinId = input.id || db.collection(BULLETINS_COLLECTION).doc().id;
  const { id, ...bulletinDataForFlow } = input;
  return saveBulletinFlow({ firestoreDocId: bulletinId, bulletinData: bulletinDataForFlow as Omit<SaveBulletinInput, 'id'> });
}

export async function fetchBulletins(): Promise<Bulletin[]> {
  if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchBulletins. Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in fetchBulletins.");
  }
  return fetchBulletinsFlow();
}

export async function deleteBulletin(input: { bulletinId: string }): Promise<{ success: boolean; bulletinId: string }> {
  if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in deleteBulletin. Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in deleteBulletin.");
  }
  return deleteBulletinFlow(input);
}

const InternalSaveBulletinInputSchema = z.object({
  firestoreDocId: z.string(),
  bulletinData: SaveBulletinInputSchema.omit({ id: true }),
});

const saveBulletinFlow = ai.defineFlow(
  {
    name: 'saveBulletinFlow',
    inputSchema: InternalSaveBulletinInputSchema,
    outputSchema: SaveBulletinOutputSchema,
  },
  async ({ firestoreDocId, bulletinData }) => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveBulletinFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in saveBulletinFlow.");
    }
    const bulletinDocRef = db.collection(BULLETINS_COLLECTION).doc(firestoreDocId);
    try {
      const docSnap = await bulletinDocRef.get();
      const wasActiveBefore = docSnap.exists ? (docSnap.data()?.isActive === true) : false;

      const dataToSet = {
        ...bulletinData,
        publishedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: (docSnap.exists && docSnap.data()?.createdAt) ? docSnap.data()?.createdAt : FieldValue.serverTimestamp(),
      };

      await bulletinDocRef.set(dataToSet, { merge: true });
      const savedDoc = await bulletinDocRef.get();
      const savedData = savedDoc.data();

      if (!savedData) {
        throw new Error("Failed to retrieve saved bulletin data from Firestore.");
      }

      const isNowActive = savedData.isActive === true;
      const shouldCreateNotification = isNowActive && (!docSnap.exists || !wasActiveBefore);

      if (shouldCreateNotification) {
        try {
          await createNotification({
            type: 'info',
            title: `New Bulletin: ${savedData.title}`,
            message: `A company bulletin titled "${savedData.title}" has been published. Check the dashboard for details.`,
            timestamp: new Date().toISOString(),
            isRead: false,
            link: '/dashboard',
          });
          console.log(`Notification created for bulletin: ${savedData.title}`);
        } catch (notificationError) {
          console.error('Failed to create notification for bulletin:', notificationError);
          // Do not let notification failure stop the bulletin save flow
        }
      }
      
      // Convert Firestore Timestamps to ISO strings for client compatibility
      const convertTimestamp = (ts: Timestamp | undefined) => ts ? ts.toDate().toISOString() : new Date().toISOString();

      return {
        ...savedData,
        id: firestoreDocId,
        publishedAt: convertTimestamp(savedData.publishedAt as Timestamp),
        createdAt: convertTimestamp(savedData.createdAt as Timestamp),
        updatedAt: convertTimestamp(savedData.updatedAt as Timestamp),
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
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchBulletinsFlow. Admin SDK init likely failed.");
        throw new Error("Firestore admin instance (db) is not initialized in fetchBulletinsFlow.");
    }
    try {
      const bulletinsCollectionRef = db.collection(BULLETINS_COLLECTION);
      const snapshot = await bulletinsCollectionRef.orderBy("publishedAt", "desc").get();
      
      const bulletinsList = snapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        const convertTimestamp = (ts: Timestamp | undefined) => ts ? ts.toDate().toISOString() : new Date(0).toISOString();
        return {
          ...data,
          id: docSnapshot.id,
          publishedAt: convertTimestamp(data.publishedAt as Timestamp),
          createdAt: convertTimestamp(data.createdAt as Timestamp),
          updatedAt: convertTimestamp(data.updatedAt as Timestamp),
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
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in deleteBulletinFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in deleteBulletinFlow.");
    }
    try {
      const bulletinDocRef = db.collection(BULLETINS_COLLECTION).doc(input.bulletinId);
      await bulletinDocRef.delete();
      return { success: true, bulletinId: input.bulletinId };
    } catch (error) {
      console.error('Error deleting bulletin from Firestore:', error);
      throw new Error(`Failed to delete bulletin ${input.bulletinId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);
