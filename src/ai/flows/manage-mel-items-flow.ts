
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
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, getDoc, getDocs, serverTimestamp, Timestamp, deleteDoc, query, where, orderBy } from 'firebase/firestore';
import { z } from 'zod';
import type { MelItem, SaveMelItemInput } from '@/ai/schemas/mel-item-schemas';
import {
    MelItemSchema, // Added for FetchAllMelItemsOutputSchema
    SaveMelItemInputSchema,
    SaveMelItemOutputSchema,
    FetchMelItemsInputSchema,
    FetchMelItemsOutputSchema,
    DeleteMelItemInputSchema,
    DeleteMelItemOutputSchema,
} from '@/ai/schemas/mel-item-schemas';
import type { FleetAircraft } from '@/ai/schemas/fleet-aircraft-schemas'; // For fetching tail number

const MEL_ITEMS_COLLECTION = 'aircraftMelItems';
const FLEET_COLLECTION = 'fleet'; 

// Exported async functions that clients will call
export async function saveMelItem(input: SaveMelItemInput): Promise<MelItem> {
  const melItemId = input.id || doc(collection(db, MEL_ITEMS_COLLECTION)).id;
  const { id, ...melItemDataForFlow } = input;
  return saveMelItemFlow({ 
    firestoreDocId: melItemId, 
    melItemData: melItemDataForFlow as Omit<SaveMelItemInput, 'id'> 
  });
}

export async function fetchMelItemsForAircraft(input: { aircraftId: string }): Promise<MelItem[]> {
  return fetchMelItemsForAircraftFlow(input);
}

export async function fetchAllMelItems(): Promise<MelItem[]> {
  return fetchAllMelItemsFlow();
}

export async function deleteMelItem(input: { melItemId: string }): Promise<{ success: boolean; melItemId: string }> {
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
    const melItemDocRef = doc(db, MEL_ITEMS_COLLECTION, firestoreDocId);
    try {
      const docSnap = await getDoc(melItemDocRef);
      
      let aircraftTailNumber: string | undefined = undefined;
      if (melItemData.aircraftId) {
        const aircraftDocRef = doc(db, FLEET_COLLECTION, melItemData.aircraftId);
        const aircraftSnap = await getDoc(aircraftDocRef);
        if (aircraftSnap.exists()) {
          const aircraft = aircraftSnap.data() as FleetAircraft;
          aircraftTailNumber = aircraft.tailNumber;
        }
      }

      const dataToSet = {
        ...melItemData,
        aircraftTailNumber: aircraftTailNumber || melItemData.aircraftTailNumber, // Use fetched or existing
        updatedAt: serverTimestamp(),
        createdAt: docSnap.exists() && docSnap.data().createdAt ? docSnap.data().createdAt : serverTimestamp(),
      };

      await setDoc(melItemDocRef, dataToSet, { merge: true });
      const savedDoc = await getDoc(melItemDocRef);
      const savedData = savedDoc.data();

      if (!savedData) {
        throw new Error("Failed to retrieve saved MEL item data from Firestore.");
      }

      return {
        ...savedData,
        id: firestoreDocId,
        dateEntered: savedData.dateEntered, // Ensure dates are strings
        dueDate: savedData.dueDate,
        closedDate: savedData.closedDate,
        createdAt: (savedData.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        updatedAt: (savedData.updatedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
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
    try {
      const melItemsCollectionRef = collection(db, MEL_ITEMS_COLLECTION);
      const q = query(
        melItemsCollectionRef, 
        where("aircraftId", "==", input.aircraftId),
        orderBy("dateEntered", "desc") // Restored Firestore ordering
      );
      const snapshot = await getDocs(q);
      const melItemsList = snapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        return {
          ...data,
          id: docSnapshot.id,
          dateEntered: data.dateEntered,
          dueDate: data.dueDate,
          closedDate: data.closedDate,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
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
    try {
      const melItemsCollectionRef = collection(db, MEL_ITEMS_COLLECTION);
      const q = query(
        melItemsCollectionRef,
        orderBy("dateEntered", "desc") 
      );
      const snapshot = await getDocs(q);
      const melItemsList = snapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        return {
          ...data,
          id: docSnapshot.id,
          dateEntered: data.dateEntered,
          dueDate: data.dueDate,
          closedDate: data.closedDate,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
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
    try {
      const melItemDocRef = doc(db, MEL_ITEMS_COLLECTION, input.melItemId);
      await deleteDoc(melItemDocRef);
      return { success: true, melItemId: input.melItemId };
    } catch (error) {
      console.error('Error deleting MEL item from Firestore:', error);
      throw new Error(`Failed to delete MEL item ${input.melItemId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

