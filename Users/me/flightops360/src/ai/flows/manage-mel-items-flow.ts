
'use server';
/**
 * @fileOverview Genkit flows for managing aircraft MEL items using Firestore.
 *
 * - saveMelItem - Saves (adds or updates) an MEL item.
 * - fetchMelItemsForAircraft - Fetches all MEL items for a given aircraft.
 * - fetchAllMelItems - Fetches all MEL items across all aircraft.
 * - deleteMelItem - Deletes an MEL item.
 */

import { ai } from '@/ai/genkit';
import { adminDb as db } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { MelItem, SaveMelItemInput } from '@/ai/schemas/mel-item-schemas';
import {
    MelItemSchema,
    SaveMelItemInputSchema,
    SaveMelItemOutputSchema,
    FetchMelItemsInputSchema,
    FetchMelItemsOutputSchema,
    DeleteMelItemInputSchema,
    DeleteMelItemOutputSchema,
} from '@/ai/schemas/mel-item-schemas';
import type { FleetAircraft } from '@/ai/schemas/fleet-aircraft-schemas';

const MEL_ITEMS_COLLECTION = 'aircraftMelItems';
const FLEET_COLLECTION = 'fleet'; 

// Exported async functions that clients will call
export async function saveMelItem(input: SaveMelItemInput): Promise<MelItem> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveMelItem (manage-mel-items-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in saveMelItem.");
  }
  const melItemId = input.id || db.collection(MEL_ITEMS_COLLECTION).doc().id;
  const { id, ...melItemDataForFlow } = input;
  return saveMelItemFlow({ 
    firestoreDocId: melItemId, 
    melItemData: melItemDataForFlow as Omit<SaveMelItemInput, 'id'> 
  });
}

export async function fetchMelItemsForAircraft(input: { aircraftId: string }): Promise<MelItem[]> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchMelItemsForAircraft (manage-mel-items-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in fetchMelItemsForAircraft.");
  }
  return fetchMelItemsForAircraftFlow(input);
}

export async function fetchAllMelItems(): Promise<MelItem[]> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchAllMelItems (manage-mel-items-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in fetchAllMelItems.");
  }
  return fetchAllMelItemsFlow();
}

export async function deleteMelItem(input: { melItemId: string }): Promise<{ success: boolean; melItemId: string }> {
    if (!db) {
    console.error("CRITICAL: Firestore admin instance (db) is not initialized in deleteMelItem (manage-mel-items-flow). Admin SDK init likely failed.");
    throw new Error("Firestore admin instance (db) is not initialized in deleteMelItem.");
  }
  return deleteMelItemFlow(input);
}

// Internal Genkit Flow Schemas and Definitions
const InternalSaveMelItemInputSchema = z.object({
  firestoreDocId: z.string(),
  melItemData: SaveMelItemInputSchema.omit({ id: true }),
});

const saveMelItemFlow = ai.defineFlow(
  {
    name: 'saveMelItemFlow',
    inputSchema: InternalSaveMelItemInputSchema,
    outputSchema: SaveMelItemOutputSchema,
  },
  async ({ firestoreDocId, melItemData }) => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in saveMelItemFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in saveMelItemFlow.");
    }
    const melItemDocRef = db.collection(MEL_ITEMS_COLLECTION).doc(firestoreDocId);
    try {
      const docSnap = await melItemDocRef.get();
      
      let aircraftTailNumber: string | undefined = undefined;
      if (melItemData.aircraftId) {
        const aircraftDocRef = db.collection(FLEET_COLLECTION).doc(melItemData.aircraftId);
        const aircraftSnap = await aircraftDocRef.get();
        if (aircraftSnap.exists) {
          const aircraft = aircraftSnap.data() as FleetAircraft;
          aircraftTailNumber = aircraft.tailNumber;
        }
      }

      const dataToSet = {
        ...melItemData,
        aircraftTailNumber: aircraftTailNumber || melItemData.aircraftTailNumber, 
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: docSnap.exists && docSnap.data()?.createdAt ? docSnap.data()?.createdAt : FieldValue.serverTimestamp(),
      };

      await melItemDocRef.set(dataToSet, { merge: true });
      const savedDoc = await melItemDocRef.get();
      const savedData = savedDoc.data();

      if (!savedData) {
        throw new Error("Failed to retrieve saved MEL item data from Firestore.");
      }
      
      const convertTimestamp = (ts: any) => ts ? (ts as Timestamp).toDate().toISOString() : new Date().toISOString();

      return {
        ...savedData,
        id: firestoreDocId,
        createdAt: convertTimestamp(savedData.createdAt),
        updatedAt: convertTimestamp(savedData.updatedAt),
      } as MelItem;
    } catch (error) {
      console.error('Error saving MEL item to Firestore:', error);
      throw new Error(`Failed to save MEL item ${firestoreDocId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const fetchMelItemsForAircraftFlow = ai.defineFlow(
  {
    name: 'fetchMelItemsForAircraftFlow',
    inputSchema: FetchMelItemsInputSchema,
    outputSchema: FetchMelItemsOutputSchema,
  },
  async (input) => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchMelItemsForAircraftFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in fetchMelItemsForAircraftFlow.");
    }
    try {
      const melItemsCollectionRef = db.collection(MEL_ITEMS_COLLECTION);
      const q = melItemsCollectionRef
        .where("aircraftId", "==", input.aircraftId)
        .orderBy("dateEntered", "desc");
      const snapshot = await q.get();
      const convertTimestamp = (ts: any) => ts ? (ts as Timestamp).toDate().toISOString() : new Date(0).toISOString();
      
      const melItemsList = snapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        return {
          ...data,
          id: docSnapshot.id,
          createdAt: convertTimestamp(data.createdAt),
          updatedAt: convertTimestamp(data.updatedAt),
        } as MelItem;
      });
      return melItemsList;
    } catch (error) {
      console.error('Error fetching MEL items from Firestore:', error);
      throw new Error(`Failed to fetch MEL items for aircraft ${input.aircraftId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const FetchAllMelItemsOutputSchema = z.array(MelItemSchema);

const fetchAllMelItemsFlow = ai.defineFlow(
  {
    name: 'fetchAllMelItemsFlow',
    outputSchema: FetchAllMelItemsOutputSchema,
  },
  async () => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in fetchAllMelItemsFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in fetchAllMelItemsFlow.");
    }
    try {
      const melItemsCollectionRef = db.collection(MEL_ITEMS_COLLECTION);
      const q = melItemsCollectionRef.orderBy("dateEntered", "desc");
      const snapshot = await q.get();
      const convertTimestamp = (ts: any) => ts ? (ts as Timestamp).toDate().toISOString() : new Date(0).toISOString();

      const melItemsList = snapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        return {
          ...data,
          id: docSnapshot.id,
          createdAt: convertTimestamp(data.createdAt),
          updatedAt: convertTimestamp(data.updatedAt),
        } as MelItem;
      });
      return melItemsList;
    } catch (error) {
      console.error('Error fetching all MEL items from Firestore:', error);
      throw new Error(`Failed to fetch all MEL items: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);


const deleteMelItemFlow = ai.defineFlow(
  {
    name: 'deleteMelItemFlow',
    inputSchema: DeleteMelItemInputSchema,
    outputSchema: DeleteMelItemOutputSchema,
  },
  async (input) => {
    if (!db) {
        console.error("CRITICAL: Firestore admin instance (db) is not initialized in deleteMelItemFlow.");
        throw new Error("Firestore admin instance (db) is not initialized in deleteMelItemFlow.");
    }
    try {
      const melItemDocRef = db.collection(MEL_ITEMS_COLLECTION).doc(input.melItemId);
      await melItemDocRef.delete();
      return { success: true, melItemId: input.melItemId };
    } catch (error) {
      console.error('Error deleting MEL item from Firestore:', error);
      throw new Error(`Failed to delete MEL item ${input.melItemId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);
