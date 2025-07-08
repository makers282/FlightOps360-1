
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
} from '@/ai/schemas/maintenance-job-schemas';
import { z } from 'zod';

const MAINTENANCE_JOBS_COLLECTION = 'maintenanceJobs';

// Exported async functions that clients will call
export async function saveMaintenanceJob(input: SaveMaintenanceJobInput): Promise<MaintenanceJob> {
  if (!db) {
    throw new Error("Firestore admin instance is not initialized.");
  }
  const jobId = input.id || db.collection(MAINTENANCE_JOBS_COLLECTION).doc().id;
  const { id, ...jobData } = input;
  return saveMaintenanceJobFlow({ ...jobData, id: jobId });
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
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: docSnap.exists ? docSnap.data()?.createdAt : FieldValue.serverTimestamp(),
      };

      await docRef.set(dataToSet, { merge: true });
      const savedDoc = await docRef.get();
      const savedData = savedDoc.data();

      if (!savedData) {
        throw new Error("Failed to retrieve saved job data from Firestore.");
      }

      return {
        ...savedData,
        id: savedDoc.id,
        dateIssued: (savedData.dateIssued as Timestamp).toDate().toISOString(),
        dateDue: (savedData.dateDue as Timestamp)?.toDate().toISOString(),
        createdAt: (savedData.createdAt as Timestamp).toDate().toISOString(),
        updatedAt: (savedData.updatedAt as Timestamp).toDate().toISOString(),
      } as MaintenanceJob;
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
        return {
          ...data,
          id: doc.id,
          dateIssued: (data.dateIssued as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
          dateDue: (data.dateDue as Timestamp)?.toDate().toISOString(),
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || new Date(0).toISOString(),
        } as MaintenanceJob;
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
