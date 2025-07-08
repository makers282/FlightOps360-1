
'use server';
/**
 * @fileOverview Genkit flows for managing maintenance jobs (work orders) using Firestore.
 */

import { ai } from '@/ai/genkit';
import { adminDb as db } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { MaintenanceJob, SaveMaintenanceJobInput } from '@/ai/schemas/maintenance-job-schemas';
import {
  SaveMaintenanceJobInputSchema,
  SaveMaintenanceJobOutputSchema,
  FetchMaintenanceJobsOutputSchema,
  DeleteMaintenanceJobInputSchema,
  DeleteMaintenanceJobOutputSchema,
  MaintenanceJobSchema,
} from '@/ai/schemas/maintenance-job-schemas';
import { z } from 'zod';

/**
 * Safely converts a Firestore Timestamp or an ISO date string to an ISO date string.
 * @param ts The timestamp to convert.
 * @returns An ISO date string, or a default date string if conversion fails.
 */
const convertTimestampToISO = (ts: any): string => {
    if (!ts) return new Date(0).toISOString();
    // Handle Firestore Timestamp object
    if (typeof ts.toDate === 'function') {
        return ts.toDate().toISOString();
    }
    // Handle if it's already an ISO string
    if (typeof ts === 'string') {
        // Basic check to see if it's likely an ISO string
        if (ts.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
            return ts;
        }
    }
    // Fallback for other potential date string formats or numbers
    try {
        return new Date(ts).toISOString();
    } catch {
        return new Date(0).toISOString(); // Ultimate fallback
    }
};

/**
 * Removes properties with `undefined` values from an object.
 * Firestore does not allow `undefined` as a field value.
 * This version is aware of Firestore's special FieldValue/Timestamp types.
 * @param obj The object to clean.
 * @returns A new object with `undefined` properties removed.
 */
function removeUndefined(obj: any): any {
  if (obj instanceof FieldValue || obj instanceof Timestamp) {
    return obj;
  }
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined);
  }
  const newObj: { [key: string]: any } = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key) && obj[key] !== undefined) {
      newObj[key] = removeUndefined(obj[key]);
    }
  }
  return newObj;
}

// Exported async functions that clients will call
export async function saveMaintenanceJob(input: SaveMaintenanceJobInput): Promise<MaintenanceJob> {
  if (!db) {
    throw new Error("Firestore admin instance is not initialized.");
  }
  const jobId = input.id || db.collection(MAINTENANCE_JOBS_COLLECTION).doc().id;
  const { id, ...jobData } = input;
  // The 'as any' is a bit of a workaround because the input schema from the client
  // has `dateIssued` as a string, but the flow input technically expects a Date object
  // from the Zod schema. The flow handles the string correctly.
  return saveMaintenanceJobFlow({ ...jobData, id: jobId } as any);
}

export async function fetchMaintenanceJobs(): Promise<MaintenanceJob[]> {
  if (!db) {
    throw new Error("Firestore admin instance is not initialized.");
  }
  return fetchMaintenanceJobsFlow();
}

export async function deleteMaintenanceJob(input: { jobId: string }): Promise<{ success: boolean; jobId: string }> {
  if (!db) {
    throw new Error("Firestore admin instance is not initialized.");
  }
  return deleteMaintenanceJobFlow(input);
}

const MAINTENANCE_JOBS_COLLECTION = 'maintenanceJobs';

// Internal Genkit Flow Definitions
const saveMaintenanceJobFlow = ai.defineFlow(
  {
    name: 'saveMaintenanceJobFlow',
    inputSchema: SaveMaintenanceJobInputSchema.extend({ id: z.string() }),
    outputSchema: SaveMaintenanceJobOutputSchema,
  },
  async (payload) => {
    if (!db) throw new Error("Firestore is not initialized in flow.");
    const { id, ...jobData } = payload;
    const docRef = db.collection(MAINTENANCE_JOBS_COLLECTION).doc(id);

    try {
      const docSnap = await docRef.get();
      const dataToSet = {
        ...jobData,
        costBreakdowns: jobData.costBreakdowns || [],
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: docSnap.exists && docSnap.data()?.createdAt ? docSnap.data()?.createdAt : FieldValue.serverTimestamp(),
      };

      const cleanedData = removeUndefined(dataToSet);

      await docRef.set(cleanedData, { merge: true });
      const savedDoc = await docRef.get();
      const savedData = savedDoc.data();

      if (!savedData) {
        throw new Error("Failed to retrieve saved job data from Firestore.");
      }
      
      const output: MaintenanceJob = {
        id: savedDoc.id,
        aircraftId: savedData.aircraftId,
        tailNumber: savedData.tailNumber,
        workOrderNumber: savedData.workOrderNumber,
        shopName: savedData.shopName,
        shopContactName: savedData.shopContactName ?? undefined,
        shopContactPhone: savedData.shopContactPhone ?? undefined,
        shopContactEmail: savedData.shopContactEmail ?? undefined,
        status: savedData.status,
        dateIssued: savedData.dateIssued, // Already a string
        dateDue: savedData.dateDue ?? undefined,
        notes: savedData.notes ?? undefined,
        costBreakdowns: savedData.costBreakdowns || [],
        createdAt: convertTimestampToISO(savedData.createdAt),
        updatedAt: convertTimestampToISO(savedData.updatedAt),
      };

      return output;
    } catch (error) {
      console.error(`Error saving maintenance job ${id}:`, error);
      throw new Error(`Failed to save job: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const fetchMaintenanceJobsFlow = ai.defineFlow(
  {
    name: 'fetchMaintenanceJobsFlow',
    outputSchema: FetchMaintenanceJobsOutputSchema,
  },
  async () => {
    if (!db) throw new Error("Firestore is not initialized in flow.");
    try {
      const snapshot = await db.collection(MAINTENANCE_JOBS_COLLECTION).orderBy('dateIssued', 'desc').get();
      return snapshot.docs.map(doc => {
        const data = doc.data();
        // This is now the single source of truth for converting DB data to the client-safe MaintenanceJob type.
        const output: MaintenanceJob = {
          id: doc.id,
          aircraftId: data.aircraftId,
          tailNumber: data.tailNumber,
          workOrderNumber: data.workOrderNumber,
          shopName: data.shopName,
          shopContactName: data.shopContactName ?? undefined,
          shopContactPhone: data.shopContactPhone ?? undefined,
          shopContactEmail: data.shopContactEmail ?? undefined,
          status: data.status,
          dateIssued: data.dateIssued, // Already a string
          dateDue: data.dateDue ?? undefined,
          notes: data.notes ?? undefined,
          costBreakdowns: data.costBreakdowns || [],
          createdAt: convertTimestampToISO(data.createdAt),
          updatedAt: convertTimestampToISO(data.updatedAt),
        };
        return output;
      });
    } catch (error) {
      console.error('Error fetching maintenance jobs:', error);
      throw new Error(`Failed to fetch jobs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

const deleteMaintenanceJobFlow = ai.defineFlow(
  {
    name: 'deleteMaintenanceJobFlow',
    inputSchema: DeleteMaintenanceJobInputSchema,
    outputSchema: DeleteMaintenanceJobOutputSchema,
  },
  async ({ jobId }) => {
    if (!db) throw new Error("Firestore is not initialized in flow.");
    try {
      // Add logic here to find and unlink associated costs if necessary
      await db.collection(MAINTENANCE_JOBS_COLLECTION).doc(jobId).delete();
      return { success: true, jobId };
    } catch (error) {
      console.error(`Error deleting maintenance job ${jobId}:`, error);
      throw new Error(`Failed to delete job: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);
