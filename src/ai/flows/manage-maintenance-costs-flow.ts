
'use server';
/**
 * @fileOverview Genkit flows for managing maintenance costs using Firestore.
 */

import { ai } from '@/ai/genkit';
import { adminDb as db } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { MaintenanceCost, SaveMaintenanceCostInput } from '@/ai/schemas/maintenance-cost-schemas';
import {
  SaveMaintenanceCostInputSchema,
  SaveMaintenanceCostOutputSchema,
  FetchMaintenanceCostsOutputSchema,
  DeleteMaintenanceCostInputSchema,
  DeleteMaintenanceCostOutputSchema,
} from '@/ai/schemas/maintenance-cost-schemas';
import { z } from 'zod';

const MAINTENANCE_COSTS_COLLECTION = 'maintenanceCosts';

// Exported async functions that clients will call
export async function saveMaintenanceCost(input: SaveMaintenanceCostInput): Promise<MaintenanceCost> {
  if (!db) {
    throw new Error("Firestore admin instance is not initialized.");
  }
  const costId = input.id || db.collection(MAINTENANCE_COSTS_COLLECTION).doc().id;
  return saveMaintenanceCostFlow({ ...input, id: costId });
}

export async function fetchMaintenanceCosts(): Promise<MaintenanceCost[]> {
  if (!db) {
    throw new Error("Firestore admin instance is not initialized.");
  }
  return fetchMaintenanceCostsFlow();
}

export async function deleteMaintenanceCost(input: { costId: string }): Promise<{ success: boolean; costId: string }> {
  if (!db) {
    throw new Error("Firestore admin instance is not initialized.");
  }
  return deleteMaintenanceCostFlow(input);
}

// Internal Genkit Flow Definitions
const saveMaintenanceCostFlow = ai.defineFlow(
  {
    name: 'saveMaintenanceCostFlow',
    inputSchema: SaveMaintenanceCostInputSchema.extend({ id: z.string() }),
    outputSchema: SaveMaintenanceCostOutputSchema,
  },
  async (payload) => {
    if (!db) throw new Error("Firestore is not initialized in flow.");
    const { id, ...costData } = payload;
    const docRef = db.collection(MAINTENANCE_COSTS_COLLECTION).doc(id);

    try {
      const docSnap = await docRef.get();
      const dataToSet = {
        ...costData,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: docSnap.exists ? docSnap.data()?.createdAt : FieldValue.serverTimestamp(),
      };

      await docRef.set(dataToSet, { merge: true });
      const savedDoc = await docRef.get();
      const savedData = savedDoc.data();

      if (!savedData) {
        throw new Error("Failed to retrieve saved cost data from Firestore.");
      }

      return {
        ...savedData,
        id: savedDoc.id,
        invoiceDate: savedData.invoiceDate, // Already a string
        createdAt: (savedData.createdAt as Timestamp).toDate().toISOString(),
        updatedAt: (savedData.updatedAt as Timestamp).toDate().toISOString(),
      } as MaintenanceCost;
    } catch (error) {
      console.error(`Error saving maintenance cost ${id}:`, error);
      throw new Error(`Failed to save cost: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const fetchMaintenanceCostsFlow = ai.defineFlow(
  {
    name: 'fetchMaintenanceCostsFlow',
    outputSchema: FetchMaintenanceCostsOutputSchema,
  },
  async () => {
    if (!db) throw new Error("Firestore is not initialized in flow.");
    try {
      const snapshot = await db.collection(MAINTENANCE_COSTS_COLLECTION).orderBy('invoiceDate', 'desc').get();
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          invoiceDate: data.invoiceDate,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
        } as MaintenanceCost;
      });
    } catch (error) {
      console.error('Error fetching maintenance costs:', error);
      throw new Error(`Failed to fetch costs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const deleteMaintenanceCostFlow = ai.defineFlow(
  {
    name: 'deleteMaintenanceCostFlow',
    inputSchema: DeleteMaintenanceCostInputSchema,
    outputSchema: DeleteMaintenanceCostOutputSchema,
  },
  async ({ costId }) => {
    if (!db) throw new Error("Firestore is not initialized in flow.");
    try {
      await db.collection(MAINTENANCE_COSTS_COLLECTION).doc(costId).delete();
      return { success: true, costId };
    } catch (error) {
      console.error(`Error deleting maintenance cost ${costId}:`, error);
      throw new Error(`Failed to delete cost: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);
